import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { SaKyc } from './sa-kyc';
import { SaKycService } from './sa-kyc.service';
import { KycDocumentService } from '../../../../core/services/kyc-document.service';

// Admin KYC review with private KYC storage: documents are opened through the access-link endpoint (admin passes userId / the record id);
// legacy documents keep their old link; nothing uploaded says so.
const PRIVATE = { private: true, legacy: false };
const LEGACY_URL = 'https://res.cloudinary.com/c/image/upload/v1/waseetai/providers/u1/identity/old.png';
const provider = (over: any = {}) => ({ userId: 'user-1', userName: 'أحمد', kycStatus: 'PENDING', ...over });

describe('sa-kyc: documents', () => {
	let fixture: ComponentFixture<SaKyc>;
	let component: SaKyc;
	let createAccessLink: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		createAccessLink = vi.fn(() => of({ url: 'https://api.cloudinary.com/x?sig=SECRET', expiresAt: null, expiresInSeconds: 120, private: true, legacy: false }));
		TestBed.configureTestingModule({
			imports: [SaKyc],
			providers: [
				{ provide: KycDocumentService, useValue: { createAccessLink } },
				{ provide: SaKycService, useValue: {
					getOnboardingRequests: () => of({ data: { items: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } } }),
					getKycProviders: () => of({ data: { items: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } } }),
				} },
			],
		});
		fixture = TestBed.createComponent(SaKyc);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	afterEach(() => { fixture.destroy(); TestBed.resetTestingModule(); });

	const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
	const el = () => fixture.nativeElement as HTMLElement;
	const links = () => Array.from(el().querySelectorAll('app-kyc-document-link'));
	const showProvider = (p: any) => { component.showDetailModal.set(true); component.detailLoading.set(false); component.selectedOnboarding.set(null); component.selectedProvider.set(p); render(); };
	const showOnboarding = (o: any) => { component.showDetailModal.set(true); component.detailLoading.set(false); component.selectedProvider.set(null); component.selectedOnboarding.set(o); render(); };

	it('provider with private front/back/supporting docs and a private certificate: a view button each, with userId and index', () => {
		showProvider(provider({ frontIdUrl: null, frontIdUrlAccess: PRIVATE, backIdUrl: null, backIdUrlAccess: PRIVATE, supportingDocsUrl: null, supportingDocsUrlAccess: PRIVATE, certUrls: [null], certUrlsAccess: [PRIVATE] }));
		expect(links().length).toBe(4);
		links().forEach(l => (l.querySelector('button') as HTMLButtonElement).click());
		expect(createAccessLink.mock.calls.map(c => c[0])).toEqual([
			{ document: 'provider_front_id', userId: 'user-1', id: undefined, index: undefined },
			{ document: 'provider_back_id', userId: 'user-1', id: undefined, index: undefined },
			{ document: 'provider_certificate', userId: 'user-1', id: undefined, index: 0 },
			{ document: 'provider_supporting_docs', userId: 'user-1', id: undefined, index: undefined },
		].sort((a, b) => ['provider_front_id', 'provider_back_id', 'provider_certificate', 'provider_supporting_docs'].indexOf(a.document) - ['provider_front_id', 'provider_back_id', 'provider_certificate', 'provider_supporting_docs'].indexOf(b.document)));
		expect(el().innerHTML).not.toContain('SECRET');
		expect(el().textContent).not.toContain('private:');
	});

	it('provider with legacy documents: the old links, as before, and no request', () => {
		showProvider(provider({ frontIdUrl: LEGACY_URL, frontIdUrlAccess: { private: false, legacy: true }, certUrls: [LEGACY_URL], certUrlsAccess: [{ private: false, legacy: true }] }));
		const hrefs = links().map(l => l.querySelector('a')?.getAttribute('href'));
		expect(hrefs).toEqual([LEGACY_URL, LEGACY_URL]);
		expect(createAccessLink).not.toHaveBeenCalled();
	});

	it('provider with a mix (private front, legacy certificate): each slot behaves for its own kind', () => {
		showProvider(provider({ frontIdUrl: null, frontIdUrlAccess: PRIVATE, certUrls: [LEGACY_URL], certUrlsAccess: [{ private: false, legacy: true }] }));
		expect(links().length).toBe(2);
		expect(links()[0].querySelector('button')).toBeTruthy();
		expect(links()[1].querySelector('a')?.getAttribute('href')).toBe(LEGACY_URL);
	});

	it('provider with nothing uploaded: no document rows', () => {
		showProvider(provider());
		expect(links().length).toBe(0);
	});

	it('client onboarding with a private document: "عرض المستند" calls access-link with the record id (no userId)', () => {
		showOnboarding({ id: 'onb-1', userId: 'user-9', documentUrl: null, documentUrlAccess: PRIVATE, documentType: 'NATIONAL_ID', status: 'PENDING' });
		expect(links().length).toBe(1);
		const button = links()[0].querySelector('button') as HTMLButtonElement;
		expect(button.textContent).toContain('عرض المستند');
		button.click();
		expect(createAccessLink).toHaveBeenCalledWith({ document: 'onboarding_document', userId: undefined, id: 'onb-1', index: undefined });
	});

	it('client onboarding with a legacy document keeps the old link', () => {
		showOnboarding({ id: 'onb-1', documentUrl: LEGACY_URL, documentUrlAccess: { private: false, legacy: true }, documentType: 'NATIONAL_ID', status: 'PENDING' });
		expect(links()[0].querySelector('a')?.getAttribute('href')).toBe(LEGACY_URL);
		expect(createAccessLink).not.toHaveBeenCalled();
	});
});
