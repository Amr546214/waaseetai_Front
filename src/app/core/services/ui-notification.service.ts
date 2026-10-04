import { Injectable, signal } from '@angular/core';
import { MapHttpErrorOptions, MappedHttpError, mapHttpError } from '../forms/http-error';

export type UiNotificationKind = 'success' | 'info' | 'warning' | 'error';

export interface UiNotification {
	id: number;
	kind: UiNotificationKind;
	message: string;
	/** Optional bold heading (used by banners and mapped HTTP errors). */
	title?: string;
}

export interface NotifyOptions {
	title?: string;
	/** Milliseconds before it disappears. 0 = stays until dismissed. */
	duration?: number;
}

export interface HttpErrorNotifyOptions extends MapHttpErrorOptions {
	/** 'toast' (default) is transient; 'banner' stays until dismissed or replaced (use for things the user must act on). */
	target?: 'toast' | 'banner';
}

const DEFAULT_DURATION: Record<UiNotificationKind, number> = { success: 3500, info: 4500, warning: 6000, error: 7000 };
const MAX_TOASTS = 4;

/**
 * The ONE place that shows success/error feedback for forms and actions: a stack of toasts plus a single banner,
 * rendered by <app-notification-host> (mounted once in the app root). It is separate from NotificationEngineService,
 * which only handles server-pushed notifications.
 */
@Injectable({ providedIn: 'root' })
export class UiNotificationService {
	private nextId = 1;
	private timers = new Map<number, ReturnType<typeof setTimeout>>();

	readonly toasts = signal<UiNotification[]>([]);
	readonly banner = signal<UiNotification | null>(null);

	success(message: string, options?: NotifyOptions): number { return this.toast('success', message, options); }
	info(message: string, options?: NotifyOptions): number { return this.toast('info', message, options); }
	warning(message: string, options?: NotifyOptions): number { return this.toast('warning', message, options); }
	error(message: string, options?: NotifyOptions): number { return this.toast('error', message, options); }

	toast(kind: UiNotificationKind, message: string, options: NotifyOptions = {}): number {
		// The same message again refreshes the existing toast instead of stacking duplicates.
		const existing = this.toasts().find(t => t.kind === kind && t.message === message && t.title === options.title);
		const id = existing?.id ?? this.nextId++;
		if (existing) {
			this.clearTimer(id);
		} else {
			this.toasts.update(list => [...list, { id, kind, message, title: options.title }].slice(-MAX_TOASTS));
		}
		this.arm(id, options.duration ?? DEFAULT_DURATION[kind], () => this.dismiss(id));
		return id;
	}

	/** A sticky message at the top of the screen. Replaces the previous banner. */
	showBanner(kind: UiNotificationKind, message: string, options: NotifyOptions = {}): number {
		const prev = this.banner();
		if (prev) this.clearTimer(prev.id);
		const id = this.nextId++;
		this.banner.set({ id, kind, message, title: options.title });
		if (options.duration) this.arm(id, options.duration, () => this.dismissBanner(id));
		return id;
	}

	dismiss(id: number): void {
		this.clearTimer(id);
		this.toasts.update(list => list.filter(t => t.id !== id));
	}

	dismissBanner(id?: number): void {
		const current = this.banner();
		if (!current || (id !== undefined && current.id !== id)) return;
		this.clearTimer(current.id);
		this.banner.set(null);
	}

	clearAll(): void {
		for (const t of this.timers.values()) clearTimeout(t);
		this.timers.clear();
		this.toasts.set([]);
		this.banner.set(null);
	}

	/**
	 * Maps a failed HTTP call to Arabic, shows it, and returns the mapped error so the caller can also use
	 * `fieldErrors` / `kind` (e.g. applyServerFieldErrors, or keep a "rate limited" state on the form).
	 */
	httpError(err: unknown, options: HttpErrorNotifyOptions = {}): MappedHttpError {
		const mapped = mapHttpError(err, options);
		const kind: UiNotificationKind = mapped.kind === 'pending-review' ? 'warning' : 'error';
		if (options.target === 'banner') this.showBanner(kind, mapped.message, { title: mapped.title });
		else this.toast(kind, mapped.message, { title: mapped.title });
		return mapped;
	}

	private arm(id: number, ms: number, fn: () => void): void {
		if (!ms || ms <= 0 || typeof setTimeout !== 'function') return;
		this.timers.set(id, setTimeout(fn, ms));
	}

	private clearTimer(id: number): void {
		const t = this.timers.get(id);
		if (t !== undefined) { clearTimeout(t); this.timers.delete(id); }
	}
}
