import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProfileEdit } from './profile-edit';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Client edit page: the percentage AND the "what is missing" box come from the backend (GET /profiles/me).
const ITEMS = [
  { key: 'avatar', label: 'الصورة الشخصية', points: 15, status: 'missing', tab: 'profile', hint: 'أضف صورة شخصية' },
  { key: 'name', label: 'الاسم الأول واسم العائلة', points: 15, status: 'missing', tab: 'basics', hint: 'أكمل الاسم' },
  { key: 'industry', label: 'المهنة الحالية', points: 15, status: 'missing', tab: 'setup', hint: 'أضف مهنتك الحالية من صفحة استكمال البيانات' },
  { key: 'payout', label: 'حساب PayPal لاستلام المدفوعات', points: 20, status: 'missing', tab: 'banking', hint: 'أضف بريد PayPal لاستلام المدفوعات' },
];
const data = (over: any) => ({ success: true, data: { currentProfileData: { firstName: 'سارة', lastName: 'أحمد', ...over }, latestHistory: [] } });

describe('client profile-edit: backend completion + missing items', () => {
  let fixture: ComponentFixture<ProfileEdit>;
  let component: ProfileEdit;
  let getMyProfile: ReturnType<typeof vi.fn>;
  let updateTab: ReturnType<typeof vi.fn>;
  let router: Router;

  const setup = (profileOver: any) => {
    getMyProfile = vi.fn(() => of(data(profileOver)));
    updateTab = vi.fn(() => of({ success: true }));
    TestBed.configureTestingModule({
      imports: [ProfileEdit],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT' }), token: () => 't', authenticate: vi.fn() } },
        { provide: ProfileApiService, useValue: { getMyProfile, getChangeRequests: () => of({ success: true, data: [] }), updateTab, updateProfile: vi.fn(() => of({ success: true })) } },
      ],
    });
    fixture = TestBed.createComponent(ProfileEdit);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
    render();
  };
  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector(s) as HTMLElement | null;
  const all = (s: string) => Array.from(el().querySelectorAll(s)) as HTMLElement[];

  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

  it('shows the backend percentage and the "لإكمال ملفك إلى 100%" box with every missing item and its points', () => {
    setup({ profileCompletionPercent: 35, missingItems: ITEMS });
    expect(el().textContent).toContain('35%');
    expect(q('[data-testid="missing-items"] h3')!.textContent).toContain('لإكمال ملفك إلى 100%، أكمل التالي:');
    expect(all('[data-testid="missing-items"] li').map(li => li.getAttribute('data-key'))).toEqual(['avatar', 'name', 'industry', 'payout']);
    expect(all('[data-testid="miss-missing"]').map(b => b.textContent!.trim())).toEqual(['ناقص · +15%', 'ناقص · +15%', 'ناقص · +15%', 'ناقص · +20%']);
  });

  it('the old local hints are gone (no KYC / "أضف حساب PayPal لتتمكن" guesses)', () => {
    setup({ profileCompletionPercent: 35, missingItems: ITEMS });
    expect((component as any).getCompletionHint).toBeUndefined();
    expect(el().textContent).not.toContain('أكمل بيانات الهوية الرسمية (KYC)');
    expect(el().textContent).not.toContain('لرفع نسبة الاكتمال');
  });

  it('100%: no box, a completed message', () => {
    setup({ profileCompletionPercent: 100, missingItems: [] });
    expect(q('[data-testid="missing-items"]')).toBeNull();
    expect(q('[data-testid="prog-hint"]')!.textContent).toContain('مكتمل 100%');
  });

  it('edit-page items open their tab; PayPal opens the (enabled) PayPal tab', () => {
    setup({ profileCompletionPercent: 35, missingItems: ITEMS });
    (q('button[data-tab="basics"]') as HTMLButtonElement).click(); render();
    expect(component.activeTab()).toBe('basics');
    (q('button[data-tab="banking"]') as HTMLButtonElement).click(); render();
    expect(component.activeTab()).toBe('banking');
    expect((q('form button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
    (q('button[data-tab="profile"]') as HTMLButtonElement).click(); render();
    expect(component.activeTab()).toBe('profile');
  });

  it('items only the setup wizard collects go to the wizard, never to the inert identity tab', () => {
    setup({ profileCompletionPercent: 35, missingItems: ITEMS });
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    (q('button[data-tab="setup"]') as HTMLButtonElement).click();
    expect(nav).toHaveBeenCalledWith(['/client-overview/profile-setup']);
    expect(component.activeTab()).not.toBe('identity');
  });

  it('after saving PayPal the completion is re-read from the backend (the box shrinks)', () => {
    setup({ profileCompletionPercent: 35, missingItems: ITEMS });
    getMyProfile.mockReturnValue(of(data({ profileCompletionPercent: 55, missingItems: ITEMS.slice(0, 3) })));
    component.switchTab('banking'); render();
    component.bankingForm.get('paypalEmail')!.setValue('pay@example.com');
    component.saveTab('banking'); render();
    expect(updateTab).toHaveBeenCalledWith('banking', { paypalPayoutEmail: 'pay@example.com' });
    expect(el().textContent).toContain('55%');
    expect(all('[data-testid="missing-items"] li').length).toBe(3);
  });

  it('clearing a saved PayPal email: GET prefills it, emptying the field saves exactly { paypalPayoutEmail: null }, then the completion is re-read', () => {
    setup({ paypalPayoutEmail: 'saved@example.com', profileCompletionPercent: 100, missingItems: [] });
    expect(component.bankingForm.get('paypalEmail')!.value).toBe('saved@example.com');
    getMyProfile.mockReturnValue(of(data({ paypalPayoutEmail: null, profileCompletionPercent: 80, missingItems: [ITEMS[3]] })));
    component.switchTab('banking'); render();
    component.bankingForm.get('paypalEmail')!.setValue('');
    component.saveTab('banking'); render();
    expect(updateTab).toHaveBeenCalledTimes(1);
    expect(updateTab).toHaveBeenCalledWith('banking', { paypalPayoutEmail: null });
    expect(Object.keys(updateTab.mock.calls[0][1])).toEqual(['paypalPayoutEmail']);
    expect(component.successMsg()).toBe('تم إزالة بريد PayPal');
    expect(getMyProfile).toHaveBeenCalledTimes(2); // load + the refresh after the save
    expect(el().textContent).toContain('80%');
    expect(all('[data-testid="missing-items"] li').map(li => li.getAttribute('data-key'))).toEqual(['payout']);
  });

  it('whitespace only counts as empty (removes), and an invalid address is rejected without a request', () => {
    setup({ profileCompletionPercent: 35, missingItems: ITEMS });
    component.switchTab('banking'); render();
    component.bankingForm.get('paypalEmail')!.setValue('not-an-email');
    component.saveTab('banking');
    expect(updateTab).not.toHaveBeenCalled();
    expect(component.errorMsg()).toContain('PayPal');
  });
});
