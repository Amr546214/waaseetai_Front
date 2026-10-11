import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { SaKyc } from './sa-kyc';
import { SaKycService } from './sa-kyc.service';
import { KycDocumentService } from '../../../../core/services/kyc-document.service';
import { providerDocumentsCount, withOwnerFields } from './kyc-owner';

// The admin can tell who owns each KYC request: name + e-mail in the table (never "—" when known), full userId + e-mail in the details, search by name / e-mail on the server.
const nested = (id: string, first: string, email: string) => ({ userId: id, kycStatus: 'PENDING', isVerified: false, certUrls: ['c1'], frontIdUrl: 'a', user: { id, firstName: first, lastName: 'تجربة', email, phoneNumber: '1066655544', accountType: 'PROVIDER_INDIVIDUAL' } });

describe('sa-kyc owner fields (pure)', () => {
	it('a nested user becomes the flat name / e-mail / phone / type the page reads', () => {
		const r: any = withOwnerFields(nested('u1', 'مها', 'mayalabbad33+user01@gmail.com'));
		expect(r.userName).toBe('مها تجربة');
		expect(r.userEmail).toBe('mayalabbad33+user01@gmail.com');
		expect(r.userPhone).toBe('1066655544');
		expect(r.accountType).toBe('PROVIDER_INDIVIDUAL');
	});
	it('flat fields from the backend win and are kept', () => {
		const r: any = withOwnerFields({ userName: 'اسم', userEmail: 'a@b.c', user: { email: 'other@x.com' } });
		expect(r.userName).toBe('اسم'); expect(r.userEmail).toBe('a@b.c');
	});
	it('documents count: the backend number, else every document present', () => {
		expect(providerDocumentsCount({ documentsCount: 3 })).toBe(3);
		expect(providerDocumentsCount({ frontIdUrl: 'a', backIdUrlAccess: { private: true }, certUrls: ['c1', null, 'c2'] })).toBe(4);
		expect(providerDocumentsCount({})).toBe(0);
	});
});

describe('sa-kyc providers tab shows the owner', () => {
	let fixture: ComponentFixture<SaKyc>; let component: SaKyc; let getKycProviders: ReturnType<typeof vi.fn>;
	const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
	const el = () => fixture.nativeElement as HTMLElement;
	beforeEach(() => {
		getKycProviders = vi.fn(() => of({ data: { items: [nested('u-1', 'مها', 'mayalabbad33+user01@gmail.com'), nested('u-2', 'عمرو', 'amro.okasha.teamup@gmail.com')], pagination: { total: 2, page: 1, limit: 10, totalPages: 1 } } }));
		TestBed.configureTestingModule({ imports: [SaKyc], providers: [
			{ provide: KycDocumentService, useValue: { createAccessLink: vi.fn() } },
			{ provide: SaKycService, useValue: { getOnboardingRequests: () => of({ data: { items: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } } }), getKycProviders } },
		] });
		fixture = TestBed.createComponent(SaKyc); component = fixture.componentInstance; fixture.detectChanges();
		component.switchTab('providers'); render();
	});
	afterEach(() => { fixture.destroy(); TestBed.resetTestingModule(); vi.useRealTimers(); });

	it('the table shows name and e-mail for every provider (no "—")', () => {
		const names = Array.from(el().querySelectorAll('[data-testid="kyc-row-name"]')).map(e => e.textContent!.trim());
		const emails = Array.from(el().querySelectorAll('[data-testid="kyc-row-email"]')).map(e => e.textContent!.trim());
		expect(names).toEqual(['مها تجربة', 'عمرو تجربة']);
		expect(emails).toEqual(['mayalabbad33+user01@gmail.com', 'amro.okasha.teamup@gmail.com']);
		expect(el().textContent).toContain('1 مستند'.replace('1', '2'));
	});

	it('the details show name, e-mail and the FULL userId before approving', () => {
		component.viewProviderDetail(component.providers()[0]); render();
		expect(el().querySelector('[data-testid="kyc-detail-name"]')!.textContent).toContain('مها تجربة');
		expect(el().querySelector('[data-testid="kyc-detail-email"]')!.textContent).toContain('mayalabbad33+user01@gmail.com');
		expect(el().querySelector('[data-testid="kyc-detail-userid"]')!.textContent!.trim()).toBe('u-1');
	});

	it('typing in the search asks the SERVER (name / e-mail), from page 1, with the term', () => {
		vi.useFakeTimers();
		getKycProviders.mockClear();
		component.providersPage.set(3);
		component.onProvidersSearchInput('bmo.bs.2030@gmail.com');
		vi.advanceTimersByTime(400);
		expect(getKycProviders).toHaveBeenCalledTimes(1);
		expect(getKycProviders.mock.calls[0][0]).toMatchObject({ page: 1, search: 'bmo.bs.2030@gmail.com' });
	});
});
