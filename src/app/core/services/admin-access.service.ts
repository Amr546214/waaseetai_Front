import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AccessRule, ruleForPath } from '../config/admin-access-rules';

export type AdminAccessState = 'SUPER_ADMIN' | 'ACTIVE' | 'NO_PERMISSIONS' | 'NOT_IN_TEAM' | 'SUSPENDED';
export interface AdminAccess { userId: string; isSuperAdmin: boolean; staffStatus: string | null; roleName: string | null; permissions: string[]; hasAnyPermission: boolean; state: AdminAccessState; displayRole: string }
export const ADMIN_DENIED_CODES = ['ADMIN_PERMISSION_DENIED', 'ADMIN_SUPER_ADMIN_REQUIRED', 'ADMIN_ACCESS_UNAVAILABLE'];

/**
 * What the signed-in admin account may do, as the SERVER reports it (GET /admin/team/access/me). It is read again whenever the server refuses an action with a permission code, so a
 * permission withdrawn while a page is open takes effect on the screen as well (the server already refuses the request itself). Until it is known nothing sensitive is shown, and when it
 * cannot be read the state is `error`, never "everything allowed".
 */
@Injectable({ providedIn: 'root' })
export class AdminAccessService {
	private http = inject(HttpClient);
	private router = inject(Router);
	readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
	readonly access = signal<AdminAccess | null>(null);
	readonly isSuperAdmin = computed(() => this.access()?.isSuperAdmin === true);
	readonly displayRole = computed(() => this.access()?.displayRole ?? '');
	readonly state = computed<AdminAccessState | null>(() => this.access()?.state ?? null);
	private inflight: Promise<void> | null = null;

	/** Loads once (or joins the load in flight). Resolves in every case; check `status()`. */
	ensure(): Promise<void> { return this.status() === 'ready' ? Promise.resolve() : this.load(); }
	refresh(): Promise<void> { return this.load(); }
	reset(): void { this.access.set(null); this.status.set('idle'); this.inflight = null; }

	private load(): Promise<void> {
		if (this.inflight) return this.inflight;
		this.status.set(this.access() ? 'ready' : 'loading');
		this.inflight = new Promise<void>(resolve => {
			this.http.get<{ success: boolean; data: AdminAccess }>(`${environment.url_api}/admin/team/access/me`).subscribe({
				next: r => { if (r?.success && r.data && Array.isArray(r.data.permissions)) { this.access.set(r.data); this.status.set('ready'); } else { this.access.set(null); this.status.set('error'); } this.enforceOpenPage(); this.inflight = null; resolve(); },
				error: () => { this.access.set(null); this.status.set('error'); this.enforceOpenPage(); this.inflight = null; resolve(); },
			});
		});
		return this.inflight;
	}

	/** A page that is already open when access is withdrawn (or becomes unreadable) is left at once: its data and actions disappear instead of waiting for the next navigation. */
	private enforceOpenPage(): void {
		const url = this.router.url ?? '';
		if (!url.startsWith('/supper-admin-overview') || url.startsWith('/supper-admin-overview/no-access')) return;
		if (this.status() === 'error') { void this.router.navigateByUrl('/supper-admin-overview/no-access?reason=unavailable', { replaceUrl: true }); return; }
		if (!this.allows(ruleForPath(url))) void this.router.navigateByUrl('/supper-admin-overview/no-access?reason=denied', { replaceUrl: true });
	}

	can(id: string): boolean { const a = this.access(); return !!a && (a.isSuperAdmin || a.permissions.includes(id)); }
	canAny(ids: string[]): boolean { return ids.some(i => this.can(i)); }
	allows(rule: AccessRule): boolean {
		if (rule.self) return true; // the admin's own account pages need no permission
		const a = this.access(); if (!a) return false;
		if (rule.superAdmin) return a.isSuperAdmin;
		if (rule.member) return a.isSuperAdmin || a.permissions.length > 0;
		if (rule.all) return rule.all.every(i => this.can(i));
		if (rule.anyOf) return this.canAny(rule.anyOf);
		return false;
	}
}
