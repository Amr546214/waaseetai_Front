import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AccountAuditLog {
	id: string;
	userId: string;
	category: 'ROLE_ADDITION' | 'PROFILE_COMPLETION' | 'SECURITY_CHANGE' | 'SYSTEM_AUDIT';
	eventType: string;
	title: string;
	actionText: string;
	status: 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
	statusText?: string;
	canResubmit: boolean;
	metaData?: any;
	createdAt: string;
	summary?: string;
	source?: 'USER' | 'AI' | 'ADMIN' | 'SYSTEM';
	severity?: 'INFO' | 'WARNING' | 'CRITICAL';
	occurredAt?: string;
	ipAddress?: string | null;
	device?: string | null;
	hasDetails?: boolean;
}

export interface AuditLogQuery { page?: number; limit?: number; category?: string; status?: string; source?: string; search?: string; from?: string; to?: string }

@Injectable({ providedIn: 'root' })
export class AccountLogsService {
	private apiUrl = environment.url_api;

	constructor(private http: HttpClient) { }

	getUserLogs(query: AuditLogQuery = {}): Observable<any> {
		const params = Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== '')) as Record<string, string>;
		return this.http.get<any>(`${this.apiUrl}/provider/logs`, { params });
	}

	getUserLog(id: string): Observable<any> { return this.http.get<any>(`${this.apiUrl}/provider/logs/${id}`); }
}
