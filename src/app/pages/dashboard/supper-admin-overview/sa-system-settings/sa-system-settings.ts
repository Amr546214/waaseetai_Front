import { FeePolicyPanel } from '../../../../shared/fee-policy/fee-policy-panel';
import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { mapHttpError } from '../../../../core/forms/http-error';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { Blocker, SystemSettingsApi, SystemSettingsStore } from '../../../../core/services/system-settings.store';
import { SettingsSectionComponent } from '../../../../shared/system-settings/settings-section.component';
import { SettingsChangelogComponent } from './settings-changelog.component';
import { SettingsHealthComponent } from './settings-health.component';

type Tab = 'general' | 'ai' | 'notifications' | 'security' | 'finance' | 'regional' | 'health';

/**
 * P-AD-020 «إعدادات النظام». Every row comes from the server's settings registry (one source shared with «Super Admin»): what is enforced is editable and saved with a version check and an audit entry,
 * what is only a value the system really uses is shown read-only with its source, and what has no implementation yet says so and why. Nothing here is stored in the browser.
 */
@Component({
	selector: 'app-sa-system-settings',
	standalone: true,
	imports: [FeePolicyPanel, SettingsSectionComponent, SettingsHealthComponent, SettingsChangelogComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './sa-system-settings.html',
	styleUrl: './sa-system-settings.css',
})
export class SaSystemSettings implements OnInit {
	readonly store = inject(SystemSettingsStore);
	private api = inject(SystemSettingsApi);
	readonly access = inject(AdminAccessService);
	readonly appVersion = environment.appVersion;
	private changelog = viewChild(SettingsChangelogComponent);

	/** the icons are the reference's own symbols (P-AD-020 #i-settings / #i-ai / #i-bell / #i-shield / #i-wallet / #i-globe / #i-check) flattened to one path each */
	readonly icons = { settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z', ai: 'M10 12a2 2 0 1 0 4 0 2 2 0 1 0-4 0zM2.5 6a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0zM18.5 6a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0zM2.5 18a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0zM18.5 18a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0zM10.5 3a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0zM10.5 21a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0zM12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5', bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0', shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', wallet: 'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM14.5 14a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0z', globe: 'M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z', check: 'M20 6L9 17l-5-5' };
	readonly tabs: Array<{ key: Tab; label: string; icon: string }> = [
		{ key: 'general', label: 'عام', icon: this.icons.settings },
		{ key: 'ai', label: 'الذكاء الاصطناعي', icon: this.icons.ai },
		{ key: 'notifications', label: 'الإشعارات', icon: this.icons.bell },
		{ key: 'security', label: 'الأمان', icon: this.icons.shield },
		{ key: 'finance', label: 'المالية', icon: this.icons.wallet },
		{ key: 'regional', label: 'الإقليمية', icon: this.icons.globe },
		{ key: 'health', label: 'صحة النظام', icon: this.icons.check },
	];
	readonly active = signal<Tab>('general');
	readonly readiness = signal<{ ready: boolean; blockers: Blocker[] } | null>(null);
	readonly readinessError = signal('');
	/** the technical requirement list sits behind a toggle (the long text is not part of the compact card) */
	readonly readyOpen = signal(false);

	readonly general = ['platformName', 'maintenanceMode', 'registrationOpen', 'liveSupportAssistant'];
	readonly contacts = ['supportEmail', 'supportPhone', 'maintenanceBannerEnabled', 'maintenanceBannerText'];
	readonly legal = ['termsVersion', 'privacyVersion', 'termsContent', 'privacyContent'];
	readonly generalAll = [...this.general, ...this.contacts, ...this.legal];
	readonly ai = ['aiEngineEnabled', 'aiConfidenceThreshold', 'aiDisputeArbitration', 'aiFraudDetection', 'aiDisclosureBanner'];
	readonly notif = ['channelEmail', 'channelPush', 'adminDisputeAlerts', 'adminNotificationEmail'];
	readonly security = ['adminTwoFactor', 'sessionIdleMinutes', 'sessionMaxHours', 'auditLogging', 'loginProtection'];
	readonly finance = ['baseCurrency', 'paymentGateway', 'escrowHoldHours', 'futureBilling'];
	readonly regional = ['defaultTimezone', 'dateFormat', 'calendarSystem'];

	constructor() {
		// the change log follows every successful save (the server's own record, not a local echo)
		effect(() => { const n = this.store.notice(); if (n) untracked(() => void this.changelog()?.refresh()); });
	}

	ngOnInit() { void this.store.load(); }
	setTab(t: Tab) { this.active.set(t); if (t === 'finance' && this.access.isSuperAdmin() && !this.readiness()) void this.loadReadiness(); }
	async loadReadiness() {
		this.readinessError.set('');
		try { this.readiness.set((await firstValueFrom(this.api.readiness())).data); } catch (e) { this.readinessError.set(mapHttpError(e, { fallback: 'تعذّر فحص جاهزية العملة.' }).message); }
	}
}
