import { signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { SpecialtyService } from '../../../../../core/services/specialty.service';
import { SetupTestService } from '../../../../../core/services/setup-test.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Setup wizard: the photo is persisted (and never reported as there when the upload failed), skills come from the chosen field's catalog, the date of birth round-trips.
const STORED = 'https://res.cloudinary.com/demo/image/upload/v1/waseetai/users/u1/avatar/me.jpg';
const DESIGN = ['Figma', 'Adobe Photoshop', 'تصميم الشعارات'];
const CATEGORIES = [
  { id: 'c1', slug: 'programming-development', nameAr: 'برمجة وتطوير' },
  { id: 'c2', slug: 'design-creative', nameAr: 'تصميم وإبداع' },
];

describe('provider setup wizard: the AI reads the selfie-with-document photo and the certificates before they are uploaded', () => {
  let fixture: ComponentFixture<ProfileSetupDashboard>;
  let component: ProfileSetupDashboard;
  let http: HttpTestingController;
  let save: ReturnType<typeof vi.fn>;
  const setup = async (stored: any) => {
    save = vi.fn(() => of({ success: true }));
    await TestBed.configureTestingModule({
      imports: [ProfileSetupDashboard],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthStore, useValue: { currentUser: () => ({ id: 'u1', accountType: 'PROVIDER_INDIVIDUAL' }), updateUser: () => {} } },
        { provide: ProfileApiService, useValue: { getProviderProfileSetup: () => of({ data: stored }), saveProviderProfileSetup: save } },
        { provide: SpecialtyService, useValue: { getCategories: () => of({ success: true, data: CATEGORIES }), getPublicSpecialties: () => of({ success: true, data: [] }) } },
        { provide: SetupTestService, useValue: { needsExamEnvironment: signal(false), warningMsg: signal(null), errorMsg: signal(null), bannedMsg: signal(null), result: signal(null), totalQuestions: signal(0), currentQuestion: signal(null), isGenerating: signal(false), statusMsg: signal(''), disconnect: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfileSetupDashboard);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  };
  afterEach(() => { http.match(r => r.url.includes('/legal-name')).forEach(r => r.flush({ success: true, data: { status: 'PROVIDED', legalName: 'اسم حقيقي كامل', changeNeedsReview: false, pendingRequest: null } })); http.match(r => r.url.includes('/public/geo-suggestion')).forEach(r => r.flush({ success: true, data: { source: 'none' } })); http.match(r => r.url.includes('/skills/catalog')).forEach(r => r.flush({ success: true, data: { category: null, skills: [] } })); http.verify(); fixture.destroy(); });


  const file = (name = 'a.png', type = 'image/png') => new File([new Uint8Array(2000).fill(5)], name, { type });
  const waitFor = async (match: (r: any) => boolean) => { for (let i = 0; i < 100; i++) { const hit = http.match(match); if (hit.length) return hit; await new Promise(r => setTimeout(r, 10)); } return []; };
  const none = (match: (r: any) => boolean) => http.match(match).length === 0;

  it('a selfie that is not a person is refused with the AI reason and nothing is uploaded', async () => {
    await setup({ skills: [] });
    component.onFileSelected({ target: { files: [file()], value: 'x' } }, 'selfie');
    const [req] = await waitFor(r => r.url.endsWith('/verify-selfie'));
    req.flush({ success: true, data: { status: 'NOT_A_SELFIE', summaryAr: 'لم يظهر وجه شخص', warningsAr: [] } });
    await new Promise(r => setTimeout(r, 30));
    expect(component.fileErr('selfie')).toContain('لم يظهر وجه شخص');
    expect(none(r => r.url.endsWith('/documents/upload'))).toBe(true);
  });

  it('a clear selfie goes on to the upload and shows the reading', async () => {
    await setup({ skills: [] });
    component.onFileSelected({ target: { files: [file()], value: 'x' } }, 'selfie');
    const [req] = await waitFor(r => r.url.endsWith('/verify-selfie'));
    req.flush({ success: true, data: { status: 'CLEAR_VALID', summaryAr: 'ok', warningsAr: [] } });
    const upload = await waitFor(r => r.url.endsWith('/documents/upload'));
    expect(upload.length).toBe(1);
    expect(component.supportingChecks()['selfie']?.status).toBe('valid');
    upload.forEach(r => r.flush({ data: { url: 'https://res.cloudinary.com/x/s.png', name: 's.png' } }));
  });

  it('a file that is not a certificate is refused and nothing is uploaded; a readable one is uploaded', async () => {
    await setup({ skills: [] });
    component.onFileSelected({ target: { files: [file('c.png')], value: 'x' } }, 'certs');
    const [bad] = await waitFor(r => r.url.endsWith('/verify-certificate'));
    bad.flush({ success: true, data: { status: 'NOT_CERTIFICATE', summaryAr: 'الملف ليس شهادة', warningsAr: [] } });
    await new Promise(r => setTimeout(r, 30));
    expect(component.fileErr('certs')).toContain('الملف ليس شهادة');
    expect(none(r => r.url.endsWith('/documents/upload'))).toBe(true);
    component.onFileSelected({ target: { files: [file('d.png')], value: 'x' } }, 'certs');
    const [good] = await waitFor(r => r.url.endsWith('/verify-certificate'));
    good.flush({ success: true, data: { status: 'CLEAR_VALID', summaryAr: '', warningsAr: [] } });
    const upload = await waitFor(r => r.url.endsWith('/documents/upload'));
    expect(upload.length).toBe(1);
    upload.forEach(r => r.flush({ data: { url: 'https://res.cloudinary.com/x/c.png', name: 'c.png' } }));
  });

  it('when the AI is down the file still goes on, with a note that the admin will review it', async () => {
    await setup({ skills: [] });
    component.onFileSelected({ target: { files: [file()], value: 'x' } }, 'selfie');
    const [req] = await waitFor(r => r.url.endsWith('/verify-selfie'));
    req.flush({ message: 'down' }, { status: 503, statusText: 'Service Unavailable' });
    const upload = await waitFor(r => r.url.endsWith('/documents/upload'));
    expect(upload.length).toBe(1);
    expect(component.supportingChecks()['selfie']?.status).toBe('warning');
    upload.forEach(r => r.flush({ data: { url: 'https://res.cloudinary.com/x/s.png', name: 's.png' } }));
  });
});
