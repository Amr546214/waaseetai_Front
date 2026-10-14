import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SaKyc } from './sa-kyc';
import { SaKycService } from './sa-kyc.service';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { KycDocumentService } from '../../../../core/services/kyc-document.service';

// Approve / reject need a confirmation modal; reject needs a written reason (>= 2 chars); BE messages are shown; a 409 refreshes the list.
describe('sa-kyc decisions', () => {
	let component: SaKyc; let svc: Record<string, ReturnType<typeof vi.fn>>;
	const provider = { userId: 'u-1', kycStatus: 'PENDING', userName: 'م' } as any;
	beforeEach(() => {
		svc = {
			getOnboardingRequests: vi.fn(() => of({ data: { items: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } } })),
			getKycProviders: vi.fn(() => of({ data: { items: [provider], pagination: { total: 1, page: 1, limit: 10, totalPages: 1 } } })),
			approveKycProvider: vi.fn(() => of({ success: true })),
			rejectKycProvider: vi.fn(() => of({ success: true })),
		};
		TestBed.configureTestingModule({ imports: [SaKyc], providers: [{ provide: SaKycService, useValue: svc }, { provide: KycDocumentService, useValue: { createAccessLink: vi.fn() } }] });
		const f = TestBed.createComponent(SaKyc); component = f.componentInstance; f.detectChanges();
		component.switchTab('providers'); component.viewProviderDetail(provider);
	});

	it('reject without a reason (or with 1 char) sends nothing', () => {
		component.openActionModal('reject'); component.actionReason.set(' a ');
		component.confirmAction();
		expect(svc['rejectKycProvider']).not.toHaveBeenCalled();
		expect(component.actionError()).toContain('سبب الرفض');
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
