import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import { setPlatformRegional } from '../utils/regional';

/** What the server publishes about the platform itself (GET /public/settings): the announcement banner. A server answer MAINTENANCE (503) also lands here so every page can say why nothing loads. */
export const DEFAULT_BRAND = 'وسيط AI';
/** shown by the support buttons (login «account frozen» dialog, report-a-problem page) while the `supportEmail` setting is empty; the server's registry reports the same literal as the value in use */
export const DEFAULT_SUPPORT_EMAIL = 'support@waseet.ai';
/** the server's answer during maintenance has this sentence when no banner text is configured; the web app uses it when the server sent none */
export const DEFAULT_MAINTENANCE_MESSAGE = 'المنصة في صيانة مؤقتة. سنعود قريبًا.';
@Injectable({ providedIn: 'root' })
export class PlatformInfoService {
	private http = inject(HttpClient);
	private browser = isPlatformBrowser(inject(PLATFORM_ID));
	readonly banner = signal<{ enabled: boolean; text: string }>({ enabled: false, text: '' });
	readonly maintenance = signal<string | null>(null);
	private title = inject(Title);
	/** the name shown in shell labels: the platform setting, else the built-in brand */
	readonly name = signal('');
	readonly brand = computed(() => this.name() || DEFAULT_BRAND);
	/** the published support address / legal versions (empty = not set) */
	readonly supportEmailSetting = signal('');
	readonly termsVersion = signal('');
	readonly privacyVersion = signal('');
	readonly supportEmail = computed(() => this.supportEmailSetting() || DEFAULT_SUPPORT_EMAIL);
	private applyPublic(d: Record<string, unknown> | undefined) {
		const str = (k: string) => (typeof d?.[k] === 'string' ? (d[k] as string).trim() : '');
		this.supportEmailSetting.set(str('supportEmail')); this.termsVersion.set(str('termsVersion')); this.privacyVersion.set(str('privacyVersion'));
	}
	private applyName(v: unknown) { const n = typeof v === 'string' ? v.trim() : ''; this.name.set(n); if (this.browser && n) this.title.setTitle(`${n} | للخدمات الذكية`); }

	load(): void {
		if (!this.browser) return;
		this.http.get<{ success: boolean; data: { maintenanceBannerEnabled?: boolean; maintenanceBannerText?: string; defaultTimezone?: string; dateFormat?: string; calendarSystem?: string; defaultLanguage?: string } }>(`${environment.url_api}/public/settings`).subscribe({
			next: r => { setPlatformRegional(r.data ?? {}); this.applyPublic(r.data as Record<string, unknown> | undefined); this.applyName((r.data as Record<string, unknown> | undefined)?.['platformName']); this.banner.set({ enabled: r.data?.maintenanceBannerEnabled === true, text: String(r.data?.maintenanceBannerText ?? '').trim() }); },
			error: () => undefined, // the banner is optional: a failure must never disturb the page
		});
	}
	/** App start: wait (at most ~1.5 s, never fail) for the public settings so the first dates are already in the platform zone / format. */
	loadOnce(): Promise<void> {
		if (!this.browser) return Promise.resolve();
		return new Promise<void>(resolve => {
			const done = () => resolve(); const t = setTimeout(done, 1500);
			this.http.get<{ data: Record<string, unknown> }>(`${environment.url_api}/public/settings`).subscribe({
				next: r => { setPlatformRegional((r.data ?? {}) as never); this.applyPublic(r.data); this.applyName(r.data?.['platformName']); this.banner.set({ enabled: r.data?.['maintenanceBannerEnabled'] === true, text: String(r.data?.['maintenanceBannerText'] ?? '').trim() }); clearTimeout(t); done(); },
				error: () => { clearTimeout(t); done(); },
			});
		});
	}
	setMaintenance(message: string) { this.maintenance.set(message || DEFAULT_MAINTENANCE_MESSAGE); }
}
