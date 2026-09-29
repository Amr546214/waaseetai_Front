import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'AWAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';

export interface SupportTicket {
	id: string;
	ticketNumber: string;
	userId: string;
	subject: string;
	category: string;
	priority: string;
	description: string;
	relatedOrder?: string | null;
	relatedProject?: string | null;
	relatedMember?: string | null;
	ccEmail?: string | null;
	status: TicketStatus;
	resolvedAt?: string | null;
	closedAt?: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface SupportTicketMessage {
	id: string;
	ticketId: string;
	senderId: string;
	sender?: { id: string; firstName: string; lastName: string };
	body: string;
	createdAt: string;
}

export interface CreateTicketPayload {
	subject: string;
	category: string;
	priority?: string;
	description: string;
	relatedOrder?: string;
	relatedProject?: string;
	relatedMember?: string;
	ccEmail?: string;
}

export interface TicketListData {
	items: SupportTicket[];
	pagination: { page: number; limit: number; total: number; pages: number };
}

export interface TicketDetailData {
	ticket: SupportTicket;
	messages: SupportTicketMessage[];
}

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	message?: string;
}

@Injectable({ providedIn: 'root' })
export class TicketApiService {
	private http = inject(HttpClient);

	private baseFor(role: 'client' | 'provider'): string {
		return `${environment.url_api}/${role}/tickets`;
	}

	createTicket(role: 'client' | 'provider', payload: CreateTicketPayload): Observable<ApiResponse<SupportTicket>> {
		return this.http.post<ApiResponse<SupportTicket>>(this.baseFor(role), payload);
	}

	listTickets(role: 'client' | 'provider', status?: TicketStatus): Observable<ApiResponse<TicketListData>> {
		let params = new HttpParams().set('limit', 50);
		if (status) params = params.set('status', status);
		return this.http.get<ApiResponse<TicketListData>>(this.baseFor(role), { params });
	}

	getTicket(role: 'client' | 'provider', id: string): Observable<ApiResponse<TicketDetailData>> {
		return this.http.get<ApiResponse<TicketDetailData>>(`${this.baseFor(role)}/${id}`);
	}

	replyToTicket(role: 'client' | 'provider', id: string, body: string): Observable<ApiResponse<SupportTicketMessage>> {
		return this.http.post<ApiResponse<SupportTicketMessage>>(`${this.baseFor(role)}/${id}/reply`, { body });
	}

	closeTicket(role: 'client' | 'provider', id: string): Observable<ApiResponse<SupportTicket>> {
		return this.http.post<ApiResponse<SupportTicket>>(`${this.baseFor(role)}/${id}/close`, {});
	}
}
