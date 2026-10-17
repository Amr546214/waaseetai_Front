import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Data } from './data';
import { MarketerOverviewService } from '../../../../../core/services/marketer-overview.service';
import { MarketerProfileService } from '../../../../../core/services/marketer-profile.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { MarketerPrefsStore } from '../../../../../core/services/marketer-prefs.store';
import { providerTimeZone, ProviderPrefsStore } from '../../../../../core/services/provider-prefs.store';

// Marketer settings (security tab): every visible switch saves for real and comes back after a reload; the unsupported ones are disabled with a visible reason.
const SAVED = { inApp: false, email: true, newReferral: false, newCommission: true, communicationLanguage: 'en' as const, timezone: 'Asia/Dubai' };

describe('marketer settings: save / reload / disabled-with-reason', () => {
	let fixture: ComponentFixture<Data>;
	let c: Data;
	let overview: any;
	const el = () => fixture.nativeElement as HTMLElement;
	const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };

	async function mount(settings: any = SAVED, update: any = undefined) {
		overview = {
			getSummary: () => of({ success: true, data: {} }), getChannelPerformance: () => of({ success: true, data: [] }), getRecentCommissions: () => of({ success: true, data: [] }),
			getSettings: vi.fn(() => settings instanceof Error ? throwError(() => settings) : of({ success: true, data: settings })),
			updateMarketerSettings: vi.fn((body: any) => update ?? of({ success: true, data: { ...SAVED, ...body } })),
			exportData: vi.fn(() => of(new Blob(['{}'], { type: 'application/json' }))),
		};
		await TestBed.configureTestingModule({ imports: [Data], providers: [provideRouter([]), { provide: MarketerOverviewService, useValue: overview }, { provide: MarketerProfileService, useValue: { getProfile: () => of({ success: true, data: {} }) } }] }).compileComponents();
		fixture = TestBed.createComponent(Data); c = fixture.componentInstance;
		fixture.detectChanges(); c.setActiveTab('security'); render();
	}
	afterEach(() => { fixture?.destroy(); TestBed.inject(ProviderPrefsStore).setTimezone(null); TestBed.resetTestingModule(); });

	it('reload: the saved values come back into the controls (channels, alerts, language, timezone)', async () => {
		await mount();
		expect(c.alertPreferences).toEqual(SAVED);
		const q = (id: string) => el().querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!;
		await fixture.whenStable(); render();
		expect(q('set-inapp').checked).toBe(false);
		expect(q('set-email').checked).toBe(true);
		expect(q('set-referral').checked).toBe(false);
		expect(q('set-commission').checked).toBe(true);
	});

	it('save sends every setting to the server, shows success, and applies the timezone to every date', async () => {
		await mount({ inApp: true, email: false, newReferral: true, newCommission: true, communicationLanguage: 'ar', timezone: null });
		c.alertPreferences = { ...SAVED };
		c.saveAlertPreferences();
		expect(overview.updateMarketerSettings).toHaveBeenCalledWith(SAVED);
		expect(TestBed.inject(UiNotificationService).toasts().at(-1)).toMatchObject({ kind: 'success', message: expect.stringContaining('تم حفظ') });
		expect(providerTimeZone()).toBe('Asia/Dubai');
		expect(TestBed.inject(MarketerPrefsStore).settings()?.timezone).toBe('Asia/Dubai');
	});

	it('"حسب جهازي" (no timezone) returns dates to the browser zone', async () => {
		await mount();
		expect(providerTimeZone()).toBe('Asia/Dubai');
		c.alertPreferences = { ...SAVED, timezone: null };
		overview.updateMarketerSettings.mockReturnValue(of({ success: true, data: { ...SAVED, timezone: null } }));
		c.saveAlertPreferences();
		expect(providerTimeZone()).toBeUndefined();
	});

	it('invalid value: the server refusal is shown, nothing claims success', async () => {
		await mount(SAVED, throwError(() => ({ status: 400, error: { message: 'المنطقة الزمنية غير مدعومة' } })));
		c.saveAlertPreferences();
		expect(TestBed.inject(UiNotificationService).toasts().some(t => t.kind === 'success')).toBe(false);
		expect(c.isSavingAlerts()).toBe(false);
	});

	it('the timezone list is the server\'s list and the language is described as communication only', async () => {
		await mount();
		expect(c.timezoneOptions.map(o => o.value)).toEqual(['Asia/Riyadh', 'Asia/Dubai', 'Asia/Kuwait', 'Africa/Cairo', 'Asia/Amman', 'GMT']);
		expect(el().querySelector('[data-testid="set-language-note"]')!.textContent).toContain('لا تغيّر لغة واجهة المنصة');
		expect(el().textContent).toContain('لغة التواصل');
	});

	it('unsupported: level-up alert and account deletion are disabled with a visible reason; no compliance claim', async () => {
		await mount();
		expect(el().querySelector<HTMLInputElement>('[data-testid="set-tier-disabled"] input')!.disabled).toBe(true);
		expect(el().querySelector('[data-testid="set-tier-note"]')!.textContent).toContain('غير متاح حاليًا');
		expect(el().querySelector<HTMLButtonElement>('[data-testid="delete-account"]')!.disabled).toBe(true);
		expect(el().querySelector('[data-testid="delete-account-reason"]')!.textContent).toContain('غير متاح');
		expect(el().textContent).not.toMatch(/PDPL|SAMA|ISO|GDPR/);
	});

	it('data download asks the server for the real file', async () => {
		await mount();
		const create = vi.fn(() => 'blob:x'); (URL as any).createObjectURL = create; (URL as any).revokeObjectURL = vi.fn();
		c.downloadMyData();
		expect(overview.exportData).toHaveBeenCalled();
		expect(create).toHaveBeenCalled();
	});

	it('a failed settings load says so instead of silently showing defaults as saved', async () => {
		await mount(new Error('x'));
		render();
		expect(el().querySelector('[data-testid="alerts-load-note"]')).not.toBeNull();
	});
});
