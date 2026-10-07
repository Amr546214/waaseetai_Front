import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';
import { SaBrokerKycRequests } from './sa-broker-kyc-requests';
import { MarketerKycService } from '../../../../../core/services/marketer-kyc.service';
import { KycDocumentService } from '../../../../../core/services/kyc-document.service';

// #51 — admin queue of marketer identity documents: view (marketer_kyc_document + userId), approve, reject with a REQUIRED reason.
const ROWS = [
	{ affiliateId: 'a1', userId: 'u1', referralSlug: 's1', name: 'خالد العتيبي', email: 'k@x.com', submittedAt: '2026-10-01T10:00:00Z' },
	{ affiliateId: 'a2', userId: 'u2', referralSlug: 's2', name: 'سارة أحمد', email: 's@x.com', submittedAt: '2026-10-02T10:00:00Z' },
];

describe('admin: marketer KYC requests (#51)', () => {
	let fixture: ComponentFixture<SaBrokerKycRequests>;
	let api: any;
	let createAccessLink: ReturnType<typeof vi.fn>;

	const setup = (rows = ROWS, over: any = {}) => {
		createAccessLink = vi.fn(() => of({ url: 'https://x', expiresAt: null, expiresInSeconds: 120, private: true, legacy: false }));
		api = {
			listRequests: vi.fn(() => of({ items: rows, pagination: { page: 1, limit: 50, total: rows.length, totalPages: 1 } })),
			approve: vi.fn(() => of({})), reject: vi.fn(() => of({})), ...over,
		};
		TestBed.configureTestingModule({ imports: [SaBrokerKycRequests], providers: [{ provide: MarketerKycService, useValue: api }, { provide: KycDocumentService, useValue: { createAccessLink } }] });
		fixture = TestBed.createComponent(SaBrokerKycRequests);
		fixture.detectChanges();
	};
	const el = () => fixture.nativeElement as HTMLElement;
	const q = (id: string) => el().querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
	const all = (id: string) => Array.from(el().querySelectorAll(`[data-testid="${id}"]`)) as HTMLElement[];
	const typeReason = (text: string) => { const ta = q('kyc-reason') as HTMLTextAreaElement; ta.value = text; ta.dispatchEvent(new Event('input')); fixture.detectChanges(); };
	afterEach(() => TestBed.resetTestingModule());

	it('lists the pending requests with name, email and the count; empty state when none', () => {
		setup();
		expect(all('kyc-row').length).toBe(2);
		expect(q('kyc-count')!.textContent).toContain('2');
		expect(el().textContent).toContain('خالد العتيبي');
		TestBed.resetTestingModule();
		setup([]);
		expect(q('kyc-empty')).toBeTruthy();
	});

	it('the view button opens the document through the access-link endpoint with the key marketer_kyc_document and the owner\'s userId', () => {
		setup();
		(all('kyc-row')[1].querySelector('app-kyc-document-link button') as HTMLButtonElement).click();
		expect(createAccessLink).toHaveBeenCalledWith(expect.objectContaining({ document: 'marketer_kyc_document', userId: 'u2' }));
	});

	it('approve calls the endpoint for that request and removes it from the queue', () => {
		setup();
		(all('kyc-approve')[0]).click();
		fixture.detectChanges();
		expect(api.approve).toHaveBeenCalledWith('a1');
		expect(all('kyc-row').length).toBe(1);
		expect(q('kyc-notice')!.textContent).toContain('خالد العتيبي');
		expect(q('kyc-count')!.textContent).toContain('1');
	});

	it('reject opens a dialog; confirming with an empty / too-short reason is blocked with an Arabic message and sends nothing', () => {
		setup();
		all('kyc-reject')[0].click();
		fixture.detectChanges();
		expect(q('kyc-reject-dialog')).toBeTruthy();
		q('kyc-reject-confirm')!.click();
		fixture.detectChanges();
		expect(api.reject).not.toHaveBeenCalled();
		expect(q('kyc-reason-error')!.textContent).toContain('سبب الرفض مطلوب');
		typeReason('ab');
		q('kyc-reject-confirm')!.click();
		fixture.detectChanges();
		expect(api.reject).not.toHaveBeenCalled();
	});

	it('reject with a reason sends it (trimmed), closes the dialog and removes the request', () => {
		setup();
		all('kyc-reject')[1].click();
		fixture.detectChanges();
		typeReason('  الصورة غير واضحة  ');
		q('kyc-reject-confirm')!.click();
		fixture.detectChanges();
		expect(api.reject).toHaveBeenCalledWith('a2', 'الصورة غير واضحة');
		expect(q('kyc-reject-dialog')).toBeNull();
		expect(all('kyc-row').length).toBe(1);
		expect(q('kyc-notice')!.textContent).toContain('سارة أحمد');
	});

	it('backend failures are shown in Arabic and the list is reloaded (409 already decided)', () => {
		setup(ROWS, { approve: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'تم اعتماد هذا الطلب مسبقًا' } }))) });
		all('kyc-approve')[0].click();
		fixture.detectChanges();
		expect(q('kyc-action-error')!.textContent).toContain('تم اعتماد هذا الطلب مسبقًا');
		expect(api.listRequests).toHaveBeenCalledTimes(2);
	});

	it('a list failure shows an Arabic error with retry; the stored reference is never rendered', () => {
		setup(ROWS, { listRequests: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 }))) });
		expect(el().textContent).toContain('إعادة المحاولة');
		TestBed.resetTestingModule();
		setup();
		expect(el().innerHTML).not.toMatch(/private:|cloudinary/i);
	});
});
