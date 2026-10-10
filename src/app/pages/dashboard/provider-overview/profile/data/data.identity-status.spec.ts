import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Data } from './data';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// After the identity document is sent and the e-mailed code is confirmed, the page must SAY it: received, waiting for the admin, no need to upload again;
// the same state after a refresh; "verified" once the admin approved; and no second request from a second tap.
const BASE = {
	headline: 'مصمم', mainSpecialty: 'تصميم', bio: 'x'.repeat(60), country: 'السعودية', city: 'الرياض', location: '', hourlyRate: null, yearsOfExperience: null,
	user: { firstName: 'أحمد', lastName: 'علي', email: 'a@b.co', phoneNumber: '+966501234567', alternativePhone: '', idDocumentUrl: null },
	certUrls: [], skills: [{ name: 'Figma' }], portfolioItems: [], languages: [], paypalPayoutEmail: 'me@paypal.example', completionPercentage: 80, missingItems: [],
};
const NOT_SENT = { ...BASE, identityVerification: { status: 'NOT_SUBMITTED', requestId: null, submittedAt: null, rejectionReason: null } };
const PENDING = { ...BASE, identityVerification: { status: 'PENDING_REVIEW', requestId: 'r1', submittedAt: '2026-10-10T10:00:00Z', rejectionReason: null } };
const VERIFIED = { ...BASE, user: { ...BASE.user, idDocumentUrl: 'https://x.test/id.pdf' }, completionPercentage: 100, identityVerification: { status: 'VERIFIED', requestId: null, submittedAt: null, rejectionReason: null } };
const REJECTED = { ...BASE, identityVerification: { status: 'REJECTED', requestId: 'r2', submittedAt: '2026-10-10T10:00:00Z', rejectionReason: 'الصورة غير واضحة' } };

describe('provider data page: identity document status', () => {
	let fixture: ComponentFixture<Data>;
	let component: Data;
	let profile: any;
	let initiate: ReturnType<typeof vi.fn>, verify: ReturnType<typeof vi.fn>;
	const el = () => fixture.nativeElement as HTMLElement;
	const q = (s: string) => el().querySelector(s) as HTMLElement | null;
	const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };

	function setup(p: any, over: { initiate?: () => any } = {}) {
		profile = p;
		initiate = vi.fn(over.initiate ?? (() => of({ data: { requestId: 'r1', emailHint: 'a***@b.co' } })));
		verify = vi.fn(() => { profile = PENDING; return of({ data: { status: 'PENDING_HUMAN_REVIEW' } }); });
		TestBed.configureTestingModule({
			imports: [Data],
			providers: [provideRouter([]), { provide: AuthStore, useValue: { currentUser: () => null } },
				{ provide: ProviderProfileService, useValue: {
					getProfile: () => of(profile), getActiveSessions: vi.fn(() => of({ data: [] })), getChangeRequests: vi.fn(() => of([])),
					initiateSensitiveChange: initiate, verifySensitiveChange: verify, requestPaypalEmailChange: vi.fn(), confirmPaypalEmailChange: vi.fn(),
				} }],
		});
		fixture = TestBed.createComponent(Data); component = fixture.componentInstance;
		document.body.appendChild(el());
		fixture.detectChanges(); render();
	}
	afterEach(() => { el().remove(); fixture?.destroy(); TestBed.resetTestingModule(); });

	const submitDocs = () => {
		component.docsForm.patchValue({ idDocumentUrl: 'https://res.cloudinary.com/testcloud/image/upload/id.pdf' });
		component.setTab('docs'); render();
		component.saveDocs(); render();
	};

	it('confirming the code shows a clear "received / waiting for the admin / no need to re-upload" state and blocks another send', () => {
		setup(NOT_SENT);
		expect(q('[data-testid="identity-status"]')).toBeNull();
		submitDocs();
		expect(q('.modal-ov.show')).toBeTruthy();
		component.otpCode.set('123456'); component.verifyOtp(); render();
		const banner = q('[data-testid="identity-status"]')!;
		expect(banner.getAttribute('data-status')).toBe('PENDING_REVIEW');
		expect(banner.textContent).toContain('تم استلام طلب التحقق من الهوية');
		expect(banner.textContent).toContain('قيد مراجعة الإدارة');
		expect(banner.textContent).toContain('لا تحتاج إلى إعادة رفع المستند');
		expect(q('.modal-ov.show')).toBeNull();
		const btn = q('[data-testid="save-docs-btn"]') as HTMLButtonElement;
		expect(btn.disabled).toBe(true);
		expect(btn.textContent).toContain('طلب التحقق قيد المراجعة');
		expect(component.currentTab()).toBe('docs');
	});

	it('a refresh keeps the same state: the backend says PENDING_REVIEW, so the page opens with the waiting banner and no upload prompt', () => {
		setup(PENDING);
		component.setTab('docs'); render();
		const banner = q('[data-testid="identity-status"]')!;
		expect(banner.getAttribute('data-status')).toBe('PENDING_REVIEW');
		expect(banner.textContent).toContain('تم استلام طلب التحقق من الهوية، وهو الآن قيد مراجعة الإدارة');
		expect(q('[data-testid="id-doc-pending"]')!.textContent).toContain('قيد المراجعة'); // the upload area shows "under review", not an empty prompt
		expect((q('[data-testid="save-docs-btn"]') as HTMLButtonElement).disabled).toBe(true);
	});

	it('after the admin approves, the page shows "تم التحقق من الهوية" and no waiting state', () => {
		setup(VERIFIED);
		component.setTab('docs'); render();
		const banner = q('[data-testid="identity-status"]')!;
		expect(banner.getAttribute('data-status')).toBe('VERIFIED');
		expect(banner.textContent).toContain('تم التحقق من الهوية');
		expect(el().textContent).not.toContain('طلب التحقق قيد المراجعة');
	});

	it('a rejected request says so with the reason and lets the provider upload again', () => {
		setup(REJECTED);
		component.setTab('docs'); render();
		const banner = q('[data-testid="identity-status"]')!;
		expect(banner.getAttribute('data-status')).toBe('REJECTED');
		expect(banner.textContent).toContain('الصورة غير واضحة');
		expect((q('[data-testid="save-docs-btn"]') as HTMLButtonElement).disabled).toBe(false);
	});

	it('tapping send twice (even while the first is in flight) creates ONE request; with a request waiting, nothing is created at all', () => {
		const pendingInitiate = new Subject<any>();
		setup(NOT_SENT, { initiate: () => pendingInitiate.asObservable() });
		component.docsForm.patchValue({ idDocumentUrl: 'https://res.cloudinary.com/testcloud/image/upload/id.pdf' });
		component.setTab('docs'); render();
		component.saveDocs(); component.saveDocs();
		expect(initiate).toHaveBeenCalledTimes(1);
		pendingInitiate.next({ data: { requestId: 'r1', emailHint: 'a***@b.co' } }); pendingInitiate.complete();
		component.otpCode.set('123456'); component.verifyOtp(); render();
		expect(verify).toHaveBeenCalledTimes(1);
		component.saveDocs();
		expect(initiate).toHaveBeenCalledTimes(1); // pending now: no new request
	});

	it('the backend refusing a duplicate (409 REQUEST_ALREADY_PENDING) reloads the profile and shows the waiting state', () => {
		setup(NOT_SENT, { initiate: () => { profile = PENDING; return throwError(() => ({ status: 409, error: { success: false, message: 'REQUEST_ALREADY_PENDING' } })); } });
		component.docsForm.patchValue({ idDocumentUrl: 'https://res.cloudinary.com/testcloud/image/upload/id.pdf' });
		component.setTab('docs'); render();
		component.saveDocs(); render();
		expect(q('[data-testid="identity-status"]')!.getAttribute('data-status')).toBe('PENDING_REVIEW');
		expect(q('.modal-ov.show')).toBeNull();
	});

	it('the OTP modal uses the shared six-box input (not one text field) with the account-mail wording', () => {
		setup(NOT_SENT);
		submitDocs();
		expect(q('.modal-ov.show')).toBeTruthy();
		expect(el().querySelectorAll('.modal-ov ws-otp-input .otp-box').length).toBe(6);
		expect(q('.modal-ov #otp-code')).toBeNull();
		expect(q('.modal-ov .modal-desc')!.textContent).toContain('أدخل رمز التحقق المرسل إلى بريد حسابك');
	});

	it('a short code shows the error under the boxes; after a successful code no "مستند الهوية مطلوب" is shown anywhere', () => {
		setup(NOT_SENT);
		submitDocs();
		component.otpCode.set('12'); component.verifyOtp(); render();
		expect(q('[data-testid="otp-error"]')).toBeTruthy();
		component.otpCode.set('123456'); component.verifyOtp(); render();
		expect(q('.modal-ov.show')).toBeNull();
		expect(el().textContent).not.toContain('مستند الهوية مطلوب');
		expect(component.missingDocs()).toEqual([]);
	});

	it('pending: a stale "required" error on the ID field is not shown', () => {
		setup(PENDING);
		component.setTab('docs');
		component.docsForm.get('idDocumentUrl')!.setErrors({ server: 'مستند الهوية مطلوب' }); component.docsForm.get('idDocumentUrl')!.markAsTouched();
		component.missingDocs.set([{ path: 'idDocumentUrl', label: 'مستند الهوية', message: 'مستند الهوية مطلوب' } as any]); render();
		expect(el().textContent).not.toContain('مستند الهوية مطلوب');
	});

	// the admin's KYC review (a separate queue) refused the identity: the page says so, shows the safe reason, lets the provider send a new document
	const KYC_REJECTED = { ...BASE, user: { ...BASE.user, idDocumentUrl: 'private:ref' }, completionPercentage: 100,
		identityVerification: { status: 'REJECTED', requestId: null, submittedAt: null, rejectionReason: 'الصورة غير واضحة' },
		missingItems: [{ key: 'idDocument', label: 'مستند الهوية', points: 10, tab: 'docs', status: 'rejected', hint: 'مرفوض — يحتاج تعديل' }] };

	it('KYC refused: the documents tab shows REJECTED with the reason and a hint, never "verified"; the form stays open', () => {
		setup(KYC_REJECTED);
		component.setTab('docs'); render();
		const banner = q('[data-testid="identity-status"]')!;
		expect(banner.getAttribute('data-status')).toBe('REJECTED');
		expect(banner.textContent).toContain('الصورة غير واضحة');
		expect(el().textContent).not.toContain('تم التحقق من الهوية');
		expect(q('[data-testid="id-doc-rejected"]')).toBeTruthy();
		expect((q('[data-testid="save-docs-btn"]') as HTMLButtonElement).disabled).toBe(false);
	});

	it('KYC refused: the completion card says "مرفوض — يحتاج تعديل" for the identity item (not complete, not "ناقص", not pending) and asks to fix it', () => {
		setup(KYC_REJECTED);
		const item = q('[data-key="idDocument"]')!;
		expect(item.getAttribute('data-status')).toBe('rejected');
		expect(item.textContent).toContain('مرفوض — يحتاج تعديل');
		expect(item.textContent).not.toContain('ناقص');
		expect(q('[data-testid="miss-pending"]')).toBeNull();
		expect(q('[data-testid="missing-items"]')!.textContent).toContain('لإكمال ملفك إلى 100%');
	});

	it('KYC refused, then a new document is sent and confirmed: the page shows "under review", the refusal and its hint are gone, and a second send is blocked', () => {
		setup(KYC_REJECTED);
		component.setTab('docs'); render();
		component.docsForm.patchValue({ idDocumentUrl: 'https://res.cloudinary.com/testcloud/image/upload/new-id.pdf' });
		component.saveDocs(); render();
		component.otpCode.set('123456'); component.verifyOtp(); render();
		expect(q('[data-testid="identity-status"]')!.getAttribute('data-status')).toBe('PENDING_REVIEW');
		expect(q('[data-testid="id-doc-rejected"]')).toBeNull();
		expect(el().textContent).not.toContain('الصورة غير واضحة');
		expect((q('[data-testid="save-docs-btn"]') as HTMLButtonElement).disabled).toBe(true);
		initiate.mockClear(); component.saveDocs();
		expect(initiate).not.toHaveBeenCalled();
	});
});
