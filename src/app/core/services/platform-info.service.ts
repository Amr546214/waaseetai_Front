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
/** the support / WhatsApp number shown by the contact page and the footer while the `supportPhone` setting is empty (the server's registry reports the same literal as the value in use) */
export const DEFAULT_SUPPORT_PHONE = '+966 55 256 0392';
/** wa.me link of a displayed number: digits only, a leading 00 dropped (the number must be written in international form) */
export const waLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '').replace(/^00/, '')}`;
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
	/** the saved legal texts (empty = not set: the pages render their static text) */
	readonly termsContent = signal('');
	readonly privacyContent = signal('');
	readonly supportPhoneSetting = signal('');
	readonly supportPhone = computed(() => this.supportPhoneSetting() || DEFAULT_SUPPORT_PHONE);
	readonly supportPhoneLink = computed(() => waLink(this.supportPhone()));
	readonly supportEmail = computed(() => this.supportEmailSetting() || DEFAULT_SUPPORT_EMAIL);
	private applyPublic(d: Record<string, unknown> | undefined) {
		const str = (k: string) => (typeof d?.[k] === 'string' ? (d[k] as string).trim() : '');
		this.supportEmailSetting.set(str('supportEmail')); this.termsVersion.set(str('termsVersion')); this.privacyVersion.set(str('privacyVersion'));
		this.supportPhoneSetting.set(str('supportPhone'));
		this.termsContent.set(str('termsContent')); this.privacyContent.set(str('privacyContent'));
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
