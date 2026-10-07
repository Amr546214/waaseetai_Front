import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { KycDocumentService } from '../../../../../core/services/kyc-document.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Client wizard with private KYC storage: a stored PRIVATE document comes back as null + "<field>Access"; it is shown with a "view" link and
// the form stays empty (re-saving without a new file keeps it). A legacy document keeps coming back as its URL.
const PRIVATE = { private: true, legacy: false };
const LEGACY_URL = 'https://res.cloudinary.com/c/image/upload/v1/waseetai/clients/u1/identity/front-id.png';

describe('client profile-setup: stored KYC documents', () => {
	let fixture: ComponentFixture<ProfileSetupDashboard>;
	let component: ProfileSetupDashboard;
	let createAccessLink: ReturnType<typeof vi.fn>;

	const setup = (data: any) => {
		createAccessLink = vi.fn(() => of({ url: 'https://api.cloudinary.com/x?sig=SECRET', expiresAt: null, expiresInSeconds: 120, private: true, legacy: false }));
		TestBed.configureTestingModule({
			imports: [ProfileSetupDashboard],
			providers: [
				provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
				{ provide: AuthStore, useValue: { currentUser: () => null } },
				{ provide: KycDocumentService, useValue: { createAccessLink } },
				{ provide: ProfileApiService, useValue: { getClientProfileSetup: () => of({ data }), saveClientProfileSetup: vi.fn(() => of({ success: true })) } },
			],
		});
		fixture = TestBed.createComponent(ProfileSetupDashboard);
		component = fixture.componentInstance;
		fixture.detectChanges();
		component.currentStep.set(2);
		fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
		fixture.detectChanges();
	};
	const el = () => fixture.nativeElement as HTMLElement;
	const links = () => Array.from(el().querySelectorAll('app-kyc-document-link'));

	afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

	it('private front/back: the form stays empty (nothing to resend), the step shows "uploaded before" with a view link each', () => {
		setup({ frontIdUrl: null, frontIdUrlAccess: PRIVATE, backIdUrl: null, backIdUrlAccess: PRIVATE });
		expect(component.setupForm.get('identity.frontId')!.value).toBe('');
		expect(component.setupForm.get('identity.backId')!.value).toBe('');
		expect(component.storedDocs().frontId).toEqual({ url: null, access: PRIVATE });
		expect(links().length).toBe(2);
		expect(el().textContent).toContain('يوجد مستند مرفوع سابقًا');
		expect(el().textContent).not.toContain('SECRET');
	});

	it('the view link asks the access-link endpoint with the right key (owner: no userId), each click', () => {
		setup({ frontIdUrl: null, frontIdUrlAccess: PRIVATE, backIdUrl: null, backIdUrlAccess: PRIVATE });
		(links()[0].querySelector('button') as HTMLButtonElement).click();
		(links()[1].querySelector('button') as HTMLButtonElement).click();
		expect(createAccessLink.mock.calls.map(c => c[0].document)).toEqual(['client_front_id', 'client_back_id']);
		expect(createAccessLink.mock.calls.every(c => !c[0].userId)).toBe(true);
	});

	it('legacy front: the URL is kept in the form as before and shown with a plain link', () => {
		setup({ frontIdUrl: LEGACY_URL, frontIdUrlAccess: { private: false, legacy: true } });
		expect(component.setupForm.get('identity.frontId')!.value).toBe(LEGACY_URL);
		const a = el().querySelector('app-kyc-document-link a') as HTMLAnchorElement;
		expect(a.getAttribute('href')).toBe(LEGACY_URL);
		expect(createAccessLink).not.toHaveBeenCalled();
	});

	it('nothing stored: no "uploaded before" block', () => {
		setup({});
		expect(links().length).toBe(0);
		expect(el().textContent).not.toContain('يوجد مستند مرفوع سابقًا');
	});

	it('choosing a new file hides the "uploaded before" block for that slot', () => {
		setup({ frontIdUrl: null, frontIdUrlAccess: PRIVATE });
		component.setupForm.get('identity.frontId')!.setValue('data:image/png;base64,AAAA');
		fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
		fixture.detectChanges();
		expect(links().length).toBe(0);
	});
});
