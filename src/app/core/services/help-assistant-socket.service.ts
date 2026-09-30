import { Injectable, InjectionToken, NgZone, OnDestroy, PLATFORM_ID, effect, inject, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import io, { Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../store/auth.store';

// Transport for the ONE real Help AI engine (backend
// sockets/help-assistant-chat.gateway.ts → WaseetAI AI-21 help stream).
// Used by the dashboard Avatar widget and the help pages alike.
//
// Authenticated only: the socket is opened with the application's JWT from
// AuthStore in the Socket.IO handshake (`auth.token`), and the backend
// re-validates the user + session on every question. Without a token no
// socket is opened at all — there is no guest path. If the token changes
// (logout/login, role switch) the old connection is closed right away and a
// new one is opened with the new token on the next question.
//
// Text only: voice is NOT carried on this socket (the legacy `help:audio`
// OpenAI path was removed). Speech comes from AssistantTtsService →
// authenticated POST /api/help-assistant/tts → WaseetAI TTS.
//
// Multi-consumer: every server event is published on `events$` tagged with
// the `clientRequestId` of the question it belongs to, so the widget and a
// page can both listen without stealing each other's listeners.

export interface HelpChatHistoryTurn {
	question: string;
	answer: string;
}

export interface HelpCitation {
	docId: string;
	title: string;
}

export type HelpErrorCode =
	| 'AUTH_REQUIRED'
	| 'FORBIDDEN'
	| 'INVALID_INPUT'
	| 'RATE_LIMITED'
	| 'NOT_CONFIGURED'
	| 'NO_ANSWER'
	| 'TIMEOUT'
	| 'UNAVAILABLE'
	| 'CONNECTION_LOST';

export type HelpStreamEvent =
	| { type: 'start'; clientRequestId: string }
	| { type: 'chunk'; clientRequestId: string; chunk: string }
	| { type: 'citations'; clientRequestId: string; citations: HelpCitation[] }
	| { type: 'complete'; clientRequestId: string }
	| { type: 'error'; clientRequestId: string | null; code: HelpErrorCode; message: string; humanSupportFallback: boolean }
	/** Transport-level: the socket dropped or could not connect. */
	| { type: 'connection_lost' };

export const HELP_AUTH_REQUIRED_MESSAGE = 'يجب تسجيل الدخول لاستخدام المساعد الذكي.';

/** Socket.IO client factory (the real `io`); a DI seam so tests never open a real connection. */
export const HELP_SOCKET_IO = new InjectionToken<typeof io>('HELP_SOCKET_IO', { providedIn: 'root', factory: () => io });

function newRequestId(): string {
	const c = (globalThis as { crypto?: Crypto }).crypto;
	if (c?.randomUUID) return c.randomUUID();
	return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

@Injectable({ providedIn: 'root' })
export class HelpAssistantSocketService implements OnDestroy {
	private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly authStore = inject(AuthStore);
	private readonly zone = inject(NgZone);
	private readonly connectSocket = inject(HELP_SOCKET_IO);

	private socket: Socket | null = null;
	private socketToken: string | null = null;
	private readonly eventsSubject = new Subject<HelpStreamEvent>();

	readonly events$: Observable<HelpStreamEvent> = this.eventsSubject.asObservable();

	constructor() {
		// Session isolation: a socket authenticated as one user must not
		// outlive that session. On logout or any token change the old
		// connection is closed immediately (the backend aborts its in-flight
		// answer on disconnect) instead of lingering until the next question.
		effect(() => {
			const token = this.authStore.token();
			untracked(() => {
				if (this.socket && this.socketToken !== token) this.disconnect();
			});
		});
	}

	/**
	 * Sends a question. Returns its clientRequestId, or null when nothing was
	 * sent (SSR, or no authenticated session — an `error` event with
	 * AUTH_REQUIRED is published in that case).
	 */
	ask(question: string, history: HelpChatHistoryTurn[] = []): string | null {
		if (!this.isBrowser) return null;
		const clientRequestId = newRequestId();
		const s = this.ensureSocket();
		if (!s) {
			this.publish({ type: 'error', clientRequestId, code: 'AUTH_REQUIRED', message: HELP_AUTH_REQUIRED_MESSAGE, humanSupportFallback: false });
			return null;
		}
		s.emit('help:ask', { question, history, clientRequestId });
		return clientRequestId;
	}

	/** Asks the backend to abort an in-flight answer (e.g. panel closed). */
	cancel(clientRequestId: string | null): void {
		if (!clientRequestId || !this.socket) return;
		this.socket.emit('help:cancel', { clientRequestId });
	}

	disconnect(): void {
		if (this.socket) {
			this.socket.removeAllListeners();
			this.socket.disconnect();
			this.socket = null;
			this.socketToken = null;
		}
	}

	ngOnDestroy(): void {
		this.disconnect();
		this.eventsSubject.complete();
	}

	private ensureSocket(): Socket | null {
		const token = this.authStore.token();
		if (!token) {
			this.disconnect();
			return null;
		}
		if (this.socket && this.socketToken === token) return this.socket;

		this.disconnect();
		this.socketToken = token;
		const s = this.connectSocket(environment.socketUrl, {
			withCredentials: true,
			reconnection: true,
			auth: { token },
		});
		this.socket = s;

		s.on('help:answer_start', (d: any) => this.publish({ type: 'start', clientRequestId: str(d?.clientRequestId) }));
		s.on('help:answer_chunk', (d: any) => {
			if (typeof d?.chunk === 'string') this.publish({ type: 'chunk', clientRequestId: str(d?.clientRequestId), chunk: d.chunk });
		});
		s.on('help:citations', (d: any) => {
			const citations = Array.isArray(d?.citations)
				? d.citations.map((c: any) => ({ docId: str(c?.docId), title: str(c?.title) })).filter((c: HelpCitation) => c.title)
				: [];
			this.publish({ type: 'citations', clientRequestId: str(d?.clientRequestId), citations });
		});
		s.on('help:answer_complete', (d: any) => this.publish({ type: 'complete', clientRequestId: str(d?.clientRequestId) }));
		s.on('help:error', (d: any) =>
			this.publish({
				type: 'error',
				clientRequestId: typeof d?.clientRequestId === 'string' ? d.clientRequestId : null,
				code: (str(d?.code) || 'UNAVAILABLE') as HelpErrorCode,
				message: str(d?.message) || 'تعذر الحصول على رد من المساعد الذكي حالياً.',
				humanSupportFallback: d?.humanSupportFallback === true,
			}),
		);
		s.on('disconnect', () => this.publish({ type: 'connection_lost' }));
		s.on('connect_error', () => this.publish({ type: 'connection_lost' }));
		return s;
	}

	private publish(event: HelpStreamEvent): void {
		this.zone.run(() => this.eventsSubject.next(event));
	}
}
