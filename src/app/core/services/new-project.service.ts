import { Injectable, inject, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import io, { Socket } from 'socket.io-client';

export interface ProviderPreData {
	skills: any[];
	portfolioItems: any[];
}

export interface AiReviewEvaluation {
	clarityScore: number;
	feasibilityScore: number;
	marketFitRating: 'High' | 'Medium' | 'Low';
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
	};
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
				reconnection: true,
				auth: { token }
			});
			console.log('🔌 Connected to AI Review Stream WebSocket');
		}
		return this.socket;
	}

	streamSuggestText(title: string): void {
		const s = this.initSocket();
		if (!s) return;
		s.emit('stream_ai_suggest_text', { title });
	}

	streamEnhanceDescription(title: string, description: string): void {
		const s = this.initSocket();
		if (!s) return;
		s.emit('stream_ai_enhance_description', { title, description });
	}

	onStreamStart(callback: (data: { mode: string }) => void): void {
		const s = this.initSocket();
		if (!s) return;
		s.off('ai_text_stream_start');
		s.on('ai_text_stream_start', callback);
	}

	onStreamChunk(callback: (data: { chunk: string; mode: string }) => void): void {
		const s = this.initSocket();
		if (!s) return;
		s.off('ai_text_stream_chunk');
		s.on('ai_text_stream_chunk', callback);
	}

	onStreamEnd(callback: (data: { mode: string; message: string }) => void): void {
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

	getMyMarketModels(params?: any): Observable<any> {
		return this.http.get<any>(`${environment.url_api}/business-models/my-market-models`, { params });
	}

	suggestMilestones(title: string, description?: string, totalAmount?: number): Observable<{ success: boolean; data: { milestones: any[] } }> {
		return this.http.post<any>(`${this.AI_REVIEW_URL}/suggest-milestones`, { title, description, totalAmount });
	}

	analyzeProjectModel(payload: any): Observable<{ success: boolean; data: AiReviewEvaluation }> {
		return this.http.post<any>(`${this.AI_REVIEW_URL}/analyze`, payload);
	}

	uploadGalleryImage(file: File): Observable<any> {
		const formData = new FormData();
		formData.append('attachments', file);
		return this.http.post<any>(`${this.API_URL}/upload-gallery`, formData);
	}
}
