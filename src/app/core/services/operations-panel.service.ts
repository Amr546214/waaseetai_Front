import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

export interface OperationsAccess { officialDeployment: boolean; isSuperAdmin: boolean; available: boolean }
/** Whether the unified «إعدادات النظام» operations panel exists for this caller. Asked of the SERVER (deployment identity from its configuration + the account type from its database); the browser's own address is never used. */
@Injectable({ providedIn: 'root' })
export class OperationsPanelService {
	private readonly http = inject(HttpClient);
	private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
	readonly state = signal<OperationsAccess | null>(null);
	readonly loaded = signal(false);
	readonly available = computed(() => this.state()?.available === true);
	/** why the panel is not shown: lets the page word the refusal */
	readonly reason = computed<'super-admin' | 'official' | null>(() => { const s = this.state(); if (!s || s.available) return null; return s.isSuperAdmin ? 'official' : 'super-admin'; });
	load(force = false): void {
		if (!this.browser || (this.loaded() && !force)) return; this.loaded.set(true);
		this.http.get<{ data: OperationsAccess }>(`${environment.url_api}/admin/system-settings/access`).subscribe({ next: r => this.state.set(r.data), error: () => { this.state.set({ officialDeployment: false, isSuperAdmin: false, available: false }); } });
	}
}
