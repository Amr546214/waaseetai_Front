import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { SaKyc } from './sa-kyc';
import { SaKycService } from './sa-kyc.service';
import { KycDocumentService } from '../../../../core/services/kyc-document.service';

// The backend refuses a provider identity approval when no identity document is on file («لا توجد مستندات هوية لدى المزود لاعتمادها», 400).
// The admin is told BEFORE trying: the approve button is disabled with the reason; rejecting with a reason stays available; a provider with a document can be approved.
const provider = (over: any = {}) => ({ userId: 'user-1', userName: 'أحمد', kycStatus: 'PENDING', ...over });
const empty = { data: { items: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } } };

describe('sa-kyc: provider approval needs a document', () => {
	let fixture: ComponentFixture<SaKyc>;
	let component: SaKyc;
	const approve = vi.fn(() => of({ success: true }));

	beforeEach(() => {
		approve.mockClear();
		TestBed.configureTestingModule({
			imports: [SaKyc],
			providers: [
				{ provide: KycDocumentService, useValue: { createAccessLink: vi.fn() } },
				{ provide: SaKycService, useValue: { getOnboardingRequests: () => of(empty), getKycProviders: () => of(empty), approveProvider: approve } },
			],
		});
		fixture = TestBed.createComponent(SaKyc);
		component = fixture.componentInstance;
		fixture.detectChanges();
		component.activeTab.set('providers');
	});
	afterEach(() => { fixture.destroy(); TestBed.resetTestingModule(); });

	const show = (p: any) => { component.showDetailModal.set(true); component.detailLoading.set(false); component.selectedOnboarding.set(null); component.selectedProvider.set(p); fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
	const q = (id: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

	it('no document on file: approve is disabled, the reason is on the screen, and rejecting with a reason stays possible', () => {
		show(provider({ documentsCount: 0 }));
		expect((q('kyc-provider-approve') as HTMLButtonElement).disabled).toBe(true);
		expect(q('kyc-approve-blocked')?.textContent).toContain('لم يرفع هذا المزود أي مستند هوية');
		component.openActionModal('reject');
		expect(component.showActionModal()).toBe(true);
	});

	it('a document on file (backend count or a field): approve is enabled and no warning is shown', () => {
		show(provider({ documentsCount: 2 }));
		expect((q('kyc-provider-approve') as HTMLButtonElement).disabled).toBe(false);
		expect(q('kyc-approve-blocked')).toBeNull();
		show(provider({ frontIdUrl: null, frontIdUrlAccess: { private: true, legacy: false } }));
		expect((q('kyc-provider-approve') as HTMLButtonElement).disabled).toBe(false);
		component.openActionModal('approve');
		expect(component.showActionModal()).toBe(true);
	});
});
