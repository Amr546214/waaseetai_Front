import { DestroyRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient, HttpContext } from '@angular/common/http';
import { SKIP_LOADING } from '../interceptors/loading.interceptor';
import { isPlatformBrowser } from '@angular/common';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { SOCKET_BACKOFF } from '../utils/socket-backoff';
import { PlatformInfoService } from './platform-info.service';

interface PlatformState {
  maintenance: { on: boolean; message: string };
  revision: number;
  at?: number;
}
export const PLATFORM_STATE_POLL_MS = 5_000;

/**
 * Keeps the open browser in step with the server's maintenance state WITHOUT a click or a page reload:
 *  - the server pushes `platform:state` over Socket.IO the moment a save commits (and on every (re)connection);
 *  - the state is also READ when the site opens, when the socket reconnects, when the tab becomes visible again, and by a light fallback poll (every five seconds) in case the push is missed;
 *  - an older answer never overwrites a newer one (the committed database revision is compared), and turning maintenance off simply shows the site again (no reload, so no reload loop).
 * Nothing secret is carried: the payload is {maintenance:{on,message}, revision, at}.
 */
@Injectable({ providedIn: 'root' })
export class PlatformStateService {
  private readonly http = inject(HttpClient);
  private readonly destroy = inject(DestroyRef);
  private readonly info = inject(PlatformInfoService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private socket: Socket | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private epoch = 0;

  start(destroyRef?: DestroyRef): void {
    if (!this.browser || this.started) return;
    this.started = true;
    this.refresh();
    this.connect();
    document.addEventListener('visibilitychange', this.onVisible);
    window.addEventListener('online', this.onVisible);
    this.timer = setInterval(() => this.refresh(), PLATFORM_STATE_POLL_MS);
    destroyRef?.onDestroy(() => this.stop());
  }
  stop(): void {
    this.started = false;
    this.epoch++;
    this.socket?.disconnect();
    this.socket = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisible);
      window.removeEventListener('online', this.onVisible);
    }
  }
  private readonly onVisible = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') this.refresh();
  };

  /** Background GET /public/platform-state (never cached, never covers the current page). A failed read changes nothing: the last known state stays until a real answer arrives. */
  refresh(): void {
    const epoch = this.epoch;
    this.http
      .get<{ success: boolean; data: PlatformState }>(
        `${environment.url_api}/public/platform-state`,
        { context: new HttpContext().set(SKIP_LOADING, true) },
      )
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          if (epoch === this.epoch) this.apply(r.data);
        },
        error: () => undefined,
      });
  }
  apply(s: PlatformState | null | undefined): void {
    if (
      !s?.maintenance ||
      !this.info.applyState(
        s.maintenance.on === true,
        String(s.maintenance.message || ''),
        s.revision,
      )
    )
      return;
    if (this.info.publicRevision() < s.revision) this.info.load();
  }

  private connect(): void {
    // anonymous on purpose: the public state needs no identity, and a stale token must never get this connection refused
    const s = io(environment.socketUrl, {
      ...SOCKET_BACKOFF,
      transports: ['websocket', 'polling'],
    });
    s.on('platform:state', (st: PlatformState) => this.apply(st));
    // `connect` fires on the first connection and on every reconnection: after the first, re-read the state (a push may have been missed while disconnected)
    let connected = false;
    s.on('connect', () => {
      if (connected) this.refresh();
      connected = true;
    });
    this.socket = s;
  }
}
