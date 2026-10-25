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

	readonly tabs: Array<{ key: Tab; label: string; icon: string }> = [
		{ key: 'general', label: 'عام', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z' },
		{ key: 'ai', label: 'الذكاء الاصطناعي', icon: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z' },
		{ key: 'notifications', label: 'الإشعارات', icon: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0' },
		{ key: 'security', label: 'الأمان', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
		{ key: 'finance', label: 'المالية', icon: 'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 14a1.5 1.5 0 100-3 1.5 1.5 0 000 3z' },
		{ key: 'regional', label: 'الإقليمية', icon: 'M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20' },
		{ key: 'health', label: 'صحة النظام', icon: 'M20 6L9 17l-5-5' },
	];
	readonly active = signal<Tab>('general');
	readonly readiness = signal<{ ready: boolean; blockers: Blocker[] } | null>(null);
	readonly readinessError = signal('');

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
