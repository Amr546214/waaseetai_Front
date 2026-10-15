import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SaKyc } from './sa-kyc';
import { SaKycService } from './sa-kyc.service';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../shared/forms/form-spec-utils';
import { KycDocumentService } from '../../../../core/services/kyc-document.service';

// Approve / reject need a confirmation modal; reject needs a written reason (>= 2 chars); BE messages are shown; a 409 refreshes the list.
describe('sa-kyc decisions', () => {
	let component: SaKyc; let fixture: ComponentFixture<SaKyc>; let svc: Record<string, ReturnType<typeof vi.fn>>;
	const provider = { userId: 'u-1', kycStatus: 'PENDING', userName: 'م' } as any;
	beforeEach(() => {
		svc = {
			getOnboardingRequests: vi.fn(() => of({ data: { items: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } } })),
			getKycProviders: vi.fn(() => of({ data: { items: [provider], pagination: { total: 1, page: 1, limit: 10, totalPages: 1 } } })),
			approveKycProvider: vi.fn(() => of({ success: true })),
			rejectKycProvider: vi.fn(() => of({ success: true })),
		};
		TestBed.configureTestingModule({ imports: [SaKyc], providers: [{ provide: SaKycService, useValue: svc }, { provide: KycDocumentService, useValue: { createAccessLink: vi.fn() } }] });
		const f = TestBed.createComponent(SaKyc); fixture = f; component = f.componentInstance; f.detectChanges();
		component.switchTab('providers'); component.viewProviderDetail(provider);
	});

	it('reject without a reason (or with 1 char) sends nothing and explains it under the reason box', async () => {
		fixture.detectChanges();
		component.openActionModal('reject'); fixture.detectChanges();
		component.confirmAction(); await settleForm();
		const ta = fixture.nativeElement.querySelector('#kyc-reject-reason');
		expectFieldProblem(ta, 'سبب الرفض مطلوب');
		expectFocused(ta);
		component.actionReason.set(' a '); fixture.detectChanges();
		component.confirmAction(); await settleForm();
		expectFieldProblem(ta, 'قصير');
		expect(svc['rejectKycProvider']).not.toHaveBeenCalled();
	});

	it('a 400 naming rejectionReason goes under the box; 429 / 500 / 403 / network are a generic alert; the typed reason stays', async () => {
		component.openActionModal('reject'); component.actionReason.set('سبب مكتوب'); fixture.detectChanges();
		svc['rejectKycProvider'].mockReturnValueOnce(throwError(() => httpFail(400, { errors: [{ field: 'rejectionReason', message: 'السبب غير مقبول' }] })));
		component.confirmAction(); await settleForm(); fixture.detectChanges();
		expectFieldProblem(fixture.nativeElement.querySelector('#kyc-reject-reason'), 'غير مقبول');
		for (const st of [429, 500, 403, 0]) {
			svc['rejectKycProvider'].mockReturnValueOnce(throwError(() => httpFail(st, { message: 'x' })));
			component.confirmAction(); await settleForm(); fixture.detectChanges();
			expect(component.actionError(), String(st)).toBeTruthy();
			expectNoFieldProblem(fixture.nativeElement);
			expect(fixture.nativeElement.querySelector('[data-testid="kyc-action-error"]').getAttribute('role')).toBe('alert');
		}
		expect(component.actionReason()).toBe('سبب مكتوب');
	});

	it('reject with a reason calls the API once and refreshes the list with an honest toast', () => {
		component.openActionModal('reject'); component.actionReason.set('الصورة غير واضحة');
		component.confirmAction();
		expect(svc['rejectKycProvider']).toHaveBeenCalledWith('u-1', { rejectionReason: 'الصورة غير واضحة' });
		expect(TestBed.inject(UiNotificationService).toasts().map(t => t.kind + ':' + t.message).join('|')).toMatch(/success:.*إشعار/);
		expect(svc['getKycProviders'].mock.calls.length).toBeGreaterThan(1);
	});

	it('shows the backend message (e.g. 400 no document) and does not close the modal', () => {
		svc['approveKycProvider'].mockReturnValueOnce(throwError(() => ({ status: 400, error: { message: 'لا توجد وثيقة هوية' } })));
		component.openActionModal('approve'); component.confirmAction();
		expect(component.actionError()).toBe('لا توجد وثيقة هوية');
		expect(component.showActionModal()).toBe(true);
		expect(component.processing()).toBe(false);
	});

	it('409 already decided: message shown and the list is reloaded', () => {
		svc['approveKycProvider'].mockReturnValueOnce(throwError(() => ({ status: 409, error: { message: 'تم البت في الطلب مسبقًا' } })));
		const before = svc['getKycProviders'].mock.calls.length;
		component.openActionModal('approve'); component.confirmAction();
		expect(component.actionError()).toBe('تم البت في الطلب مسبقًا');
		expect(svc['getKycProviders'].mock.calls.length).toBe(before + 1);
	});

	it('does not double-submit while a request is in flight', () => {
		component.openActionModal('approve'); component.processing.set(true);
		component.confirmAction();
		expect(svc['approveKycProvider']).not.toHaveBeenCalled();
	});
});
