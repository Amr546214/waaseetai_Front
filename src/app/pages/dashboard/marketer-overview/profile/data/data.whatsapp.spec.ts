import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Data } from './data';
import { MarketerOverviewService } from '../../../../../core/services/marketer-overview.service';
import { MarketerProfileService } from '../../../../../core/services/marketer-profile.service';

// D-CM4: the marketer edits an optional WhatsApp number on the basics tab (PUT /profiles/update/contact, one E.164 string), same contract as client/provider.
describe('marketer profile data: WhatsApp number', () => {
  const SETTINGS = { inApp: true, email: false, newReferral: true, newCommission: true, communicationLanguage: 'ar', timezone: null };
  let fixture: ComponentFixture<Data>;
  let component: Data;
  let updateContact: ReturnType<typeof vi.fn>;
  let getProfile: ReturnType<typeof vi.fn>;

  const profile = (alt: string | null) => ({ success: true, data: { avatarUrl: '', bio: '', user: { firstName: 'خالد', lastName: 'الغامدي', email: 'k@example.com', phoneNumber: '501234567', phoneCountryCode: '+966', alternativePhone: alt, idNumber: '' }, marketingChannels: [] } });

  async function configure(alt: string | null) {
    updateContact = vi.fn(() => of({ success: true }));
    getProfile = vi.fn(() => of(profile(alt)));
    await TestBed.configureTestingModule({
      imports: [Data],
      providers: [provideRouter([]),
        { provide: MarketerOverviewService, useValue: { getSummary: () => of({ success: true, data: {} }), getChannelPerformance: () => of({ success: true, data: [] }), getRecentCommissions: () => of({ success: true, data: [] }), getSettings: () => of({ success: true, data: SETTINGS }), updateMarketerSettings: vi.fn() } },
        { provide: MarketerProfileService, useValue: { getProfile, updateContact } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Data);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.setActiveTab('basics'); render();
  }
  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
  const el = () => fixture.nativeElement as HTMLElement;
  const box = () => el().querySelector('app-phone-input:has(#af-whatsapp)') as HTMLElement;
  const dial = () => (box().querySelector('.dial-code') as HTMLElement).textContent!.trim();
  const flag = () => box().querySelector('img.flag-img')?.getAttribute('src');
  const nationalValue = () => (box().querySelector('input.phone-number-input') as HTMLInputElement).value;
  const type = (text: string) => { const i = box().querySelector('input.phone-number-input') as HTMLInputElement; i.value = text; i.dispatchEvent(new Event('input')); render(); };
  const pickCountry = (code: string) => {
    (box().querySelector('.country-selector-btn') as HTMLElement).click(); render();
    (Array.from(box().querySelectorAll('.dropdown-item')) as HTMLElement[]).find(r => r.getAttribute('aria-label')!.endsWith(code))!.click(); render();
  };
  afterEach(() => TestBed.resetTestingModule());

  it('the field exists next to the read-only account phone and the account phone is never editable', async () => {
    await configure(null);
    expect(box()).toBeTruthy();
    expect(el().querySelector('[data-testid="phone-readonly"]')).toBeTruthy();
    expect(el().querySelector('[data-testid="whatsapp-save"]')).toBeTruthy();
  });

  it('restores a stored +971501234567: UAE flag, +971 (LTR), local number 50 123 4567', async () => {
    await configure('+971501234567');
    expect(flag()).toContain('AE.svg');
    expect(dial()).toBe('+971');
    expect(nationalValue().replace(/\s/g, '')).toBe('501234567');
  });

  it('an empty WhatsApp opens on the account phone country (Saudi here), not on a blank globe', async () => {
    await configure(null);
    expect(flag()).toContain('SA.svg');
    expect(dial()).toBe('+966');
    expect(nationalValue()).toBe('');
  });

  it('country + number typed -> PUT contact gets ONE E.164 string; after save the stored value is kept (refresh keeps country/dial/number)', async () => {
    await configure(null);
    pickCountry('+971'); type('050 123 4567');
    component.saveWhatsapp();
    expect(updateContact).toHaveBeenCalledTimes(1);
    const payload = updateContact.mock.calls[0][0];
    expect(typeof payload.alternativePhone).toBe('string');
    expect(payload).toEqual({ alternativePhone: '+971501234567' });
    expect((component.profile() as any).user.alternativePhone).toBe('+971501234567');
    // refresh: the server now returns the stored value; a fresh page restores the same country, dial code and number
    TestBed.resetTestingModule();
    await configure('+971501234567');
    expect(flag()).toContain('AE.svg'); expect(dial()).toBe('+971'); expect(nationalValue().replace(/\s/g, '')).toBe('501234567');
  });

  it('emptying the box sends null (remove) and only alternativePhone is in the body', async () => {
    await configure('+971501234567');
    type('');
    component.saveWhatsapp();
    expect(updateContact).toHaveBeenCalledWith({ alternativePhone: null });
  });

  it('an invalid number is not sent, keeps its inline error, and nothing else on the page is lost', async () => {
    await configure(null);
    component.basicsForm.patchValue({ firstName: 'اسم جديد' });
    type('12');
    component.saveWhatsapp(); render();
    expect(updateContact).not.toHaveBeenCalled();
    expect(component.contactForm.get('alternativePhone')!.invalid).toBe(true);
    expect(component.basicsForm.get('firstName')!.value).toBe('اسم جديد');
  });

  it('a server field error lands on the WhatsApp field in Arabic and the typed number stays', async () => {
    await configure(null);
    pickCountry('+971'); type('501234567');
    updateContact.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'x', errors: [{ path: 'alternativePhone', message: 'رقم WhatsApp غير صالح' }] } })));
    vi.useFakeTimers();
    component.saveWhatsapp();
    vi.advanceTimersByTime(100);
    vi.useRealTimers();
    expect(component.contactForm.get('alternativePhone')!.errors?.['server']).toBe('رقم WhatsApp غير صالح');
    expect(component.savingWhatsapp()).toBe(false);
    expect(nationalValue().replace(/\s/g, '')).toBe('501234567');
  });

  it('saving the WhatsApp number never touches settings or the profile reload', async () => {
    await configure(null);
    type('+971501234567');
    getProfile.mockClear();
    component.saveWhatsapp();
    expect(getProfile).not.toHaveBeenCalled();
  });
});
