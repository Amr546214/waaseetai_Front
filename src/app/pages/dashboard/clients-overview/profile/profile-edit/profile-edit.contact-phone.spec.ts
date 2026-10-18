import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProfileEdit } from './profile-edit';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { NotificationPreferencesService } from '../../../../../core/services/notification-preferences.service';

// D2 + D3: the contact tab sends the API a STRING (E.164), opens with the stored country/number, and one bad field never swallows the other.
describe('client profile-edit contact tab: phone payload and prefill', () => {
  let fixture: ComponentFixture<ProfileEdit>;
  let component: ProfileEdit;
  let updateTab: ReturnType<typeof vi.fn>;

  async function configure(profile: Record<string, unknown>) {
    updateTab = vi.fn(() => of({ success: true, message: 'تم التحديث' }));
    await TestBed.configureTestingModule({
      imports: [ProfileEdit],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT' }), token: () => 't', authenticate: vi.fn() } },
        { provide: NotificationPreferencesService, useValue: { getPreferences: () => of({ success: true, data: { settings: {} } }), updatePreferences: vi.fn() } },
        { provide: ProfileApiService, useValue: {
          getMyProfile: () => of({ success: true, data: { currentProfileData: { firstName: 'سارة', lastName: 'أحمد', email: 'a@b.co', ...profile }, latestHistory: [] } }),
          getChangeRequests: () => of({ success: true, data: [] }), getMyChangeRequests: () => of({ success: true, data: [] }), updateTab, updateProfile: vi.fn(() => of({ success: true })),
        } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfileEdit);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.switchTab('contact'); render();
  }
  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
  const el = () => fixture.nativeElement as HTMLElement;
  const box = (id: string) => el().querySelector(`app-phone-input[inputid="${id}"], app-phone-input:has(#${id})`) as HTMLElement;
  const dial = (id: string) => (box(id).querySelector('.dial-code') as HTMLElement).textContent!.trim();
  const flag = (id: string) => box(id).querySelector('img.flag-img')?.getAttribute('src');
  const typeWhatsapp = (text: string) => {
    const input = box('pe-whatsapp').querySelector('input.phone-number-input') as HTMLInputElement;
    input.value = text; input.dispatchEvent(new Event('input')); render();
  };
  const pickCountry = (id: string, dialCode: string) => {
    (box(id).querySelector('.country-selector-btn') as HTMLElement).click(); render();
    (Array.from(box(id).querySelectorAll('.dropdown-item')) as HTMLElement[]).find(r => r.getAttribute('aria-label')!.endsWith(dialCode))!.click(); render();
  };
  const pickCity = (country: string, city: string) => { component.contactForm.patchValue({ country }); component.contactForm.get('city')!.setValue(city); };

  afterEach(() => TestBed.resetTestingModule());

  describe('D2: the payload is the E.164 string', () => {
    beforeEach(async () => { await configure({ phoneNumber: '1025073026', phoneCountryCode: '+20', country: 'مصر', city: 'القاهرة' }); });

    it('UAE 501234567 typed in WhatsApp -> alternativePhone is the string "+971501234567" (not the phone-input object) together with the city', () => {
      pickCountry('pe-whatsapp', '+971');
      typeWhatsapp('501234567');
      pickCity('الإمارات', 'دبي');
      component.saveTab('contact');
      expect(updateTab).toHaveBeenCalledTimes(1);
      const [tab, payload] = updateTab.mock.calls[0];
      expect(tab).toBe('contact');
      expect(typeof payload.alternativePhone).toBe('string');
      expect(payload.alternativePhone).toBe('+971501234567');
      expect(payload.city).toBe('دبي');
    });

    it('a leading 0 and spaces do not double or truncate: "050 123 4567" with +971 -> +971501234567', () => {
      pickCountry('pe-whatsapp', '+971');
      typeWhatsapp('050 123 4567');
      component.saveTab('contact');
      expect(updateTab.mock.calls[0][1].alternativePhone).toBe('+971501234567');
    });

    it('a full number pasted with its code decides the country and is sent once: "+201025073026"', () => {
      typeWhatsapp('+201025073026');
      component.saveTab('contact');
      expect(updateTab.mock.calls[0][1].alternativePhone).toBe('+201025073026');
    });

    it('cleared WhatsApp sends null (remove), never an object or the empty phone value', () => {
      typeWhatsapp('+201025073026'); typeWhatsapp('');
      component.saveTab('contact');
      expect(updateTab.mock.calls[0][1].alternativePhone).toBeNull();
    });

    it('the read-only primary phone and e-mail are never sent', () => {
      component.saveTab('contact');
      expect(Object.keys(updateTab.mock.calls[0][1]).sort()).toEqual(['alternativePhone', 'city']);
    });
  });

  describe('D3: the tab opens with the stored country and number', () => {
    it('account pair (+20 / 1025073026, country Egypt) opens as Egypt +20 with the number, and WhatsApp defaults to the same country, not Saudi', async () => {
      await configure({ phoneNumber: '1025073026', phoneCountryCode: '+20', country: 'مصر', city: 'القاهرة' });
      expect(dial('pe-phone-b')).toBe('+20');
      expect(flag('pe-phone-b')).toBe('assets/flags/EG.svg');
      expect((box('pe-phone-b').querySelector('input.phone-number-input') as HTMLInputElement).value.replace(/\s/g, '')).toBe('1025073026');
      expect(dial('pe-whatsapp')).toBe('+20');
      expect(component.contactForm.get('country')!.value).toBe('مصر');
      expect(component.contactForm.get('city')!.value).toBe('القاهرة');
    });

    it('the basics tab phone (read-only) shows the same stored country', async () => {
      await configure({ phoneNumber: '1025073026', phoneCountryCode: '+20', country: 'مصر', city: 'القاهرة' });
      component.switchTab('basics'); render();
      expect(dial('pe-phone-a')).toBe('+20');
    });

    it('legacy rows: a trunk-zero number with +966, and a country-code-prefixed one', async () => {
      await configure({ phoneNumber: '0551234567', phoneCountryCode: '+966', country: 'السعودية' });
      expect([dial('pe-phone-b'), (box('pe-phone-b').querySelector('input.phone-number-input') as HTMLInputElement).value.replace(/\s/g, '')]).toEqual(['+966', '551234567']);
      TestBed.resetTestingModule();
      await configure({ phoneNumber: '966551234567', phoneCountryCode: '+966', country: 'السعودية' });
      expect((box('pe-phone-b').querySelector('input.phone-number-input') as HTMLInputElement).value.replace(/\s/g, '')).toBe('551234567');
    });

    it('a stored WhatsApp is shown with its own country and an unchanged save sends the stored value as is', async () => {
      await configure({ phoneNumber: '1025073026', phoneCountryCode: '+20', alternativePhone: '+971501234567', country: 'الإمارات', city: 'دبي' });
      expect(dial('pe-whatsapp')).toBe('+971');
      component.saveTab('contact');
      expect(updateTab.mock.calls[0][1]).toEqual({ alternativePhone: '+971501234567', city: 'دبي' });
    });

    it('an ambiguous stored WhatsApp keeps its digits visible and is never overwritten by a save', async () => {
      await configure({ phoneNumber: '1025073026', phoneCountryCode: '+20', alternativePhone: '+1999999', country: 'مصر', city: 'القاهرة' });
      expect(dial('pe-whatsapp')).toBe('+1');
      expect(box('pe-whatsapp').querySelector('img.flag-img')).toBeNull();
      component.saveTab('contact');
      // not a valid number the user can confirm: left out of the request, so the stored value is neither rewritten nor cleared
      expect(updateTab.mock.calls[0][1]).toEqual({ city: 'القاهرة' });
      expect(component.contactForm.get('alternativePhone')!.value).toBe('+1999999');
    });

    it('the stored city prefills when it belongs to the stored country; a city of another country is cleared (required rule kept)', async () => {
      await configure({ phoneNumber: '1025073026', phoneCountryCode: '+20', country: 'مصر', city: 'الرياض' });
      expect(component.contactForm.get('city')!.value).toBe('');
      expect(component.contactForm.get('city')!.hasError('required')).toBe(true);
    });
  });

  describe('one bad field never swallows the other', () => {
    beforeEach(async () => { await configure({ phoneNumber: '1025073026', phoneCountryCode: '+20', country: 'مصر', city: 'القاهرة' }); });

    it('an invalid WhatsApp is shown on its own field; the valid city is still saved', () => {
      typeWhatsapp('12');
      component.contactForm.get('city')!.setValue('الإسكندرية');
      component.saveTab('contact'); render();
      expect(updateTab).toHaveBeenCalledTimes(1);
      expect(updateTab.mock.calls[0][1]).toEqual({ city: 'الإسكندرية' });
      expect(component.contactForm.get('alternativePhone')!.invalid).toBe(true);
      expect(el().textContent).toContain('الإسكندرية');
    });

    it('a missing city still blocks (rule kept) but a changed valid WhatsApp is saved on its own', () => {
      component.contactForm.get('city')!.setValue('');
      typeWhatsapp('+201025073026');
      component.saveTab('contact'); render();
      expect(updateTab).toHaveBeenCalledTimes(1);
      expect(updateTab.mock.calls[0][1]).toEqual({ alternativePhone: '+201025073026' });
      expect(component.contactForm.get('city')!.hasError('required')).toBe(true);
    });

    it('a server field error on alternativePhone lands on that field only, city stays valid and untouched by the error', () => {
      updateTab.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 400, error: { success: false, message: 'بيانات غير صحيحة، يرجى مراجعة الحقول المحددة', errors: [{ path: 'alternativePhone', field: 'alternativePhone', message: 'رقم WhatsApp غير صالح' }] } })));
      typeWhatsapp('+201025073026');
      component.saveTab('contact'); render();
      expect(component.contactForm.get('alternativePhone')!.errors?.['server']).toBe('رقم WhatsApp غير صالح');
      expect(component.contactForm.get('city')!.errors).toBeNull();
      expect(component.contactForm.get('city')!.value).toBe('القاهرة');
    });
  });
});
