import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PermissionDef { id: string; label: string; group: string; sensitive: boolean; designRow?: string }
export interface RoleTemplate { key: string; name: string; description: string; color: string; permissions: string[]; notes?: string }
export const ADMIN_DEPARTMENTS: ReadonlyArray<{ key: string; label: string; permissions: string[] }> = [
	{ key: 'users', label: 'المستخدمون', permissions: ['users.view', 'users.suspend', 'users.delete'] },
	{ key: 'disputes', label: 'النزاعات', permissions: ['disputes.view', 'disputes.note', 'disputes.assign', 'disputes.resolve'] },
	{ key: 'reports', label: 'البلاغات', permissions: ['reports.view'] },
	{ key: 'support', label: 'الدعم الفني', permissions: ['support.review', 'support.reply'] },
	{ key: 'specialties', label: 'التخصصات', permissions: ['specialties.approve', 'content.manage', 'business_models.review'] },
];
export interface StaffAccess { userId: string; version: number; status: string; role: { id: string; name: string } | null; rolePermissions: string[]; overrides: Array<{ permission: string; effect: 'GRANT' | 'DENY'; at: string }>; scoped: boolean; departments: string[]; effective: string[] }
export interface PermissionsCatalog { permissions: PermissionDef[]; groups: Record<string, string>; templates: RoleTemplate[]; superAdminOnly: string[]; ambiguities: string[]; superAdminCount?: number }
export interface AdminRoleRow { id: string; name: string; description: string | null; color: string; permissions: string[]; permissionCount: number; memberCount: number; version: number; updatedAt: string }
export interface RolePreview { roleId: string; version: number; added: string[]; removed: string[]; addedSensitive: string[]; affectedMembers: number }
export interface StaffMember { userId: string; name: string; email: string; status: 'ACTIVE' | 'SUSPENDED'; scoped: boolean; sections: string[] | null; personalChanges: number; role: { id: string; name: string; color: string } | null; joinedAt: string; lastActiveAt: string | null; activeNow: boolean; lastLoginAt: string | null; resolvedDisputes: number; avgCompletionHours: number | null; departments: string[]; version: number; openTasks: number; overdueTasks: number; doneTasks: number }
export interface PendingInvite { id: string; email: string; fullName: string; roleName: string; expiresAt: string; createdAt: string; resendCount: number }
export interface StaffList { members: StaffMember[]; pendingInvites: PendingInvite[]; counts: { total: number; activeNow: number; active: number; suspended: number; pendingInvites: number; openTasks: number; overdueTasks: number } }
export interface TaskRow { id: string; number: number; code: string; title: string; description: string | null; type: string; priority: string; status: string; overdue: boolean; dueAt: string | null; completedAt: string | null; version: number; createdAt: string; assignee: { id: string; name: string } | null; link: { type: string; id: string } | null }
export interface TaskSummary { byStatus: Record<string, number>; open: number; inProgress: number; pending: number; overdue: number; doneThisMonth: number; onTimeThisMonth: { onTime: number; of: number } | null; avgCompletionHoursThisMonth: number | null }
export interface PerformanceMember { userId: string; name: string; role: string | null; roleColor: string | null; status: string; openTasks: number; completed: number; avgCompletionHours: number | null; onTimeRate: number | null; onTimeOf: number; slaRate: null; userRating: null; overallScore: null }
export interface PerformanceReport { period: string; from: string; to: string; team: { members: number; completed: number; avgCompletionHours: number | null; onTimeRate: number | null; onTimeOf: number }; members: PerformanceMember[]; trend: Array<{ month: number; thisYear: number; lastYear: number }>; definitions: { completed: string; completionTime: string; onTime: string; unavailable: string[]; decisionsNeeded: string[] } }
export interface AccessAuditRow { id: string; at: string; action: string; actor: string | null; subject: string | null; roleId: string | null; before: unknown; after: unknown }
export interface Envelope<T> { success: boolean; data: T; message?: string }

const base = () => `${environment.url_api}/admin/team`;

/** Thin HTTP layer of the admin team (roles, staff, invitations, tasks, performance). Every rule lives on the server: nothing here decides access. */
@Injectable({ providedIn: 'root' })
export class AdminTeamService {
	private http = inject(HttpClient);
	catalog(): Observable<Envelope<PermissionsCatalog>> { return this.http.get<Envelope<PermissionsCatalog>>(`${base()}/permissions`); }
	roles(): Observable<Envelope<AdminRoleRow[]>> { return this.http.get<Envelope<AdminRoleRow[]>>(`${base()}/roles`); }
	createRole(b: { name: string; description?: string; color?: string; permissions: string[] }) { return this.http.post<Envelope<AdminRoleRow>>(`${base()}/roles`, b); }
	previewRole(id: string, permissions: string[]) { return this.http.post<Envelope<RolePreview>>(`${base()}/roles/${id}/preview`, { permissions }); }
	updateRole(id: string, b: { name?: string; description?: string | null; color?: string; permissions?: string[]; expectedVersion: number; confirmSensitive?: boolean }) { return this.http.patch<Envelope<AdminRoleRow>>(`${base()}/roles/${id}`, b); }
	staff(q: { search?: string; roleId?: string; status?: string; tab?: string } = {}) {
		let p = new HttpParams(); for (const [k, v] of Object.entries(q)) if (v) p = p.set(k, v);
		return this.http.get<Envelope<StaffList>>(`${base()}/staff`, { params: p });
	}
	unplaced() { return this.http.get<Envelope<Array<{ userId: string; name: string; email: string; accountType: string; status: string; lastActiveAt: string | null }>>>(`${base()}/staff/unplaced`); }
	attach(userId: string, roleId: string | null) { return this.http.post<Envelope<unknown>>(`${base()}/staff/attach`, { userId, roleId }); }
	setStaffRole(userId: string, roleId: string | null, expectedVersion: number) { return this.http.patch<Envelope<unknown>>(`${base()}/staff/${userId}/role`, { roleId, expectedVersion }); }
	suspend(userId: string) { return this.http.post<Envelope<unknown>>(`${base()}/staff/${userId}/suspend`, {}); }
	reactivate(userId: string) { return this.http.post<Envelope<unknown>>(`${base()}/staff/${userId}/reactivate`, {}); }
	invite(b: { email: string; fullName: string; roleId: string; departments?: string[] }) { return this.http.post<Envelope<{ id: string; email: string; expiresAt: string; emailed: boolean; link: string }>>(`${base()}/invites`, b); }
	resendInvite(id: string) { return this.http.post<Envelope<{ id: string; expiresAt: string; emailed: boolean; link: string }>>(`${base()}/invites/${id}/resend`, {}); }
	cancelInvite(id: string) { return this.http.post<Envelope<unknown>>(`${base()}/invites/${id}/cancel`, {}); }
	staffAccess(userId: string) { return this.http.get<Envelope<StaffAccess>>(`${base()}/staff/${userId}/access`); }
	setStaffAccess(userId: string, b: { overrides: Array<{ permission: string; effect: 'GRANT' | 'DENY' }>; scoped: boolean; departments: string[]; expectedVersion: number; confirmSensitive?: boolean }) { return this.http.put<Envelope<{ userId: string; version: number }>>(`${base()}/staff/${userId}/access`, b); }
	staffActivity(userId: string) { return this.http.get<Envelope<Array<{ id: string; at: string; kind: string; from: string | null; to: string | null; taskNumber: number; taskTitle: string }>>>(`${base()}/staff/${userId}/activity`); }
	taskMeta() { return this.http.get<Envelope<{ statuses: string[]; priorities: string[]; types: string[] }>>(`${base()}/tasks/meta`); }
	taskSummary() { return this.http.get<Envelope<TaskSummary>>(`${base()}/tasks/summary`); }
	tasks(q: { tab?: string; assigneeId?: string; type?: string; search?: string } = {}) {
		let p = new HttpParams(); for (const [k, v] of Object.entries(q)) if (v) p = p.set(k, v);
		return this.http.get<Envelope<TaskRow[]>>(`${base()}/tasks`, { params: p });
	}
	task(id: string) { return this.http.get<Envelope<TaskRow & { events: Array<{ kind: string; from: string | null; to: string | null; at: string; actorId: string }> }>>(`${base()}/tasks/${id}`); }
	createTask(b: { title: string; description?: string; type: string; priority?: string; dueAt?: string; assigneeId?: string; linkType?: string; linkId?: string }) { return this.http.post<Envelope<TaskRow>>(`${base()}/tasks`, b); }
	updateTask(id: string, b: Record<string, unknown>) { return this.http.patch<Envelope<TaskRow>>(`${base()}/tasks/${id}`, b); }
	setTaskStatus(id: string, status: string, expectedVersion: number) { return this.http.post<Envelope<TaskRow>>(`${base()}/tasks/${id}/status`, { status, expectedVersion }); }
	performance(period: string) { return this.http.get<Envelope<PerformanceReport>>(`${base()}/performance`, { params: { period } }); }
	performanceExportUrl(period: string) { return `${base()}/performance/export?period=${encodeURIComponent(period)}`; }
	exportPerformance(period: string) { return this.http.get(`${base()}/performance/export`, { params: { period }, responseType: 'blob' }); }
	accessAudit(limit = 30) { return this.http.get<Envelope<AccessAuditRow[]>>(`${base()}/access-audit`, { params: { limit } }); }
	// the token goes in the BODY, never in a URL / query string (those are written to access logs)
	invitePreview(token: string) { return this.http.post<Envelope<{ email: string; roleName: string; expiresAt: string }>>(`${environment.url_api}/admin-invite/preview`, { token }); }
	inviteRequestCode(token: string) { return this.http.post<Envelope<{ sent: boolean; email: string; expiresInSeconds: number }>>(`${environment.url_api}/admin-invite/request-code`, { token }); }
	inviteAccept(token: string, password: string, code: string) { return this.http.post<Envelope<{ userId: string; email: string }>>(`${environment.url_api}/admin-invite/accept`, { token, password, code }); }
}
