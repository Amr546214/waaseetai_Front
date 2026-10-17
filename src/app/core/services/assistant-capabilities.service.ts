import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../store/auth.store';
import { SKIP_LOADING } from '../interceptors/loading.interceptor';

export interface AssistantCapabilities {
	models: Array<{ id: string; label?: string; modalities?: string[]; efforts?: string[]; available?: boolean }>;
	voices: Array<{ id: string; label?: string }>;
	stt?: { available: boolean; maxBytes?: number };
	webSearch?: { available: boolean; provider: 'google'; reason?: string };
	live?: { available: boolean; models?: string[]; tokenMaxSeconds?: number };
	defaultTextModel?: string;
	defaultTtsModel?: string;
}
export interface AssistantLiveToken {
	token: string;
	expiresAt?: string;
	newSessionExpiresAt?: string;
	model: string;
	voice: string;
	wsUrl: string;
	sessionConfig: { setup: Record<string, unknown> };
}
/** The platform proxy and upstream service use different envelopes. */
export function assistantData<T>(response: T | { data: T }): T {
	return response && typeof response === 'object' && 'data' in response ? response.data : response as T;
}
@Injectable({ providedIn: 'root' })
export class AssistantCapabilitiesService {
	private readonly http = inject(HttpClient);
	private readonly auth = inject(AuthStore);
	private options() { return { headers: new HttpHeaders({ Authorization: `Bearer ${this.auth.token() ?? ''}` }), context: new HttpContext().set(SKIP_LOADING, true) }; }
	get(): Observable<AssistantCapabilities> { return this.http.get<AssistantCapabilities | {data:AssistantCapabilities}>(`${environment.url_api}/help-assistant/capabilities`, this.options()).pipe(map(assistantData<AssistantCapabilities>)); }
	transcribe(audioBase64: string, mimeType: string, language: string): Observable<{ text?: string; transcript?: string; data?: { text?: string; transcript?: string } }> { return this.http.post<any>(`${environment.url_api}/help-assistant/stt`, { audioBase64, mimeType, languageCodes: [language], mode: 'verbatim' }, this.options()); }
	liveToken(options: { model?: string; voice?: string; language?: string } = {}): Observable<AssistantLiveToken> { return this.http.post<AssistantLiveToken | {data:AssistantLiveToken}>(`${environment.url_api}/help-assistant/live-token`, options, this.options()).pipe(map(assistantData<AssistantLiveToken>)); }
}
