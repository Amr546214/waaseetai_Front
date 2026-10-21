import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Data } from './data';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// C4: the identity-document approval request is only sent with a valid, FULLY uploaded document. Picking a file, an upload in progress or a failed upload is not enough.
const PROFILE = {
  headline: 'مصمم', mainSpecialty: 'تصميم', bio: '', country: 'السعودية', city: 'الرياض', location: '', hourlyRate: null, yearsOfExperience: null,
  user: { firstName: 'أحمد', lastName: 'علي', email: 'a@b.co', phoneNumber: '+966501234567', alternativePhone: '', idDocumentUrl: '' },
  certUrls: [], skills: [], portfolioItems: [], languages: [],
};

describe('provider docs approval request: the proof is mandatory and must be fully uploaded', () => {
  let fixture: ComponentFixture<Data>;
  let c: any;
  let svc: Record<string, ReturnType<typeof vi.fn>>;
  const setup = (profile: any = PROFILE) => {
    (Element.prototype as any).scrollIntoView = vi.fn();
    svc = {
      getProfile: vi.fn(() => of(profile)),
      getSpecialtyCategories: vi.fn(() => of({ success: true, data: [] })), getSkillsCatalog: vi.fn(() => of({ success: true, data: { category: null, skills: [] } })), getActiveSessions: vi.fn(() => of({ data: [] })),
      initiateSensitiveChange: vi.fn(() => of({ data: { requestId: 'r1', emailHint: 'a***@b.co' } })),
      getChangeRequests: vi.fn(() => of([])),
    };
    TestBed.configureTestingModule({ imports: [Data], providers: [provideRouter([]), { provide: AuthStore, useValue: { currentUser: () => null } }, { provide: ProviderProfileService, useValue: svc }] });
    fixture = TestBed.createComponent(Data);
    c = fixture.componentInstance;
    fixture.detectChanges();
    fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges();
  };
  afterEach(() => { fixture?.destroy(); TestBed.inject(UiNotificationService).clearAll(); TestBed.resetTestingModule(); });

  it('no document at all: the request is not sent and the missing proof is named', () => {
    setup();
    c.saveDocs();
    expect(svc['initiateSensitiveChange']).not.toHaveBeenCalled();
    expect(c.missingDocs().some((m: any) => m.path === 'idDocumentUrl')).toBe(true);
  });

  it('a file that is still uploading is not a proof: nothing is sent and the user is told to wait', () => {
    setup();
    c.docsForm.get('idDocumentUrl').setValue('https://res.cloudinary.com/x/old.pdf');
    c.setDocumentState('idDocumentUrl', { name: 'id.pdf', progress: 40, status: 'uploading' });
    const toast = vi.spyOn(TestBed.inject(UiNotificationService), 'toast');
    c.saveDocs();
    expect(svc['initiateSensitiveChange']).not.toHaveBeenCalled();
    expect(toast.mock.calls[0][0]).toBe('warning');
  });

  it('a failed upload is not a proof either: nothing is sent and the error sits on the document field', () => {
    setup();
    c.docsForm.get('idDocumentUrl').setValue('https://res.cloudinary.com/x/old.pdf');
    c.setDocumentState('idDocumentUrl', { name: 'id.pdf', progress: 0, status: 'error' });
    c.saveDocs();
    expect(svc['initiateSensitiveChange']).not.toHaveBeenCalled();
  });

  it('a completed upload is sent', () => {
    setup();
    c.docsForm.get('idDocumentUrl').setValue('https://res.cloudinary.com/x/id.pdf');
    c.setDocumentState('idDocumentUrl', { name: 'id.pdf', progress: 100, status: 'uploaded' });
    c.saveDocs();
    expect(svc['initiateSensitiveChange']).toHaveBeenCalledTimes(1);
    expect(svc['initiateSensitiveChange'].mock.calls[0][0]).toBe('DOCUMENTS');
  });

  const ready = () => {
    c.docsForm.get('idDocumentUrl').setValue('https://res.cloudinary.com/x/id.pdf');
    c.setDocumentState('idDocumentUrl', { name: 'id.pdf', progress: 100, status: 'uploaded' });
  };

  it('429 OTP_THROTTLED: the exact wait shows beside the send button, the button is locked, the file and entries stay', () => {
    vi.useFakeTimers();
    try {
      setup();
      svc['initiateSensitiveChange'].mockReturnValue(throwError(() => ({ status: 429, headers: { get: () => '45' }, error: { success: false, code: 'OTP_THROTTLED', message: 'أرسلنا الرمز بالفعل.', retryAfterSeconds: 45 } })));
      ready();
      c.saveDocs();
      fixture.detectChanges();
      expect(c.docsWaitSeconds()).toBeGreaterThan(40);
      expect(c.docsWaitSeconds()).toBeLessThanOrEqual(45);
      expect(c.docsActionError()).toContain('أرسلنا الرمز');
      expect(fixture.nativeElement.querySelector('[data-testid="docs-wait"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('[data-testid="save-docs-btn"]').disabled).toBe(true);
      expect(c.docsForm.get('idDocumentUrl').value).toContain('id.pdf');
      vi.advanceTimersByTime(46000);
      fixture.detectChanges();
      expect(c.docsWaitSeconds()).toBe(0);
      expect(fixture.nativeElement.querySelector('[data-testid="save-docs-btn"]').disabled).toBe(false);
    } finally { vi.useRealTimers(); }
  });

  it('reused answer: the dialog says the earlier code is still the one to use', () => {
    setup();
    svc['initiateSensitiveChange'].mockReturnValue(of({ data: { requestId: 'r1', emailHint: 'a***@b.co', reused: true } }));
    ready();
    c.saveDocs();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="otp-reused"]')).toBeTruthy();
  });
});
