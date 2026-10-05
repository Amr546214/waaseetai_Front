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

// Marketer data page: the percentage and the "what is missing" box come from the backend; a pending bank request
// shows as "قيد المراجعة" from backend data (so it survives a reload); the channel dot no longer says "محقق".
const base = { id: 'p1', referralSlug: 'abc', marketingChannels: [{ id: 'c1', platform: 'YOUTUBE', handle: '@x', createdAt: '' }], bio: '', avatarUrl: '',
  bankName: '', accountHolderName: '', iban: '', swiftCode: '', user: { firstName: 'م', lastName: 'ت', email: 'm@x.com', phoneNumber: '501234567', phoneCountryCode: '+966', idNumber: '1' } };
const ITEMS = [
  { key: 'avatar', label: 'الصورة الشخصية', points: 20, status: 'missing', tab: 'profile', hint: 'أضف صورة شخصية' },
  { key: 'bio', label: 'الوصف التسويقي', points: 20, status: 'missing', tab: 'profile', hint: 'اكتب وصفًا تسويقيًا من 50 حرفًا على الأقل' },
  { key: 'iban', label: 'الحساب البنكي (IBAN)', points: 30, status: 'missing', tab: 'bank', hint: 'أضف رقم IBAN (يُفعَّل بعد اعتماد الطلب)' },
];
const PENDING = [{ ...ITEMS[2], status: 'pending_review', hint: 'طلب الحساب البنكي قيد المراجعة' }];

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
        { provide: MarketerProfileService, useValue: { getProfile, updateMarketingInfo: vi.fn(() => of({ success: true })), addChannel: vi.fn(), removeChannel: vi.fn(), updateBankInfo: vi.fn(), createIdentityRequest: vi.fn(), changePassword: vi.fn() } },
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
    await setup({ ...base, completionPercentage: 30, missingItems: ITEMS, bankStatus: 'none' });
    expect(q('.prog-pct')!.textContent).toContain('30%');
    expect(q('.cbx-title')!.textContent).toContain('لإكمال ملفك إلى 100%، أكمل التالي:');
    expect(all('.cbx-item').map(i => i.getAttribute('data-key'))).toEqual(['avatar', 'bio', 'iban']);
    expect(q('[data-testid="miss-missing"]')!.textContent).toContain('+20%');
    expect(el().textContent).not.toContain('اكمل التحقق من القنوات');
  });

  it('a pending IBAN is "قيد المراجعة" (not missing) and the bank tab explains it from backend data', async () => {
    await setup({ ...base, completionPercentage: 70, missingItems: PENDING, bankStatus: 'pending_review' });
    expect(q('.cbx-item')!.getAttribute('data-status')).toBe('pending_review');
    expect(q('[data-testid="miss-pending"]')!.textContent).toContain('قيد المراجعة');
    expect(q('[data-testid="miss-missing"]')).toBeNull();
    c.setActiveTab('banking'); render();
    expect(q('[data-testid="bank-pending"]')!.textContent).toContain('قيد المراجعة'); // no local flag involved (reload-safe)
  });

  it('items open the right tab: profile items -> profile, the IBAN item -> the bank tab', async () => {
    await setup({ ...base, completionPercentage: 30, missingItems: ITEMS, bankStatus: 'none' });
    (q('.cbx-link[data-tab="bank"]') as HTMLButtonElement).click(); render();
    expect(c.activeTab()).toBe('banking');
    c.setActiveTab('referral'); render();
    (q('.cbx-link[data-tab="profile"]') as HTMLButtonElement).click(); render();
    expect(c.activeTab()).toBe('profile');
  });

  it('100%: no box and a completed message', async () => {
    await setup({ ...base, completionPercentage: 100, missingItems: [], bankStatus: 'approved', iban: 'SA0380000000608010167519' });
    expect(q('[data-testid="missing-items"]')).toBeNull();
    expect(q('[data-testid="prog-hint"]')!.textContent).toContain('100%');
  });

  it('a channel is shown as added, never as "محقق" (channel verification does not exist yet)', async () => {
    await setup({ ...base, completionPercentage: 30, missingItems: [], bankStatus: 'none' });
    const dot = q('.channel-status')!;
    expect(dot.classList.contains('ok')).toBe(false);
    expect(dot.getAttribute('title')).not.toContain('محقق');
    expect(el().textContent).not.toContain('محقق');
  });
});
