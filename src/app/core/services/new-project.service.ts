import { SOCKET_BACKOFF } from '../utils/socket-backoff';
import { Injectable, inject, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpContext } from '@angular/common/http';
import { SKIP_LOADING } from '../interceptors/loading.interceptor';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import io, { Socket } from 'socket.io-client';

export interface ProviderPreData {
	skills: any[];
	portfolioItems: any[];
}

// Backend (/api/ai-review/analyze) is backed by WaseetAI project-analysis.
// WaseetAI does not return a pricing strategy or improvement list, and its
// market-fit rating is only passed through when it is exactly High/Medium/Low
// — otherwise these are honestly null/empty and the UI hides them.
export interface AiReviewEvaluation {
	clarityScore: number;
	feasibilityScore: number | null;
	marketFitRating: 'High' | 'Medium' | 'Low' | null;
	executiveSummary: string;
	strengths: string[];
	gapsAndRisks: string[];
	recommendedImprovements: string[];
	suggestedMilestones: {
		title: string;
		estimatedDays: number;
		description: string;
		percentage?: number;
	}[];
	suggestedPricingStrategy: {
		recommendedRange: string;
		reasoning: string;
	} | null;
}

export interface AiTextCandidate { id: string; text: string; length?: number; trimmed?: boolean }
export interface AiTextStreamEnd {
	mode: string; message: string; error?: boolean; code?: string; requestId?: string;
	candidates?: AiTextCandidate[]; limit?: number;
}

@Injectable({
	providedIn: 'root'
})
export class NewProjectService implements OnDestroy {
	private http = inject(HttpClient);
	private platformId = inject(PLATFORM_ID);
	private isBrowser = isPlatformBrowser(this.platformId);
	private readonly API_URL = `${environment.url_api}/provider/services`;
	private readonly AI_REVIEW_URL = `${environment.url_api}/ai-review`;
	private socket: Socket | null = null;

	// Returns null during SSR: this is a browser-only real-time transport, and
	// `new-project.ts`'s `ngOnInit()` calls this unconditionally, which also
	// runs during server rendering — without this guard every SSR render of
	// that page opened a real outbound socket.io connection from the Node
	// render process that nothing ever closed.
	initSocket(): Socket | null {
		if (!this.isBrowser) return null;

		if (!this.socket) {
			let token: string | null = null;
			if (typeof window !== 'undefined') {
				token = localStorage.getItem('waseet_token') || localStorage.getItem('access_token') || localStorage.getItem('token');
				if (!token && typeof document !== 'undefined') {
					token = document.cookie.match(/(?:^|;\s*)waseet_token=([^;]+)/)?.[1] || null;
				}
			}
			this.socket = io(environment.socketUrl, {
				withCredentials: true,
				...SOCKET_BACKOFF,
				auth: { token }
			});
			console.log('🔌 Connected to AI Review Stream WebSocket');
		}
		return this.socket;
	}

	/** `requestId` correlates every event of this request; the page ignores events carrying any other id. */
	streamSuggestText(title: string, requestId?: string): void {
		const s = this.initSocket();
		if (!s) return;
		s.emit('stream_ai_suggest_text', { title, ...(requestId ? { requestId } : {}) });
	}

	streamEnhanceDescription(title: string, description: string, requestId?: string): void {
		const s = this.initSocket();
		if (!s) return;
		s.emit('stream_ai_enhance_description', { title, description, ...(requestId ? { requestId } : {}) });
	}

	/** Stops the running stream server-side (retry / navigation); the server then emits nothing more for it. */
	cancelStream(requestId?: string): void {
		this.socket?.emit('ai_text_stream_cancel', requestId ? { requestId } : {});
	}

	onStreamStart(callback: (data: { mode: string; requestId?: string }) => void): void {
		const s = this.initSocket();
		if (!s) return;
		s.off('ai_text_stream_start');
		s.on('ai_text_stream_start', callback);
	}

	onStreamChunk(callback: (data: { chunk: string; mode: string; requestId?: string }) => void): void {
		const s = this.initSocket();
		if (!s) return;
		s.off('ai_text_stream_chunk');
		s.on('ai_text_stream_chunk', callback);
	}

	/**
	 * `error`/`code` are set by the backend only when the stream FAILED (absent on success and on older backends).
	 * A successful end of a current backend carries `candidates` (each already within `limit`); an older backend sends none.
	 */
	onStreamEnd(callback: (data: AiTextStreamEnd) => void): void {
		const s = this.initSocket();
		if (!s) return;
		s.off('ai_text_stream_end');
		s.on('ai_text_stream_end', callback);
	}

	disconnectSocket(): void {
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
		}
	}

	ngOnDestroy(): void {
		this.disconnectSocket();
	}

	getPreData(): Observable<ProviderPreData> {
		return this.http.get<ProviderPreData>(`${this.API_URL}/pre-data`);
	}

	publishService(data: any): Observable<any> {
		return this.http.post<any>(this.API_URL, data);
	}

	getServiceById(id: string): Observable<any> {
		return this.http.get<any>(`${this.API_URL}/${id}`);
	}

	updateService(id: string, data: any): Observable<any> {
		return this.http.put<any>(`${this.API_URL}/${id}`, data);
	}

	setServiceVisibility(id: string, visible: boolean): Observable<any> {
		return this.http.patch<any>(`${this.API_URL}/${id}/visibility`, { visible });
	}

	getMyMarketModels(params?: any, silent = false): Observable<any> {
		return this.http.get<any>(`${environment.url_api}/business-models/my-market-models`, {
			params,
			...(silent ? { context: new HttpContext().set(SKIP_LOADING, true) } : {})
		});
	}

	suggestMilestones(title: string, description?: string, totalAmount?: number): Observable<{ success: boolean; data: { milestones: any[] } }> {
		return this.http.post<any>(
			`${this.AI_REVIEW_URL}/suggest-milestones`,
			{ title, description, totalAmount },
			{ context: new HttpContext().set(SKIP_LOADING, true) }
		);
	}

	analyzeProjectModel(payload: any): Observable<{ success: boolean; data: AiReviewEvaluation }> {
		return this.http.post<any>(
			`${this.AI_REVIEW_URL}/analyze`,
			payload,
			{ context: new HttpContext().set(SKIP_LOADING, true) }
		);
	}

	uploadGalleryImage(file: File): Observable<any> {
		const formData = new FormData();
		formData.append('attachments', file);
		return this.http.post<any>(`${this.API_URL}/upload-gallery`, formData);
	}
}
