import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

/** What the server publishes about the platform itself (GET /public/settings): the announcement banner. A server answer MAINTENANCE (503) also lands here so every page can say why nothing loads. */
@Injectable({ providedIn: 'root' })
export class PlatformInfoService {
	private http = inject(HttpClient);
	private browser = isPlatformBrowser(inject(PLATFORM_ID));
	readonly banner = signal<{ enabled: boolean; text: string }>({ enabled: false, text: '' });
	readonly maintenance = signal<string | null>(null);

	load(): void {
		if (!this.browser) return;
		this.http.get<{ success: boolean; data: { maintenanceBannerEnabled?: boolean; maintenanceBannerText?: string } }>(`${environment.url_api}/public/settings`).subscribe({
			next: r => this.banner.set({ enabled: r.data?.maintenanceBannerEnabled === true, text: String(r.data?.maintenanceBannerText ?? '').trim() }),
			error: () => undefined, // the banner is optional: a failure must never disturb the page
		});
	}
	setMaintenance(message: string) { this.maintenance.set(message || 'المنصة في صيانة مؤقتة. سنعود قريبًا.'); }
}
