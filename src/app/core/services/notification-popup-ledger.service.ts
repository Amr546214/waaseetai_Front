import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const KEY_PREFIX = 'ws.notif.popped.v1.';
const CLAIM_PREFIX = 'ws.notif.claim.v1.';
const LOCK_PREFIX = 'ws.notif.popup-lock.v1.';
/** Bounded per user: the oldest ids fall out first (a notification that old is long out of any live/recovery window). */
export const POPUP_LEDGER_MAX = 200;
/** How long a claim stays valid without being committed. The claimer shows the popup in the same task as the claim, so this only matters when it dies. */
export const POPUP_CLAIM_LEASE_MS = 3000;
/** Fallback (no Web Locks) only: how long every contender waits for the others' claim writes to land before deciding the winner. */
export const POPUP_SETTLE_MS = 60;
const LOCK_TIMEOUT_MS = 2000;
const ABANDONED = Symbol('lock-abandoned');
interface ClaimRec { exp: number; ts: number; tok: string }

export interface PopupClaimResult {
	/** true only for the single tab that may show the popup now */
	won: boolean;
	/** set when this tab lost only because another tab holds a live (uncommitted) claim: ask again after this many ms in case that tab died */
	retryInMs?: number;
}

/**
 * "Was this notification already announced as a popup to THIS user?" - deliberately a different fact from "was it read".
 * Nothing here touches readAt/isRead, the unread counter or the server.
 *
 * Persistence: localStorage, one key per user id (accounts on one browser never share or inherit each other's list).
 * Falls back to memory when storage is unavailable (then it holds for the page's lifetime only).
 * Not shared across devices/browsers: the same unread notification can pop once on each device.
 *
 * Cross-tab protocol (localStorage read-then-write is NOT atomic, so it is never relied upon for the decision):
 *  1. {@link claim}: a short per-user critical section decides who may show. Preferred path = Web Locks
 *     (`navigator.locks`, exclusive, one lock per user): inside it a tab checks the "shown" list and the other tabs' live
 *     claims, and writes its own claim. Fallback path (no Web Locks: insecure http origin, very old browsers) = every
 *     contender writes its OWN claim key (`ws.notif.claim.v1.<user>.<id>.<tab>`, nobody overwrites anybody), waits
 *     {@link POPUP_SETTLE_MS}, re-reads all live claims for the id and only the lowest tab id wins.
 *  2. The winner shows the popup, then {@link commit}s: the id joins the "shown" list and the claim is dropped.
 *  3. A claim is a lease ({@link POPUP_CLAIM_LEASE_MS}). If the winner dies before showing/committing, the lease
 *     expires, and the losing tab (told `retryInMs`) claims again and shows it. A committed id is never claimed again.
 */
@Injectable({ providedIn: 'root' })
export class NotificationPopupLedger {
	private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private memory = new Map<string, string[]>();
	private memoryClaims = new Map<string, ClaimRec>();
	private ownTokens = new Map<string, string>();
	/** unique per page load: a refreshed tab is a new tab to the others */
	readonly tabId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
	/** overridable in tests */
	settleMs = POPUP_SETTLE_MS;
	leaseMs = POPUP_CLAIM_LEASE_MS;
	/** which path decided the last claim (diagnostics/tests) */
	lastPath: 'locks' | 'fallback' | null = null;

	/** already shown (committed) to this user in this browser */
	has(userId: string, key: string): boolean {
		return !!userId && !!key && this.read(userId).includes(key);
	}

	/**
	 * Cross-tab safe claim. Both paths run the SAME protocol on the SAME claim records (`ws.notif.claim.v1.<user>.<id>.<tab>` = {exp, ts, tok}):
	 * write own claim, settle, then the lowest (ts, tabId) among live claims wins. The Web Lock only serializes the critical section, so a tab on
	 * the lock path and a tab that fell back (lock timeout / no Web Locks) agree on one winner. Call {@link stillOwns} right before displaying.
	 */
	async claim(userId: string, key: string): Promise<PopupClaimResult> {
		if (!userId || !key) return { won: false };
		const locks = this.locks();
		if (locks) {
			try {
				const r = await this.withLock(locks, userId, () => this.decide(userId, key));
				if (r !== ABANDONED) { this.lastPath = 'locks'; return r; }
			} catch { /* lock unusable or timed out (request aborted): use the shared protocol without the lock */ }
		}
		this.lastPath = 'fallback';
		return this.decide(userId, key);
	}

	/**
	 * Synchronous last check, to be called in the same task as the display (after any await / lock wait / resume from a freeze):
	 * this tab still holds its own unexpired claim token, nobody holds an earlier-ordered live claim, and the id is not already shown.
	 * False means: drop silently.
	 */
	stillOwns(userId: string, key: string): boolean {
		if (!userId || !key) return false;
		if (this.read(userId).includes(key)) return false;
		const mine = this.ownTokens.get(this.claimKey(userId, key, this.tabId));
		if (!mine) return false;
		const live = this.liveClaims(userId, key);
		const me = live.find(c => c.tab === this.tabId);
		if (!me || me.tok !== mine || me.exp <= Date.now()) return false;
		return !live.some(c => c.tab !== this.tabId && this.before(c, me));
	}

	/** The winner calls this right after showing: the id is now permanently "shown" and the lease is released. */
	async commit(userId: string, key: string): Promise<void> {
		if (!userId || !key) return;
		const run = () => { this.addShown(userId, [key]); this.dropClaim(userId, key, this.tabId); };
		const locks = this.locks();
		if (locks) { try { if ((await this.withLock(locks, userId, async () => run())) !== ABANDONED) return; } catch { /* fall through */ } }
		run();
	}

	/** Marks keys as handled without showing anything (the unread backlog found on page load is not "new"). */
	seed(userId: string, keys: string[]): void {
		if (!userId) return;
		const list = this.read(userId);
		const add = keys.filter(k => !!k && !list.includes(k));
		if (add.length) this.addShown(userId, add);
	}

	// ---- decision (shared by both paths) ----

	private before(a: { ts: number; tab: string }, b: { ts: number; tab: string }): boolean {
		return a.ts !== b.ts ? a.ts < b.ts : a.tab < b.tab;
	}

	private async decide(userId: string, key: string): Promise<PopupClaimResult> {
		if (this.read(userId).includes(key)) return { won: false };
		if (this.liveClaims(userId, key).some(c => c.tab === this.tabId)) return { won: false }; // this tab already holds/contends for it
		const foreign = this.liveForeignClaim(userId, key);
		if (foreign !== null) return { won: false, retryInMs: Math.max(0, foreign - Date.now()) }; // someone is ahead: only if it dies do we take over
		this.writeClaim(userId, key);
		if (this.settleMs > 0) await new Promise<void>(r => setTimeout(r, this.settleMs));
		if (this.read(userId).includes(key)) { this.dropClaim(userId, key, this.tabId); return { won: false }; }
		const live = this.liveClaims(userId, key);
		const me = live.find(c => c.tab === this.tabId);
		if (!me) return { won: false }; // our record expired/vanished during the wait (frozen tab): not ours any more
		const best = live.reduce((x, y) => (this.before(y, x) ? y : x));
		if (best.tab === this.tabId) return { won: true };
		this.dropClaim(userId, key, this.tabId);
		return { won: false, retryInMs: Math.max(0, best.exp - Date.now()) };
	}

	private withLock<T>(locks: any, userId: string, fn: () => T | Promise<T>): Promise<T | typeof ABANDONED> {
		let state: 'pending' | 'running' | 'abandoned' = 'pending';
		const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
		const timer = setTimeout(() => { if (state === 'pending') { state = 'abandoned'; ac?.abort(); } }, LOCK_TIMEOUT_MS);
		return locks.request(LOCK_PREFIX + userId, ac ? { mode: 'exclusive', signal: ac.signal } : { mode: 'exclusive' }, async () => {
			// a grant that arrives after we gave up must not decide anything: the fallback already may have claimed/committed
			if (state === 'abandoned') return ABANDONED;
			state = 'running'; clearTimeout(timer);
			return fn();
		}).finally(() => clearTimeout(timer));
	}

	private locks(): any | null {
		if (!this.isBrowser) return null;
		try {
			const l = (navigator as any)?.locks;
			return l && typeof l.request === 'function' ? l : null;
		} catch { return null; }
	}

	// ---- claims (one storage key per tab per id, so concurrent writers never clobber each other) ----

	private claimKey(userId: string, key: string, tab: string): string { return `${CLAIM_PREFIX}${userId}.${key}.${tab}`; }

	private writeClaim(userId: string, key: string): void {
		const k = this.claimKey(userId, key, this.tabId);
		const tok = Math.random().toString(36).slice(2) + Date.now().toString(36);
		this.ownTokens.set(k, tok);
		const rec: ClaimRec = { exp: Date.now() + this.leaseMs, ts: Date.now(), tok };
		this.memoryClaims.set(k, rec);
		if (!this.isBrowser) return;
		try { localStorage.setItem(k, JSON.stringify(rec)); } catch { /* memory copy holds */ }
	}

	private dropClaim(userId: string, key: string, tab: string): void {
		const k = this.claimKey(userId, key, tab);
		this.memoryClaims.delete(k); this.ownTokens.delete(k);
		if (!this.isBrowser) return;
		try { localStorage.removeItem(k); } catch { /* ignore */ }
	}

	private parseClaim(raw: string | null): ClaimRec | null {
		if (!raw) return null;
		try {
			const v = JSON.parse(raw);
			if (typeof v === 'number') return { exp: v, ts: v, tok: '' };
			if (v && Number.isFinite(v.exp) && Number.isFinite(v.ts)) return { exp: v.exp, ts: v.ts, tok: String(v.tok ?? '') };
		} catch { /* corrupt */ }
		return null;
	}

	/** all live (unexpired) claims for the id, ours included; expired ones are swept */
	private liveClaims(userId: string, key: string): { tab: string; exp: number; ts: number; tok: string }[] {
		const prefix = `${CLAIM_PREFIX}${userId}.${key}.`;
		const now = Date.now();
		const found = new Map<string, ClaimRec>();
		for (const [k, rec] of this.memoryClaims) if (k.startsWith(prefix)) found.set(k, rec);
		if (this.isBrowser) {
			try {
				const keys: string[] = [];
				for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(prefix)) keys.push(k); }
				for (const k of keys) { const rec = this.parseClaim(localStorage.getItem(k)); if (rec) found.set(k, rec); else localStorage.removeItem(k); }
			} catch { /* memory only */ }
		}
		const out: { tab: string; exp: number; ts: number; tok: string }[] = [];
		for (const [k, rec] of found) {
			if (rec.exp <= now) { this.memoryClaims.delete(k); this.ownTokens.delete(k); try { if (this.isBrowser) localStorage.removeItem(k); } catch { /* ignore */ } continue; }
			out.push({ tab: k.slice(prefix.length), ...rec });
		}
		return out;
	}

	/** expiry of another tab's live claim, or null */
	private liveForeignClaim(userId: string, key: string): number | null {
		const f = this.liveClaims(userId, key).filter(c => c.tab !== this.tabId);
		return f.length ? Math.max(...f.map(c => c.exp)) : null;
	}

	// ---- shown list ----

	private storageKey(userId: string): string { return KEY_PREFIX + userId; }

	private read(userId: string): string[] {
		if (this.isBrowser) {
			try {
				const raw = localStorage.getItem(this.storageKey(userId));
				if (raw === null) return this.memory.get(userId) ?? [];
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
			} catch { /* storage blocked or corrupt: use memory */ }
		}
		return this.memory.get(userId) ?? [];
	}

	/** read-merge-write; callers hold the lock when Web Locks exists. Without it the write is verified and retried so a lost update is repaired. */
	private addShown(userId: string, keys: string[]): void {
		for (let attempt = 0; attempt < 3; attempt++) {
			const list = this.read(userId);
			const add = keys.filter(k => !list.includes(k));
			if (!add.length) return;
			this.write(userId, [...list, ...add]);
			if (keys.slice(-POPUP_LEDGER_MAX).every(k => this.read(userId).includes(k))) return;
		}
	}

	private write(userId: string, list: string[]): void {
		const bounded = list.slice(-POPUP_LEDGER_MAX);
		this.memory.set(userId, bounded);
		if (!this.isBrowser) return;
		try { localStorage.setItem(this.storageKey(userId), JSON.stringify(bounded)); } catch { /* memory copy still holds */ }
	}
}
