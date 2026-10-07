import { signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { SpecialtyService } from '../../../../../core/services/specialty.service';
import { SetupTestService } from '../../../../../core/services/setup-test.service';
import { KycDocumentService } from '../../../../../core/services/kyc-document.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Provider setup wizard with private KYC storage: KYC uploads are private (the returned private reference is sent back unchanged),
// avatar/portfolio uploads stay public, and a stored private document is shown with a "view" link and keeps step 4 valid.
const PRIVATE = { private: true, legacy: false };
const LEGACY_URL = 'https://res.cloudinary.com/c/image/upload/v1/waseetai/providers/u1/identity/front-id-1.png';
const REF = 'private:image:png:waseetai/providers/u1/documents/front-1700000000000';

describe('provider setup wizard: private KYC documents', () => {
	let fixture: ComponentFixture<ProfileSetupDashboard>;
	let component: ProfileSetupDashboard;
	let uploadDocument: ReturnType<typeof vi.fn>;
	let createAccessLink: ReturnType<typeof vi.fn>;

	const setup = (setupData: any) => {
		uploadDocument = vi.fn(() => of({ type: 4, body: { data: { url: REF, name: 'front.png', private: true } } }));
		createAccessLink = vi.fn(() => of({ url: 'https://api.cloudinary.com/x?sig=SECRET', expiresAt: null, expiresInSeconds: 120, private: true, legacy: false }));
		TestBed.configureTestingModule({
			imports: [ProfileSetupDashboard],
			providers: [
				provideRouter([]),
				{ provide: AuthStore, useValue: { currentUser: () => null } },
				{ provide: ProfileApiService, useValue: { getProviderProfileSetup: () => of({ data: setupData }), saveProviderProfileSetup: vi.fn(() => of({ success: true })) } },
				{ provide: ProviderProfileService, useValue: { uploadDocument } },
				{ provide: KycDocumentService, useValue: { createAccessLink } },
				{ provide: SpecialtyService, useValue: { getCategories: () => of({ success: true, data: [] }), getPublicSpecialties: () => of({ success: true, data: [] }) } },
				{ provide: SetupTestService, useValue: { warningMsg: signal(null), errorMsg: signal(null), bannedMsg: signal(null), result: signal(null), totalQuestions: signal(0), currentQuestion: signal(null), isGenerating: signal(false), statusMsg: signal(''), disconnect: vi.fn() } },
			],
		});
		fixture = TestBed.createComponent(ProfileSetupDashboard);
		component = fixture.componentInstance;
		fixture.detectChanges();
	};
	const links = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('app-kyc-document-link'));
	const step4Valid = () => (component as any).validateStep(4) as boolean;
	const pick = (type: string, name = 'f.png') => ({ target: { files: [new File(['x'], name, { type })], value: '' } });

	afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

	it('private stored ID documents: step 4 stays valid without a new upload and the wizard shows view links (front, back, certificate)', () => {
		setup({ frontIdUrl: null, frontIdUrlAccess: PRIVATE, backIdUrl: null, backIdUrlAccess: PRIVATE, certUrls: [null], certUrlsAccess: [PRIVATE] });
		expect(component.uploadedFrontId()).toBe('');
		expect(component.storedFrontAccess()).toEqual(PRIVATE);
		expect(component.storedBackAccess()).toEqual(PRIVATE);
		expect(component.storedCertsAccess()).toEqual([PRIVATE]);
		expect(step4Valid()).toBe(true);
		component.currentStep.set(4);
		fixture.detectChanges();
		expect(links().length).toBe(3);
		expect(((fixture.nativeElement as HTMLElement).textContent || '')).not.toContain('SECRET');
	});

	it('the view link on a stored private front ID asks the access-link endpoint (owner: no userId)', () => {
		setup({ frontIdUrl: null, frontIdUrlAccess: PRIVATE });
		component.currentStep.set(4);
		fixture.detectChanges();
		(links()[0].querySelector('button') as HTMLButtonElement).click();
		expect(createAccessLink).toHaveBeenCalledWith({ document: 'provider_front_id', userId: undefined, id: undefined, index: undefined });
	});

	it('legacy front ID: unchanged — its URL is kept for the save and no view link is needed', () => {
		setup({ frontIdUrl: LEGACY_URL, frontIdUrlAccess: { private: false, legacy: true } });
		expect(component.uploadedFrontId()).toBe(LEGACY_URL);
		expect(component.storedFrontAccess()).toBeNull();
		expect(step4Valid()).toBe(true);
	});

	it('nothing uploaded: step 4 still asks for the front ID', () => {
		setup({});
		expect(step4Valid()).toBe(false);
		component.currentStep.set(4);
		fixture.detectChanges();
		expect(links().length).toBe(0);
	});

	it('a new KYC upload is private (default) and its reference is sent back unchanged in the save payload, never displayed', () => {
		setup({});
		component.onFileSelected({ target: { files: [new File(['x'], 'front.png', { type: 'image/png' })], value: '' } }, 'frontId');
		expect(uploadDocument).toHaveBeenCalledTimes(1);
		expect(uploadDocument.mock.calls[0].length).toBe(1);
		expect(component.uploadedFrontId()).toBe(REF);
		component.currentStep.set(4);
		fixture.detectChanges();
		expect(((fixture.nativeElement as HTMLElement).textContent || '')).not.toContain('private:');
	});

	it('avatar and portfolio files stay public (visibility=public); KYC files do not', () => {
		setup({});
		component.onAvatarSelected(pick('image/png', 'me.png'));
		expect(uploadDocument.mock.calls[0][1]).toEqual({ visibility: 'public' });
		component.portfolioItems.set({ برمجة: [{ review: '', reviewDisplayName: '', proofs: [], proofDisplayNames: [] }] });
		component.onPortfolioReviewChange(pick('application/pdf', 'r.pdf'), 'برمجة', 0);
		component.onPortfolioProofsChange({ target: { files: [new File(['x'], 'p.pdf', { type: 'application/pdf' })], value: '' } }, 'برمجة', 0);
		const publicCalls = uploadDocument.mock.calls.filter(c => c[1]?.visibility === 'public').length;
		expect(publicCalls).toBe(3);
		component.onFileSelected({ target: { files: [new File(['x'], 'f.png', { type: 'image/png' })], value: '' } }, 'backId');
		expect(uploadDocument.mock.calls.at(-1)!.length).toBe(1);
	});
});
