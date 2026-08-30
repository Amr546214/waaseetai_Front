import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import io, { Socket } from 'socket.io-client';

export interface ProviderPreData {
	skills: any[];
	portfolioItems: any[];
}

export interface AiAuditResult {
	score: number;
	feedback: any[];
	marketComparison: {
		priceRange: { min: number; max: number };
		daysRange: { min: number; max: number };
	};
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
export class NewProjectService {
	private http = inject(HttpClient);
	private readonly API_URL = `${environment.url_api}/provider/services`;
	private readonly AI_REVIEW_URL = `${environment.url_api}/ai-review`;
	private socket: Socket | null = null;

	initSocket(): Socket {
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
		s.emit('stream_ai_suggest_text', { title });
	}

	streamEnhanceDescription(title: string, description: string): void {
		const s = this.initSocket();
		s.emit('stream_ai_enhance_description', { title, description });
	}

	onStreamStart(callback: (data: { mode: string }) => void): void {
		const s = this.initSocket();
		s.off('ai_text_stream_start');
		s.on('ai_text_stream_start', callback);
	}

	onStreamChunk(callback: (data: { chunk: string; mode: string }) => void): void {
		const s = this.initSocket();
		s.off('ai_text_stream_chunk');
		s.on('ai_text_stream_chunk', callback);
	}

	onStreamEnd(callback: (data: { mode: string; message: string }) => void): void {
		const s = this.initSocket();
		s.off('ai_text_stream_end');
		s.on('ai_text_stream_end', callback);
	}

	disconnectSocket(): void {
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
		}
	}

	getPreData(): Observable<ProviderPreData> {
		return this.http.get<ProviderPreData>(`${this.API_URL}/pre-data`);
	}

	auditWithAI(data: any): Observable<AiAuditResult> {
		return this.http.post<AiAuditResult>(`${this.API_URL}/ai-audit`, data);
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

	getCenterData(params?: any): Observable<any> {
		return this.http.get<any>(`${this.API_URL}/center`, { params });
	}

	getMyMarketModels(params?: any): Observable<any> {
		return this.http.get<any>(`${environment.url_api}/business-models/my-market-models`, { params });
	}

	// HTTP fallback AI Review Methods
	enhanceDescription(title: string, description: string): Observable<{ success: boolean; data: { text: string } }> {
		return this.http.post<any>(`${this.AI_REVIEW_URL}/enhance-description`, { title, description });
	}

	suggestText(title: string): Observable<{ success: boolean; data: { text: string } }> {
		return this.http.post<any>(`${this.AI_REVIEW_URL}/suggest-text`, { title });
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
