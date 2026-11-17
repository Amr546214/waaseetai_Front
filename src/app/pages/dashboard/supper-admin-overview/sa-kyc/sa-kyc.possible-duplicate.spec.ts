import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SaKyc } from './sa-kyc';
import { SaKycService } from './sa-kyc.service';
import { KycDocumentService } from '../../../../core/services/kyc-document.service';
import { httpFail, settleForm } from '../../../../shared/forms/form-spec-utils';

// Same name + birth date as an approved account (another document): the backend refuses the approval until the administrator confirms it is a different person.
describe('sa-kyc possible duplicate identity', () => {
	let component: SaKyc; let fixture: ComponentFixture<SaKyc>; let svc: Record<string, ReturnType<typeof vi.fn>>;
	const provider = { userId: 'u-1', kycStatus: 'PENDING', userName: 'م' } as any;
	const DUP = { message: 'يوجد حساب آخر معتمد بنفس الاسم الحقيقي وتاريخ الميلاد', errors: [{ code: 'POSSIBLE_DUPLICATE_IDENTITY', duplicateUserIds: ['old-1'] }] };
	beforeEach(() => {
		svc = {
			getOnboardingRequests: vi.fn(() => of({ data: { items: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } } })),
			getKycProviders: vi.fn(() => of({ data: { items: [provider], pagination: { total: 1, page: 1, limit: 10, totalPages: 1 } } })),
			approveKycProvider: vi.fn(() => of({ success: true })),
		};
		TestBed.configureTestingModule({ imports: [SaKyc], providers: [{ provide: SaKycService, useValue: svc }, { provide: KycDocumentService, useValue: { createAccessLink: vi.fn() } }] });
		fixture = TestBed.createComponent(SaKyc); component = fixture.componentInstance; fixture.detectChanges();
		component.switchTab('providers'); component.viewProviderDetail(provider);
	});

	it('the first approval is plain; a possible-duplicate refusal keeps the modal open with the message, the other account and a confirmation box; ticking it re-sends with the confirmation', async () => {
		component.openActionModal('approve'); fixture.detectChanges();
		svc['approveKycProvider'].mockReturnValueOnce(throwError(() => httpFail(409, DUP)));
		component.confirmAction(); await settleForm(); fixture.detectChanges();
		expect(svc['approveKycProvider']).toHaveBeenCalledWith('u-1', undefined);
		expect(component.showActionModal()).toBe(true);
		expect(component.duplicateAccounts()).toEqual(['old-1']);
		expect(fixture.nativeElement.querySelector('[data-testid="kyc-action-error"]').textContent).toContain('بنفس الاسم');
		const box = fixture.nativeElement.querySelector('[data-testid="kyc-duplicate-checkbox"]') as HTMLInputElement;
		expect(box).toBeTruthy();
		expect(fixture.nativeElement.querySelector('[data-testid="kyc-duplicate-confirm"]').textContent).toContain('old-1');
		box.checked = true; box.dispatchEvent(new Event('change')); fixture.detectChanges();
		component.confirmAction(); await settleForm();
		expect(svc['approveKycProvider']).toHaveBeenLastCalledWith('u-1', { confirmNotDuplicate: true });
	});

	it('opening the modal again starts clean: no leftover confirmation or accounts', () => {
		component.duplicateAccounts.set(['x']); component.confirmNotDuplicate.set(true);
		component.openActionModal('approve');
		expect(component.duplicateAccounts()).toEqual([]);
		expect(component.confirmNotDuplicate()).toBe(false);
	});

	it('another 409 (already decided) still refreshes the list and shows no confirmation box', async () => {
		component.openActionModal('approve');
		svc['approveKycProvider'].mockReturnValueOnce(throwError(() => httpFail(409, { message: 'تمت معالجة هذا الطلب مسبقاً' })));
		const before = svc['getKycProviders'].mock.calls.length;
		component.confirmAction(); await settleForm(); fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[data-testid="kyc-duplicate-checkbox"]')).toBeNull();
		expect(svc['getKycProviders'].mock.calls.length).toBeGreaterThan(before);
	});
});
