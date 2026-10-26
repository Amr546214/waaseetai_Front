import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminAuditEntry {
	id: string;
	eventType: string;
	category: string;
	title: string;
	summary: string | null;
	severity: 'INFO' | 'WARNING' | 'CRITICAL' | string;
	source: string;
	status: string;
	occurredAt: string;
	ipAddress: string | null;
	device: string | null;
	actorLabel: string | null;
	account: { id: string; name: string; accountType: string | null };
	/** the audit trail's own identity of the event (see the server's admin-audit-trail service) */
	seq?: number | null;
	action?: string;
	actionLabel?: string;
	detail?: string | null;
	detailDate?: string | null;
	origin?: 'LOG' | 'ACCESS';
	actor?: { id: string; name: string; accountType: string | null };
	target?: { type: string; typeLabel: string; id: string | null; label: string | null } | null;
}
export interface AdminAuditLogPage {
	items: AdminAuditEntry[];
	pagination: { page: number; limit: number; total: number; pages: number };
	eventTypes: string[];
	eventTypeOptions?: { value: string; label: string }[];
}
export interface AdminAuditQuery { page?: number; limit?: number; q?: string; eventType?: string; severity?: string; actorId?: string; from?: string; to?: string; scope?: 'admin' | 'all' }
export interface AdminRosterItem { id: string; name: string; email: string; accountType: 'ADMIN' | 'SUPER_ADMIN' | string; status: string; lastActiveAt: string | null; createdAt: string }
export interface AdminSelfProfile { id: string; firstName: string; lastName: string; email: string; accountType: string; phoneCountryCode: string | null; phoneNumber: string | null; avatarUrl: string | null }
export interface AdminSession { id: string; browser?: string | null; os?: string | null; device?: string | null; ipAddress?: string | null; lastActiveAt: string; createdAt: string; isCurrent: boolean }
interface Envelope<T> { success: boolean; data: T; message?: string }

/** Admin / super-admin console endpoints: real audit log, admin roster, own profile and sessions (all gated to ADMIN/SUPER_ADMIN on the server). */
@Injectable({ providedIn: 'root' })
export class AdminConsoleApiService {
	private readonly http = inject(HttpClient);
	private readonly base = `${environment.url_api}/admin/console`;

	getAuditLog(q: AdminAuditQuery): Observable<Envelope<AdminAuditLogPage>> {
		let params = new HttpParams();
		for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '' && v !== null) params = params.set(k, String(v));
		return this.http.get<Envelope<AdminAuditLogPage>>(`${this.base}/audit-log`, { params });
	}
	getAdmins(): Observable<Envelope<AdminRosterItem[]>> { return this.http.get<Envelope<AdminRosterItem[]>>(`${this.base}/admins`); }
	getMe(): Observable<Envelope<AdminSelfProfile>> { return this.http.get<Envelope<AdminSelfProfile>>(`${this.base}/account/me`); }
	updateMe(body: { firstName?: string; lastName?: string; phoneCountryCode?: string; phoneNumber?: string | null }): Observable<Envelope<AdminSelfProfile>> {
		return this.http.patch<Envelope<AdminSelfProfile>>(`${this.base}/account/me`, body);
	}
	getSessions(): Observable<Envelope<AdminSession[]>> { return this.http.get<Envelope<AdminSession[]>>(`${this.base}/account/sessions`); }
	terminateSession(id: string): Observable<Envelope<{ revoked: number }>> { return this.http.delete<Envelope<{ revoked: number }>>(`${this.base}/account/sessions/${id}`); }
	terminateOtherSessions(): Observable<Envelope<{ revoked: number }>> { return this.http.delete<Envelope<{ revoked: number }>>(`${this.base}/account/sessions`); }
	changePassword(body: { currentPassword: string; newPassword: string }): Observable<Envelope<{ changedAt: string }>> {
		return this.http.put<Envelope<{ changedAt: string }>>(`${environment.url_api}/provider/profile/password`, body);
	}
}
