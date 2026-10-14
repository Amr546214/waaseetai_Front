import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export interface PlatformSettings {
	platformName: string;
	supportEmail: string;
	supportPhone: string;
	maintenanceBannerEnabled: boolean;
	maintenanceBannerText: string;
	termsVersion: string;
	privacyVersion: string;
	termsContent: string;
	privacyContent: string;
	adminNotificationEmail: string;
}

export interface SettingsHistoryRow { id: string; at: string; summary: string | null; ip: string | null; actor: string | null }

@Injectable({ providedIn: 'root' })
export class SaSystemSettingsService {
	private http = inject(HttpClient);
	private base = `${environment.url_api}/admin/settings`;

	get(): Observable<{ success: boolean; data: PlatformSettings; storageReady?: boolean }> {
		return this.http.get<{ success: boolean; data: PlatformSettings; storageReady?: boolean }>(this.base);
	}
	save(patch: Partial<PlatformSettings>): Observable<{ success: boolean; message: string; data: PlatformSettings }> {
		return this.http.put<{ success: boolean; message: string; data: PlatformSettings }>(this.base, patch);
	}
	history(): Observable<{ success: boolean; data: SettingsHistoryRow[] }> {
		return this.http.get<{ success: boolean; data: SettingsHistoryRow[] }>(`${this.base}/history`);
	}
}
