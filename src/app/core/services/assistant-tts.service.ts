import { HttpClient, HttpContext, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../store/auth.store';
import { SKIP_LOADING } from '../interceptors/loading.interceptor';
import type { BeboDialect, BeboVoice } from '../../sheards/bebo-avatar/bebo-commands';

// WaseetAI text-to-speech for the Help Assistant / Bebo.
//
//   AssistantStore ──▶ this service ──(JWT from AuthStore)──▶
//   POST {api}/help-assistant/tts (waseetai-backend) ──▶ WaseetAI
//   /v1/ai/tts/synthesize ──▶ audio/wav bytes back here as a Blob.
//
// The browser never sees the WaseetAI bearer token: only the user's own
// application JWT is sent, and only when AuthStore has one (no guest path).
// Unsubscribing cancels the HTTP request (the backend then aborts upstream).

export type TtsFailure = 'AUTH_REQUIRED' | 'INVALID_INPUT' | 'RATE_LIMITED' | 'NOT_CONFIGURED' | 'TIMEOUT' | 'INVALID_AUDIO' | 'UNAVAILABLE';

export class AssistantTtsError extends Error {
	constructor(readonly code: TtsFailure) {
		super(code);
		this.name = 'AssistantTtsError';
	}
}

export interface TtsRequest {
	text: string;
	voice: BeboVoice;
	dialect: BeboDialect;
}

export const ASSISTANT_TTS_PATH = '/help-assistant/tts';

function failureFor(status: number): TtsFailure {
	if (status === 401 || status === 403) return 'AUTH_REQUIRED';
	if (status === 400) return 'INVALID_INPUT';
	if (status === 429) return 'RATE_LIMITED';
	if (status === 503) return 'NOT_CONFIGURED';
	if (status === 504) return 'TIMEOUT';
	return 'UNAVAILABLE';
}

@Injectable({ providedIn: 'root' })
export class AssistantTtsService {
	private readonly http = inject(HttpClient);
	private readonly authStore = inject(AuthStore);

	/** Emits one audio Blob, or errors with an AssistantTtsError. */
	synthesize(req: TtsRequest): Observable<Blob> {
		const token = this.authStore.token();
		if (!token) return throwError(() => new AssistantTtsError('AUTH_REQUIRED'));
		return this.http
			.post(`${environment.url_api}${ASSISTANT_TTS_PATH}`, { text: req.text, voice: req.voice, dialect: req.dialect }, {
				responseType: 'blob',
				headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
				context: new HttpContext().set(SKIP_LOADING, true),
			})
			.pipe(
				map((blob) => {
					if (!blob || !blob.size || !blob.type.startsWith('audio/')) throw new AssistantTtsError('INVALID_AUDIO');
					return blob;
				}),
				catchError((e: unknown) =>
					throwError(() => (e instanceof AssistantTtsError ? e : new AssistantTtsError(e instanceof HttpErrorResponse ? failureFor(e.status) : 'UNAVAILABLE'))),
				),
			);
	}
}
