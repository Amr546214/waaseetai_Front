import { DestroyRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { SOCKET_BACKOFF } from '../utils/socket-backoff';
import { PlatformInfoService } from './platform-info.service';

interface PlatformState { maintenance: { on: boolean; message: string }; at: number }
export const PLATFORM_STATE_POLL_MS = 60_000;

/**
 * Keeps the open browser in step with the server's maintenance state WITHOUT a click or a page reload:
 *  - the server pushes `platform:state` over Socket.IO the moment a save commits (and on every (re)connection);
 *  - the state is also READ when the site opens, when the socket reconnects, when the tab becomes visible again, and by a light fallback poll (every minute) in case the push is missed;
 *  - an older answer never overwrites a newer one (`at` is compared), and turning maintenance off simply shows the site again (no reload, so no reload loop).
 * Nothing secret is carried: the payload is {maintenance:{on,message}, at}.
 */
@Injectable({ providedIn: 'root' })
export class PlatformStateService {
	private readonly http = inject(HttpClient);
	private readonly info = inject(PlatformInfoService);
	private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
	private socket: Socket | null = null; private timer: ReturnType<typeof setInterval> | null = null; private lastAt = 0; private started = false;

	start(destroyRef?: DestroyRef): void {
		if (!this.browser || this.started) return; this.started = true;
		this.refresh();
		this.connect();
		document.addEventListener('visibilitychange', this.onVisible);
		window.addEventListener('online', this.onVisible);
		this.timer = setInterval(() => this.refresh(), PLATFORM_STATE_POLL_MS);
		destroyRef?.onDestroy(() => this.stop());
	}
	stop(): void {
		this.started = false; this.socket?.disconnect(); this.socket = null; if (this.timer) clearInterval(this.timer); this.timer = null;
		if (typeof document !== 'undefined') { document.removeEventListener('visibilitychange', this.onVisible); window.removeEventListener('online', this.onVisible); }
	}
	private readonly onVisible = () => { if (typeof document === 'undefined' || document.visibilityState === 'visible') this.refresh(); };

	/** GET /public/platform-state (never cached). A failed read changes nothing: the last known state stays until a real answer arrives. */
	refresh(): void {
		this.http.get<{ success: boolean; data: PlatformState }>(`${environment.url_api}/public/platform-state`).subscribe({ next: r => this.apply(r.data), error: () => undefined });
	}
	apply(s: PlatformState | null | undefined): void {
		if (!s?.maintenance || typeof s.at !== 'number' || s.at < this.lastAt) return;
		this.lastAt = s.at; this.info.applyMaintenance(s.maintenance.on === true, String(s.maintenance.message ?? ''));
	}
	private connect(): void {
		// anonymous on purpose: the public state needs no identity, and a stale token must never get this connection refused
		const s = io(environment.socketUrl, { ...SOCKET_BACKOFF, transports: ['websocket', 'polling'] });
		s.on('platform:state', (st: PlatformState) => this.apply(st));
		// `connect` fires on the first connection and on every reconnection: after the first, re-read the state (a push may have been missed while disconnected)
		let connected = false; s.on('connect', () => { if (connected) this.refresh(); connected = true; });
		this.socket = s;
	}
}
