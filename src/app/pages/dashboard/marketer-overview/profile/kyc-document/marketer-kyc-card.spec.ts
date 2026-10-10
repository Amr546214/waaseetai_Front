import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';
import { MarketerKycCard } from './marketer-kyc-card';
import { MarketerKycService } from '../../../../../core/services/marketer-kyc.service';
import { KycDocumentService } from '../../../../../core/services/kyc-document.service';

// #51 — marketer identity document screen: NONE / PENDING / APPROVED, upload rules, generic rejection note.
describe('marketer KYC card (#51)', () => {
	let fixture: ComponentFixture<MarketerKycCard>;
	let upload: ReturnType<typeof vi.fn>;
	let createAccessLink: ReturnType<typeof vi.fn>;

	const setup = (status: string, uploadImpl?: () => any, reason: string | null = null) => {
		upload = vi.fn(uploadImpl ?? (() => of({ status: 'PENDING' })));
		createAccessLink = vi.fn(() => of({ url: 'https://x', expiresAt: null, expiresInSeconds: 120, private: true, legacy: false }));
		TestBed.configureTestingModule({
			imports: [MarketerKycCard],
			providers: [
				{ provide: MarketerKycService, useValue: { getStatus: () => (status === 'FAIL' ? throwError(() => new HttpErrorResponse({ status: 500 })) : of({ status, rejectionReason: reason, reviewedAt: null })), upload } },
				{ provide: KycDocumentService, useValue: { createAccessLink } },
			],
		});
		fixture = TestBed.createComponent(MarketerKycCard);
		fixture.detectChanges();
	};
	const el = () => fixture.nativeElement as HTMLElement;
	const q = (id: string) => el().querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
	const pick = (name: string, type: string, size = 100) => {
		const input = q('kyc-file') as HTMLInputElement;
		const file = new File([new Uint8Array(size)], name, { type });
		Object.defineProperty(input, 'files', { value: [file], configurable: true });
		input.dispatchEvent(new Event('change'));
		fixture.detectChanges();
	};
	afterEach(() => TestBed.resetTestingModule());

	it('NONE: asks for the document, shows the upload button and the generic rejection note', () => {
		setup('NONE');
		expect(q('kyc-status')!.textContent).toContain('لم يُرفع مستند');
		expect(q('kyc-none-text')).toBeTruthy();
		expect(q('kyc-file')).toBeTruthy();
		expect(q('kyc-reject-note')!.textContent).toContain('سبب الرفض');
		expect(el().textContent).toContain('رفع المستند');
	});

	it('PENDING: says it is under review, offers a view link (marketer_kyc_document) and a replace button', () => {
		setup('PENDING');
		expect(q('kyc-status')!.textContent).toContain('قيد المراجعة');
		expect(q('kyc-pending-text')).toBeTruthy();
		expect(el().textContent).toContain('استبدال المستند');
		(el().querySelector('app-kyc-document-link button') as HTMLButtonElement).click();
		expect(createAccessLink).toHaveBeenCalledWith(expect.objectContaining({ document: 'marketer_kyc_document' }));
		expect(createAccessLink.mock.calls[0][0].userId).toBeUndefined();
	});

	it('APPROVED: verified text, no upload control at all', () => {
		setup('APPROVED');
		expect(q('kyc-status')!.textContent).toContain('موثّق');
		expect(q('kyc-approved-text')).toBeTruthy();
		expect(q('kyc-file')).toBeNull();
		expect(q('kyc-reject-note')).toBeNull();
	});

	it('a valid file is uploaded and the card moves to PENDING with a success message', () => {
		setup('NONE');
		pick('id.png', 'image/png');
		expect(upload).toHaveBeenCalledTimes(1);
		expect((upload.mock.calls[0][0] as File).name).toBe('id.png');
		expect(q('kyc-status')!.textContent).toContain('قيد المراجعة');
		expect(q('kyc-success')!.textContent).toContain('تم رفع المستند');
	});

	it('a wrong type or an oversize file is refused in Arabic BEFORE any request', () => {
		setup('NONE');
		pick('x.svg', 'image/svg+xml');
		expect(upload).not.toHaveBeenCalled();
		expect(q('kyc-error')!.textContent).toContain('نوع الملف غير مسموح');
		pick('big.png', 'image/png', 6 * 1024 * 1024);
		expect(upload).not.toHaveBeenCalled();
		expect(q('kyc-error')!.textContent).toContain('حجم الملف كبير');
	});

	it('backend refusals are shown in Arabic: 415, 413 and 409 (already verified → status reloaded)', () => {
		setup('NONE', () => throwError(() => new HttpErrorResponse({ status: 415, error: { message: 'نوع الملف غير مسموح به' } })));
		pick('a.png', 'image/png');
		expect(q('kyc-error')!.textContent).toContain('نوع الملف غير مسموح به');
	});
	it('413 with a proxy page body → the fixed Arabic size message', () => {
		setup('NONE', () => throwError(() => new HttpErrorResponse({ status: 413, error: '<html>413</html>' })));
		pick('a.png', 'image/png');
		expect(q('kyc-error')!.textContent).toContain('أكبر من الحد المسموح');
	});
	it('409 already verified: the message is shown', () => {
		setup('PENDING', () => throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'تم توثيق هويتك مسبقًا ولا يمكن رفع مستند جديد' } })));
		pick('a.png', 'image/png');
		expect(q('kyc-error')!.textContent).toContain('تم توثيق هويتك مسبقًا');
	});

	it('a status load failure says so and offers a retry (never pretends NONE)', () => {
		setup('FAIL');
		expect(el().textContent).toContain('تعذر تحميل حالة التوثيق');
		expect(q('kyc-file')).toBeNull();
	});

	it('the reference of the stored file never appears anywhere in the card', () => {
		setup('PENDING');
		expect(el().innerHTML).not.toMatch(/private:|cloudinary/i);
	});

	it('REJECTED: shows "رُفض المستند" with the admin reason, keeps the upload open, and a new upload clears it and shows pending', () => {
		setup('REJECTED', undefined, 'الصورة غير واضحة');
		expect(q('kyc-status')!.textContent).toContain('رُفض المستند');
		expect(q('kyc-rejected')!.textContent).toContain('الصورة غير واضحة');
		expect(q('kyc-none-text')).toBeNull();
		expect(q('kyc-file')).toBeTruthy();
		pick('id.png', 'image/png');
		expect(upload).toHaveBeenCalledTimes(1);
		expect(q('kyc-rejected')).toBeNull();
		expect(q('kyc-status')!.textContent).toContain('قيد المراجعة');
	});

	it('REJECTED without a stored reason still says it was rejected (never looks like "nothing uploaded")', () => {
		setup('REJECTED');
		expect(q('kyc-rejected')!.textContent).toContain('رُفض مستند الهوية');
	});
});
