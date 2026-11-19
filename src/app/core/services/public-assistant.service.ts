import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_LOADING } from '../interceptors/loading.interceptor';

export type PublicAnswerKind = 'ANSWER' | 'LOGIN_REQUIRED' | 'NOT_COVERED' | 'OFF_TOPIC' | 'BUSY';
export interface PublicAnswer { kind: PublicAnswerKind; answer: string; loginRequired: boolean }
export interface PublicTurn { role: 'user' | 'assistant'; content: string }

/** The signed-out assistant: introduces the platform to a visitor. No token is sent and no account data exists on this path. */
@Injectable({ providedIn: 'root' })
export class PublicAssistantService {
	private readonly http = inject(HttpClient);

	ask(question: string, language: 'ar' | 'en', history: PublicTurn[]): Observable<PublicAnswer> {
		return this.http.post<{ success: boolean; data: PublicAnswer }>(`${environment.url_api}/public-assistant/ask`, { question, language, history: history.slice(-4) },
			{ context: new HttpContext().set(SKIP_LOADING, true) }).pipe(map(res => res.data));
	}
}
