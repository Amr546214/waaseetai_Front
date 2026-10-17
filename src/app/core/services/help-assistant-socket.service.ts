import { Injectable, InjectionToken, NgZone, OnDestroy, PLATFORM_ID, effect, inject, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import io, { Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../store/auth.store';
import { isObsoleteKnowledgeRefusal, normalizeAssistantError } from '../help/assistant-errors';

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
	url?: string;
	section?: string;
	line?: number;
}

export interface AssistantAskOptions {
	skin?: string;
	dialect?: string;
	language?: string;
	effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
	profile?: 'fast' | 'balanced' | 'deep' | 'auto';
	model?: string;
	webSearch?: boolean;
	pageContext?: { path: string; projectId?: string };
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
	| { type: 'progress'; clientRequestId: string; runId?: string; stage: string; message: string; status?: string }
	| { type: 'start'; clientRequestId: string }
	| { type: 'chunk'; clientRequestId: string; chunk: string }
	| { type: 'citations'; clientRequestId: string; citations: HelpCitation[]; searchSuggestionsHtml?: string }
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
	/** A small tail catches a legacy refusal even when the gateway splits it between chunks. */
	private readonly answerTails = new Map<string, string>();
	private readonly suppressedAnswers = new Set<string>();

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
	ask(question: string, history: HelpChatHistoryTurn[] = [], options: AssistantAskOptions = {}): string | null {
		if (!this.isBrowser) return null;
		const clientRequestId = newRequestId();
		const s = this.ensureSocket();
		if (!s) {
			this.publish({ type: 'error', clientRequestId, code: 'AUTH_REQUIRED', message: HELP_AUTH_REQUIRED_MESSAGE, humanSupportFallback: false });
			return null;
		}
		s.emit('help:ask', { question, history, clientRequestId, ...options });
		return clientRequestId;
	}

	/** Asks the backend to abort an in-flight answer (e.g. panel closed). */
	cancel(clientRequestId: string | null): void {
		if (!clientRequestId || !this.socket) return;
		this.socket.emit('help:cancel', { clientRequestId });
		this.answerTails.delete(clientRequestId);
		this.suppressedAnswers.delete(clientRequestId);
	}

	disconnect(): void {
		this.answerTails.clear();
		this.suppressedAnswers.clear();
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
		const s = this.connectSocket((environment as { assistantSocketUrl?: string }).assistantSocketUrl ?? environment.socketUrl, {
			withCredentials: true,
			reconnection: true,
			auth: { token },
		});
		this.socket = s;

		s.on('help:answer_start', (d: any) => {
			const clientRequestId = str(d?.clientRequestId);
			this.answerTails.delete(clientRequestId);
			this.suppressedAnswers.delete(clientRequestId);
			this.publish({ type: 'start', clientRequestId });
		});
		s.on('help:progress', (d: any) => this.publish({ type: 'progress', clientRequestId: str(d?.clientRequestId), runId: str(d?.runId) || undefined, stage: str(d?.stage), message: str(d?.message), status: str(d?.status) || undefined }));
		s.on('help:answer_chunk', (d: any) => {
			if (typeof d?.chunk !== 'string') return;
			const clientRequestId = str(d?.clientRequestId);
			if (this.suppressedAnswers.has(clientRequestId)) return;
			const tail = (this.answerTails.get(clientRequestId) ?? '') + d.chunk;
			if (isObsoleteKnowledgeRefusal(tail)) {
				this.answerTails.delete(clientRequestId);
				if (this.suppressedAnswers.size >= 16) this.suppressedAnswers.delete(this.suppressedAnswers.values().next().value!);
				this.suppressedAnswers.add(clientRequestId);
				this.publish({ type: 'error', clientRequestId, ...normalizeAssistantError({ code: 'NO_ANSWER' }), code: 'UNAVAILABLE' });
				return;
			}
			// Only a bounded suffix is retained; normal answers continue to stream immediately.
			if (this.answerTails.size >= 16 && !this.answerTails.has(clientRequestId)) this.answerTails.delete(this.answerTails.keys().next().value!);
			this.answerTails.set(clientRequestId, tail.slice(-256));
			this.publish({ type: 'chunk', clientRequestId, chunk: d.chunk });
		});
		s.on('help:citations', (d: any) => {
			const citations = Array.isArray(d?.citations)
				? d.citations.map((c: any) => ({ docId: str(c?.docId), title: str(c?.title), ...(typeof c?.url === 'string' ? { url: c.url } : {}), ...(typeof c?.section === 'string' ? { section: c.section } : {}), ...(Number.isInteger(c?.line) && c.line > 0 ? { line: c.line } : {}) })).filter((c: HelpCitation) => c.title)
				: [];
			this.publish({ type: 'citations', clientRequestId: str(d?.clientRequestId), citations, ...(typeof d?.searchSuggestionsHtml === 'string' && d.searchSuggestionsHtml.length <= 64_000 ? { searchSuggestionsHtml: d.searchSuggestionsHtml } : {}) });
		});
		s.on('help:answer_complete', (d: any) => {
			const clientRequestId = str(d?.clientRequestId);
			this.answerTails.delete(clientRequestId);
			if (this.suppressedAnswers.delete(clientRequestId)) return;
			this.publish({ type: 'complete', clientRequestId });
		});
		s.on('help:error', (d: any) => {
			const normalized = normalizeAssistantError({ code: str(d?.code), message: str(d?.message), humanSupportFallback: d?.humanSupportFallback === true });
			if (typeof d?.clientRequestId === 'string') this.answerTails.delete(d.clientRequestId);
			this.publish({
				type: 'error',
				clientRequestId: typeof d?.clientRequestId === 'string' ? d.clientRequestId : null,
				...normalized,
				code: normalized.code as HelpErrorCode,
			});
		});
		s.on('disconnect', () => this.publish({ type: 'connection_lost' }));
		s.on('connect_error', () => this.publish({ type: 'connection_lost' }));
		return s;
	}

	private publish(event: HelpStreamEvent): void {
		this.zone.run(() => this.eventsSubject.next(event));
	}
}
