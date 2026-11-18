import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Data } from './data';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// The identity document picked on the profile data page is read by the AI like in the setup wizard: not an ID / unreadable = removed with the reason; anything else stays.
const PROFILE = {
  headline: 'مصمم', mainSpecialty: 'تصميم', bio: '', country: 'السعودية', city: 'الرياض', location: '', hourlyRate: null, yearsOfExperience: null,
  user: { firstName: 'أحمد', lastName: 'علي', email: 'a@b.co', phoneNumber: '+966501234567', alternativePhone: '', idDocumentUrl: '' },
  certUrls: [], skills: [], portfolioItems: [], languages: [],
};
const PNG = () => new File([new Uint8Array(2000).fill(7)], 'id.png', { type: 'image/png' });
const flush = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 10)); };

describe('provider data page: the AI reads the identity document', () => {
  let fixture: ComponentFixture<Data>;
  let c: any;
  let svc: Record<string, ReturnType<typeof vi.fn>>;
  const setup = (verdict: any) => {
    (Element.prototype as any).scrollIntoView = vi.fn();
    svc = {
      getProfile: vi.fn(() => of(PROFILE)),
      getSpecialtyCategories: vi.fn(() => of({ success: true, data: [] })), getSkillsCatalog: vi.fn(() => of({ success: true, data: { category: null, skills: [] } })), getActiveSessions: vi.fn(() => of({ success: true, data: [] })),
      getChangeRequests: vi.fn(() => of([])),
      uploadDocument: vi.fn(() => of({ type: 4, body: { data: { url: 'https://res.cloudinary.com/x/id.png', name: 'id.png' } } })),
      verifyIdentityDocument: vi.fn(() => of({ success: true, data: verdict })),
    };
    TestBed.configureTestingModule({ imports: [Data], providers: [provideRouter([]), { provide: AuthStore, useValue: { currentUser: () => null } }, { provide: ProviderProfileService, useValue: svc }] });
    fixture = TestBed.createComponent(Data);
    c = fixture.componentInstance;
    fixture.detectChanges();
    fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges();
  };
  afterEach(() => { fixture?.destroy(); TestBed.inject(UiNotificationService).clearAll(); TestBed.resetTestingModule(); });
  const pick = () => c.onDocSelected({ target: { files: [PNG()], value: 'x' } }, 'idDocumentUrl');

  it('a picture that is not an identity document is removed and the AI reason sits on the field', async () => {
    setup({ status: 'NOT_ID_DOCUMENT', isIdentityDocument: false, readability: 'UNREADABLE', summaryAr: 'الصورة ليست وثيقة هوية', warningsAr: [] });
    pick(); await flush(); fixture.detectChanges();
    expect(svc['verifyIdentityDocument']).toHaveBeenCalled();
    expect(c.docsForm.get('idDocumentUrl').value).toBe('');
    expect(c.docFileErrors()['idDocumentUrl']).toContain('ليست وثيقة هوية');
  });

  it('a clear identity document stays and the reading is shown', async () => {
    setup({ status: 'CLEAR_VALID', isIdentityDocument: true, readability: 'CLEAR', sideMatchesExpected: true, summaryAr: 'وثيقة واضحة', warningsAr: [] });
    pick(); await flush(); fixture.detectChanges();
    expect(c.docsForm.get('idDocumentUrl').value).toBe('https://res.cloudinary.com/x/id.png');
    expect(c.idDocCheck()?.status).toBe('valid');
  });
});
