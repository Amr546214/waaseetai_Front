import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { parseRetryAfter } from './retry-after.util';
import { formatClock, waitLabel } from './wait-format';

const STORAGE_PREFIX = 'ws:wait:v1:';
const TICK_MS = 1000;

/** Short stable hash so an e-mail / phone never sits in a storage key in clear text. */
function hash(value: string): string {
	let h = 5381;
	for (let i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
	return (h >>> 0).toString(36);
}

/** `action` + optional identity (account e-mail, order id, request id ...) -> one wait scope. */
export function waitScope(action: string, identity?: string | null): string {
	const id = (identity ?? '').trim().toLowerCase();
	return id ? `${action}:${hash(id)}` : action;
}

/** A normalised request key for the generic per-endpoint 429 wait: METHOD + path without origin, query or fragment. */
export function httpWaitScope(method: string, url: string): string {
	let path = url;
	try { path = new URL(url, 'http://x').pathname; } catch { path = url.split(/[?#]/)[0]; }
	return `http:${method.toUpperCase()}:${path}`;
}

export interface WaitHandle {
	readonly scope: string;
	/** Absolute end (epoch ms) while the wait is running, else null. */
	readonly endsAt: Signal<number | null>;
	readonly remainingMs: Signal<number>;
	readonly remainingSeconds: Signal<number>;
	readonly active: Signal<boolean>;
	/** «بعد 1:23» while running, '' otherwise. */
	readonly label: Signal<string>;
	/** "1:23" while running, '' otherwise. */
	readonly clock: Signal<string>;
	/** Starts / replaces the wait with an absolute end. An end in the past clears it. The server's latest answer always wins (no max with the old end). */
	start(endsAtMs: number): void;
	/** Reads Retry-After / retryAt / resendAvailableAt / retryAfterSeconds from an error or response and starts the wait; returns the end or null (nothing invented). */
	startFromResponse(source: unknown): number | null;
	/** Starts a wait of `seconds` that the SERVER sent (e.g. expiresInSeconds). */
	startIn(seconds: number): void;
	clear(): void;
}

/**
 * Central countdown clock. A wait is an END TIMESTAMP keyed by scope; remaining time is always `end - now`, never a decremented counter, so a throttled
 * background tab or a sleeping laptop shows the right value as soon as it wakes (visibilitychange / focus / pageshow re-sync).
 * One interval exists only while at least one live handle has a running wait; it is cleared when the last one ends or is destroyed.
 * The end is persisted per scope (localStorage, try/catch, expired entries ignored) so a refresh does not start a fresh duration;
 * the server still has the last word: every new server answer replaces the stored end.
 */
@Injectable({ providedIn: 'root' })
export class WaitTimerService {
	private readonly doc = inject(DOCUMENT);
	private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly nowMs = signal(Date.now());
	private readonly ends = new Map<string, WritableSignal<number | null>>();
	private readonly live = new Map<string, number>();
	private interval: ReturnType<typeof setInterval> | null = null;
	private listening = false;
	private readonly resync = () => { this.nowMs.set(Date.now()); this.expireAndRefresh(); };
	private readonly onVisibility = () => { if (!this.doc.hidden) this.resync(); };

	constructor() {
		inject(DestroyRef).onDestroy(() => this.teardown());
	}

	/** Number of intervals currently running (0 or 1) - for tests and diagnostics. */
	get activeIntervals(): number { return this.interval ? 1 : 0; }

	track(scope: string, destroyRef?: DestroyRef | null): WaitHandle {
		const ref = destroyRef ?? this.tryInjectDestroyRef();
		const endSig = this.endSignal(scope);
		this.nowMs.set(Date.now());
		this.live.set(scope, (this.live.get(scope) ?? 0) + 1);
		this.listen();
		let destroyed = false;
		const release = () => {
			if (destroyed) return;
			destroyed = true;
			const n = (this.live.get(scope) ?? 1) - 1;
			if (n <= 0) this.live.delete(scope); else this.live.set(scope, n);
			this.refreshInterval();
		};
		ref?.onDestroy(release);

		const remainingMs = computed(() => { const e = endSig(); return e == null ? 0 : Math.max(0, e - this.nowMs()); });
		const remainingSeconds = computed(() => Math.ceil(remainingMs() / 1000));
		const active = computed(() => remainingMs() > 0);
		const handle: WaitHandle = {
			scope,
			endsAt: computed(() => (active() ? endSig() : null)),
			remainingMs,
			remainingSeconds,
			active,
			label: computed(() => (active() ? waitLabel(remainingSeconds()) : '')),
			clock: computed(() => (active() ? formatClock(remainingSeconds()) : '')),
			start: (endsAtMs: number) => this.setEnd(scope, endsAtMs),
			startFromResponse: (source: unknown) => {
				const end = parseRetryAfter(source);
				if (end != null) this.setEnd(scope, end);
				return end;
			},
			startIn: (seconds: number) => { if (Number.isFinite(seconds) && seconds > 0) this.setEnd(scope, Date.now() + Math.ceil(seconds) * 1000); },
			clear: () => this.setEnd(scope, null),
		};
		this.refreshInterval();
		return handle;
	}

	/** Sets (or clears, with null / a past time) the end of a scope without needing a handle (used by the HTTP interceptor). */
	setEnd(scope: string, endsAtMs: number | null): void {
		const now = Date.now();
		this.nowMs.set(now);
		const sig = this.endSignal(scope);
		if (endsAtMs == null || !Number.isFinite(endsAtMs) || endsAtMs <= now) {
			sig.set(null);
			this.store(scope, null);
		} else {
			sig.set(endsAtMs);
			this.store(scope, endsAtMs);
		}
		this.refreshInterval();
	}

	/** Remaining ms of a scope right now (0 when none). Reads storage like a handle would. */
	remainingMsOf(scope: string): number {
		const e = this.endSignal(scope)();
		return e == null ? 0 : Math.max(0, e - Date.now());
	}

	private endSignal(scope: string): WritableSignal<number | null> {
		let s = this.ends.get(scope);
		if (!s) {
			s = signal<number | null>(this.load(scope));
			this.ends.set(scope, s);
		}
		return s;
	}

	private load(scope: string): number | null {
		if (!this.browser) return null;
		try {
			const raw = localStorage.getItem(STORAGE_PREFIX + scope);
			if (!raw) return null;
			const v = Number(JSON.parse(raw)?.endsAt);
			if (!Number.isFinite(v) || v <= Date.now()) { localStorage.removeItem(STORAGE_PREFIX + scope); return null; }
			return v;
		} catch { return null; }
	}

	private store(scope: string, endsAt: number | null): void {
		if (!this.browser) return;
		try {
			if (endsAt == null) localStorage.removeItem(STORAGE_PREFIX + scope);
			else localStorage.setItem(STORAGE_PREFIX + scope, JSON.stringify({ endsAt }));
		} catch { /* storage blocked: the wait still works in memory */ }
	}

	private anyLiveRunning(now: number): boolean {
		for (const scope of this.live.keys()) {
			const e = this.ends.get(scope)?.();
			if (e != null && e > now) return true;
		}
		return false;
	}

	private expireAndRefresh(): void {
		const now = Date.now();
		for (const [scope, sig] of this.ends) {
			const e = sig();
			if (e != null && e <= now) { sig.set(null); this.store(scope, null); }
		}
		this.refreshInterval();
	}

	/** Creates the single interval while a live handle has a running wait; clears it otherwise. Never stacks. */
	private refreshInterval(): void {
		const need = this.browser && this.anyLiveRunning(Date.now());
		if (need && !this.interval) {
			this.interval = setInterval(() => { this.nowMs.set(Date.now()); this.expireAndRefresh(); }, TICK_MS);
		} else if (!need && this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	private listen(): void {
		if (this.listening || !this.browser) return;
		this.listening = true;
		this.doc.addEventListener('visibilitychange', this.onVisibility);
		this.doc.defaultView?.addEventListener('focus', this.resync);
		this.doc.defaultView?.addEventListener('pageshow', this.resync);
	}

	private teardown(): void {
		if (this.interval) { clearInterval(this.interval); this.interval = null; }
		if (!this.listening) return;
		this.listening = false;
		this.doc.removeEventListener('visibilitychange', this.onVisibility);
		this.doc.defaultView?.removeEventListener('focus', this.resync);
		this.doc.defaultView?.removeEventListener('pageshow', this.resync);
	}

	private tryInjectDestroyRef(): DestroyRef | null {
		try { return inject(DestroyRef); } catch { return null; }
	}
}
