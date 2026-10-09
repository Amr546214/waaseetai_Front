import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Data } from './data';
import { MarketerOverviewService } from '../../../../../core/services/marketer-overview.service';
import { MarketerProfileService } from '../../../../../core/services/marketer-profile.service';
import { NotificationPreferencesService } from '../../../../../core/services/notification-preferences.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';

// Marketer data page: the percentage and the "what is missing" box come from the backend; the PayPal item opens the PayPal tab; the channel dot no longer says "محقق".
const base = { id: 'p1', referralSlug: 'abc', marketingChannels: [{ id: 'c1', platform: 'YOUTUBE', handle: '@x', createdAt: '' }], bio: '', avatarUrl: '',
  paypalPayoutEmail: '', user: { firstName: 'م', lastName: 'ت', email: 'm@x.com', phoneNumber: '501234567', phoneCountryCode: '+966', idNumber: '1' } };
const ITEMS = [
  { key: 'avatar', label: 'الصورة الشخصية', points: 20, status: 'missing', tab: 'profile', hint: 'أضف صورة شخصية' },
  { key: 'bio', label: 'الوصف التسويقي', points: 20, status: 'missing', tab: 'profile', hint: 'اكتب وصفًا تسويقيًا من 50 حرفًا على الأقل' },
  { key: 'payout', label: 'بريد PayPal', points: 30, status: 'missing', tab: 'bank', hint: 'أضف بريد PayPal لاستلام الأرباح' },
];

describe('marketer data page: backend completion + missing items', () => {
  let fixture: ComponentFixture<Data>;
  let c: Data;
  let getProfile: ReturnType<typeof vi.fn>;

  const setup = async (profile: any) => {
    getProfile = vi.fn(() => of({ success: true, data: profile }));
    await TestBed.configureTestingModule({
      imports: [Data],
      providers: [
        provideRouter([]),
        { provide: MarketerOverviewService, useValue: { getSummary: () => of({ success: true, data: {} }), getChannelPerformance: () => of({ success: true, data: [] }), getRecentCommissions: () => of({ success: true, data: [] }) } },
        { provide: MarketerProfileService, useValue: { getProfile, updateMarketingInfo: vi.fn(() => of({ success: true })), addChannel: vi.fn(), removeChannel: vi.fn(), updatePaypalPayout: vi.fn(), createIdentityRequest: vi.fn(), changePassword: vi.fn() } },
        { provide: NotificationPreferencesService, useValue: { getPreferences: () => of({ success: true, data: {} }), updatePreferences: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Data);
    c = fixture.componentInstance;
    fixture.detectChanges(); render();
  };
  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector(s) as HTMLElement | null;
  const all = (s: string) => Array.from(el().querySelectorAll(s)) as HTMLElement[];
  afterEach(() => { TestBed.inject(UiNotificationService).clearAll(); fixture?.destroy(); TestBed.resetTestingModule(); });

  it('shows the backend percentage and the "لإكمال ملفك إلى 100%" box with each item and its points; the old static hint is gone', async () => {
    await setup({ ...base, completionPercentage: 30, missingItems: ITEMS });
    expect(q('.prog-pct')!.textContent).toContain('30%');
    expect(q('.cbx-title')!.textContent).toContain('لإكمال ملفك إلى 100%، أكمل التالي:');
    expect(all('.cbx-item').map(i => i.getAttribute('data-key'))).toEqual(['avatar', 'bio', 'payout']);
    expect(q('[data-testid="miss-missing"]')!.textContent).toContain('+20%');
    expect(el().textContent).not.toContain('اكمل التحقق من القنوات');
  });

  it('the PayPal tab has one PayPal field, no bank / IBAN / holder / wallet, and no "بمراجعة" governance tag', async () => {
    await setup({ ...base, completionPercentage: 70, missingItems: [], paypalPayoutEmail: 'm@example.com' });
    c.setActiveTab('banking'); render();
    const text = el().textContent || '';
    expect((q('#afpp-email') as HTMLInputElement).value).toBe('m@example.com');
    expect(text).toContain('يُستخدم PayPal فقط للمدفوعات على المنصة');
    expect(text).not.toMatch(/IBAN|اسم البنك|الحساب البنكي|البيانات البنكية|صاحب الحساب|محفظة|STC Pay/);
    for (const n of ['iban', 'bankName', 'accountHolderName', 'swiftCode']) expect(el().querySelector(`[formcontrolname="${n}"]`), n).toBeNull();
  });

  it('items open the right tab: profile items -> profile, the PayPal item -> the PayPal tab', async () => {
    await setup({ ...base, completionPercentage: 30, missingItems: ITEMS });
    (q('.cbx-link[data-tab="bank"]') as HTMLButtonElement).click(); render();
    expect(c.activeTab()).toBe('banking');
    c.setActiveTab('referral'); render();
    (q('.cbx-link[data-tab="profile"]') as HTMLButtonElement).click(); render();
    expect(c.activeTab()).toBe('profile');
  });

  it('100%: the completion card (label, percentage, bar, "مكتمل" hint) and the missing box are gone', async () => {
    await setup({ ...base, completionPercentage: 100, missingItems: [], paypalPayoutEmail: 'm@example.com' });
    expect(q('[data-testid="missing-items"]')).toBeNull();
    expect(q('.prog-header')).toBeNull();
    expect(q('.prog-fill')).toBeNull();
    expect(q('[data-testid="prog-hint"]')).toBeNull();
    expect(el().textContent).not.toContain('اكتمال الملف التسويقي');
  });

  it('below 100%: the card shows the label, the percentage and the bar width', async () => {
    await setup({ ...base, completionPercentage: 40, missingItems: ITEMS });
    expect(q('.prog-header')).not.toBeNull();
    expect(q('.prog-pct')!.textContent).toContain('40%');
    expect((q('.prog-fill') as HTMLElement).style.width).toBe('40%');
  });

  it('a channel is shown as added, never as "محقق" (channel verification does not exist yet)', async () => {
    await setup({ ...base, completionPercentage: 30, missingItems: [] });
    const dot = q('.channel-status')!;
    expect(dot.classList.contains('ok')).toBe(false);
    expect(dot.getAttribute('title')).not.toContain('محقق');
    expect(el().textContent).not.toContain('محقق');
  });
});
