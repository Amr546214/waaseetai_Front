import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const KEY_PREFIX = 'ws.notif.popped.v1.';
/** Bounded per user: the oldest ids fall out first (a notification that old is long out of any live/recovery window). */
export const POPUP_LEDGER_MAX = 200;

/**
 * "Was this notification already announced as a popup to THIS user?" - deliberately a different fact from "was it read".
 * Nothing here touches readAt/isRead, the unread counter or the server.
 *
 * Persistence: localStorage, one key per user id (accounts on one browser never share or inherit each other's list).
 * Every check re-reads the stored list, so several tabs of the same browser agree without a message channel: the first
 * tab to {@link claim} an id wins and every other tab sees it as already announced. Falls back to memory when storage
 * is unavailable (then it holds for the page's lifetime only).
 * Not shared across devices/browsers: the same unread notification can pop once on each device. See the PR notes.
 */
@Injectable({ providedIn: 'root' })
export class NotificationPopupLedger {
	private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private memory = new Map<string, string[]>();

	has(userId: string, key: string): boolean {
		return !!userId && !!key && this.read(userId).includes(key);
	}

	/** Atomically (within this browser) records the key; true only for the caller that recorded it, i.e. the one that may show the popup. */
	claim(userId: string, key: string): boolean {
		if (!userId || !key) return false;
		const list = this.read(userId);
		if (list.includes(key)) return false;
		this.write(userId, [...list, key]);
		return true;
	}

	/** Marks keys as handled without showing anything (the unread backlog found on page load is not "new"). */
	seed(userId: string, keys: string[]): void {
		if (!userId) return;
		const list = this.read(userId);
		const add = keys.filter(k => !!k && !list.includes(k));
		if (add.length) this.write(userId, [...list, ...add]);
	}

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

	private write(userId: string, list: string[]): void {
		const bounded = list.slice(-POPUP_LEDGER_MAX);
		this.memory.set(userId, bounded);
		if (!this.isBrowser) return;
		try { localStorage.setItem(this.storageKey(userId), JSON.stringify(bounded)); } catch { /* memory copy still holds */ }
	}
}
