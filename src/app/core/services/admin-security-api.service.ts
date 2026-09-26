import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SecurityEventItem {
	id: string;
	category: string;
	eventType: string;
	title: string;
	summary: string | null;
	severity: string;
	source: string;
	status: string;
	occurredAt: string;
	ipAddress: string | null;
	device: string | null;
	actorLabel: string | null;
}

export interface SecurityEventsResponse {
	success: boolean;
	data: {
		events: SecurityEventItem[];
		kpis: {
			totalEventsToday: number;
			criticalOrWarningToday: number;
			failedLoginAttemptsToday: number;
		};
	};
}

export interface FlaggedAccountItem {
	userId: string;
	name: string;
	accountType: string;
	status: string;
	openDisputesAgainst: number;
	openDisputesOpened: number;
}

export interface FlaggedAccountsResponse {
	success: boolean;
	data: FlaggedAccountItem[];
}

// Batch 7: real replacement for sa-security.ts's hardcoded event feed and
// fabricated KPIs. GET /admin/security/events reads AccountAuditLog —
// real, already-populated security events (logins, password changes,
// sensitive-change verification, etc.) — never a fake generated feed.
@Injectable({ providedIn: 'root' })
export class AdminSecurityApiService {
	private http = inject(HttpClient);
	private readonly baseUrl = environment.url_api;

	getSecurityEvents(): Observable<SecurityEventsResponse> {
		return this.http.get<SecurityEventsResponse>(`${this.baseUrl}/admin/security/events`);
	}

	// Batch 7: real replacement for sa-risk-center.ts's hardcoded
	// riskAccounts/fraudPatterns/blockedIps — real suspended accounts and
	// their real open-dispute counts, never a fabricated risk score.
	getFlaggedAccounts(): Observable<FlaggedAccountsResponse> {
		return this.http.get<FlaggedAccountsResponse>(`${this.baseUrl}/admin/security/flagged-accounts`);
	}
}
