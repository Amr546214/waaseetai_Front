import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { SaKyc } from './sa-kyc';
import { SaKycService } from './sa-kyc.service';
import { KycDocumentService } from '../../../../core/services/kyc-document.service';

// A provider whose identity was refused sends a NEW document: it waits in «طلبات تعديل الملف». The KYC row still shows the OLD document, so the page says so,
// opens the NEW one (profile_request_document by request id) and takes approve / reject out of reach (the backend answers 409 for them).
const empty = { data: { items: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } } };
const provider = (over: any = {}) => ({ userId: 'user-1', userName: 'أحمد', kycStatus: 'PENDING', documentsCount: 1, frontIdUrl: null, frontIdUrlAccess: { private: true, legacy: false }, ...over });

describe('sa-kyc: a new identity document waits in the request queue', () => {
	let fixture: ComponentFixture<SaKyc>;
	let component: SaKyc;
	const createAccessLink = vi.fn(() => of({ url: 'https://signed.example/x', expiresAt: null, expiresInSeconds: 120, private: true, legacy: false }));
	beforeEach(() => {
		createAccessLink.mockClear();
		TestBed.configureTestingModule({ imports: [SaKyc], providers: [
			{ provide: KycDocumentService, useValue: { createAccessLink } },
			{ provide: SaKycService, useValue: { getOnboardingRequests: () => of(empty), getKycProviders: () => of(empty), approveProvider: vi.fn(), rejectProvider: vi.fn() } },
		] });
		fixture = TestBed.createComponent(SaKyc); component = fixture.componentInstance; fixture.detectChanges(); component.activeTab.set('providers');
	});
	afterEach(() => { fixture.destroy(); TestBed.resetTestingModule(); });
	const show = (p: any) => { component.showDetailModal.set(true); component.detailLoading.set(false); component.selectedOnboarding.set(null); component.selectedProvider.set(p); fixture.componentRef.injector.get(ChangeDetectorRef).detectChanges(); };
	const q = (id: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

	it('with a waiting request: the new document link is shown, approve AND reject are disabled, the reason says where to decide', () => {
		show(provider({ pendingIdentityRequestId: '11111111-2222-4333-8444-555555555555' }));
		expect(q('kyc-new-identity-doc')?.textContent).toContain('عرض المستند الجديد');
		expect((q('kyc-provider-approve') as HTMLButtonElement).disabled).toBe(true);
		expect((q('kyc-provider-reject') as HTMLButtonElement).disabled).toBe(true);
		expect(q('kyc-approve-blocked')?.textContent).toContain('طلبات تعديل الملف');
		(q('kyc-new-identity-doc')!.querySelector('a, button') as HTMLElement).click();
		expect(createAccessLink).toHaveBeenCalledWith(expect.objectContaining({ document: 'profile_request_document', id: '11111111-2222-4333-8444-555555555555' }));
	});

	it('without a waiting request nothing changes: no new-document row, approve and reject stay available', () => {
		show(provider({ pendingIdentityRequestId: null }));
		expect(q('kyc-new-identity-doc')).toBeNull();
		expect((q('kyc-provider-approve') as HTMLButtonElement).disabled).toBe(false);
		expect((q('kyc-provider-reject') as HTMLButtonElement).disabled).toBe(false);
	});
});
