import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Data } from './data';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { KycDocumentService } from '../../../../../core/services/kyc-document.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Documents tab with private KYC storage: a stored PRIVATE document comes back as null + "<field>Access"; it is opened through the access-link
// endpoint, is left out of a save that does not touch it, and the ID-document "required" rule is satisfied by it until it is removed/replaced.
const LEGACY = 'https://res.cloudinary.com/c/image/upload/v1/waseetai/providers/u1/documents/old-id.pdf';
const BASE = {
	headline: 'مصمم', mainSpecialty: 'تصميم', bio: 'x'.repeat(60), country: 'السعودية', city: 'الرياض', location: '', hourlyRate: null, yearsOfExperience: null,
	completionPercentage: 90, missingItems: [], skills: [{ name: 'Figma' }], portfolioItems: [], languages: [],
	user: { firstName: 'أحمد', lastName: 'علي', email: 'a@b.co', phoneNumber: '+966501234567', alternativePhone: '', idDocumentUrl: null, vatCertificateUrl: null },
	certUrls: [] as (string | null)[],
};
const PRIVATE_ALL = { ...BASE, user: { ...BASE.user, idDocumentUrl: null, idDocumentUrlAccess: { private: true, legacy: false }, vatCertificateUrl: null, vatCertificateUrlAccess: { private: true, legacy: false } },
	certUrls: [null], certUrlsAccess: [{ private: true, legacy: false }] };
const LEGACY_ID = { ...BASE, user: { ...BASE.user, idDocumentUrl: LEGACY, idDocumentUrlAccess: { private: false, legacy: true } } };
const NONE = { ...BASE };

describe('provider documents tab (private KYC documents)', () => {
	let fixture: ComponentFixture<Data>;
	let component: Data;
	let initiateSensitiveChange: ReturnType<typeof vi.fn>;
	let createAccessLink: ReturnType<typeof vi.fn>;
	let openSpy: ReturnType<typeof vi.spyOn>;
	const fakeTab: any = { opener: null, closed: false, document: { title: '' }, location: { href: '' }, close: vi.fn() };

	const setup = (profile: any) => {
		initiateSensitiveChange = vi.fn(() => of({ data: { requestId: 'r1', emailHint: 'a***@b.co' } }));
		createAccessLink = vi.fn(() => of({ url: 'https://api.cloudinary.com/x?sig=SECRET', expiresAt: null, expiresInSeconds: 120, private: true, legacy: false }));
		openSpy = vi.spyOn(window, 'open').mockImplementation(() => fakeTab);
		TestBed.configureTestingModule({
			imports: [Data],
			providers: [
				provideRouter([]),
				{ provide: AuthStore, useValue: { currentUser: () => null } },
				{ provide: KycDocumentService, useValue: { createAccessLink } },
				{ provide: ProviderProfileService, useValue: {
					getProfile: vi.fn(() => of(profile)), getActiveSessions: vi.fn(() => of({ data: [] })), getChangeRequests: vi.fn(() => of([])),
					initiateSensitiveChange, savePaypalPayoutEmail: vi.fn(() => of({})), requestPaypalEmailChange: vi.fn(() => of({ emailSent: true, emailHint: 'ow***@example.com' })), updateSkills: vi.fn(() => of({ skills: [] })),
				} },
			],
		});
		fixture = TestBed.createComponent(Data);
		component = fixture.componentInstance;
		fixture.detectChanges();
		render();
	};
	const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
	const el = () => fixture.nativeElement as HTMLElement;
	const card = (control: string) => el().querySelector(`#doc-card-${control}`) as HTMLElement | null;

	afterEach(() => { openSpy?.mockRestore(); fixture?.destroy(); TestBed.resetTestingModule(); });

	it('private ID / certificate / VAT: the cards say "stored" and offer a view link, never an image of the stored value', () => {
		setup(PRIVATE_ALL);
		for (const control of ['idDocumentUrl', 'certificatesUrl', 'vatCertificateUrl']) {
			expect(component.documentState(control)?.stored).toBeTruthy();
			expect(component.documentState(control)?.previewUrl).toBeUndefined();
			expect(card(control)!.querySelector('app-kyc-document-link')).toBeTruthy();
			expect(card(control)!.querySelector('img')).toBeNull();
		}
		expect(component.documentState('idDocumentUrl')!.stored).toEqual({ key: 'user_id_document', index: undefined });
		expect(component.documentState('certificatesUrl')!.stored).toEqual({ key: 'provider_certificate', index: 0 });
		expect(component.documentState('vatCertificateUrl')!.stored).toEqual({ key: 'user_vat_certificate', index: undefined });
	});

	it('the view link on a private card asks for a fresh link on each click and opens it', () => {
		setup(PRIVATE_ALL);
		(card('idDocumentUrl')!.querySelector('app-kyc-document-link button') as HTMLButtonElement).click();
		expect(createAccessLink).toHaveBeenCalledWith({ document: 'user_id_document', userId: undefined, id: undefined, index: undefined });
		expect(fakeTab.location.href).toContain('api.cloudinary.com');
		expect(el().innerHTML).not.toContain('SECRET');
	});

	it('legacy ID document: unchanged — "معاينة" opens the old URL directly, no access-link call', () => {
		setup(LEGACY_ID);
		expect(component.documentState('idDocumentUrl')!.stored).toBeUndefined();
		expect(component.documentState('idDocumentUrl')!.previewUrl).toBe(LEGACY);
		component.previewDocument('idDocumentUrl');
		expect(openSpy).toHaveBeenCalledWith(LEGACY, '_blank', 'noopener,noreferrer');
		expect(createAccessLink).not.toHaveBeenCalled();
	});

	it('no document uploaded: no card state, the upload prompt is shown', () => {
		setup(NONE);
		expect(component.documentState('idDocumentUrl')).toBeNull();
		expect(card('idDocumentUrl')!.querySelector('app-kyc-document-link')).toBeNull();
		expect(card('idDocumentUrl')!.textContent).toContain('اختر ملفا للرفع');
	});

	it('a stored private ID document satisfies "required": saving a certificate does not demand the ID again', () => {
		setup(PRIVATE_ALL);
		expect(component.docsForm.get('idDocumentUrl')!.valid).toBe(true);
		component.documentUploads.set({ ...component.documentUploads(), certificatesUrl: { name: 'cert.pdf', progress: 100, status: 'uploaded' } });
		component.docsForm.get('certificatesUrl')!.setValue('private:image:pdf:waseetai/providers/u1/documents/cert-1');
		component.saveDocs();
		expect(initiateSensitiveChange).toHaveBeenCalledTimes(1);
		const [category, changes] = initiateSensitiveChange.mock.calls[0];
		expect(category).toBe('DOCUMENTS');
		expect(changes.certificatesUrl).toBe('private:image:pdf:waseetai/providers/u1/documents/cert-1');
		expect('idDocumentUrl' in changes).toBe(false);
		expect('vatCertificateUrl' in changes).toBe(false);
	});

	it('saving without touching the stored private documents never sends them (no empty value that would mean "remove")', () => {
		setup(PRIVATE_ALL);
		component.saveDocs();
		const changes = initiateSensitiveChange.mock.calls[0]?.[1] ?? {};
		for (const key of ['idDocumentUrl', 'certificatesUrl', 'vatCertificateUrl']) expect(key in changes).toBe(false);
	});

	it('removing the stored private ID document is an explicit removal: it becomes required again and an empty value is sent', () => {
		setup(PRIVATE_ALL);
		component.removeDocument('idDocumentUrl');
		expect(component.documentState('idDocumentUrl')).toBeNull();
		expect(component.docsForm.get('idDocumentUrl')!.valid).toBe(false);
		component.removeDocument('vatCertificateUrl');
		component.docsForm.get('idDocumentUrl')!.setValue('private:image:pdf:waseetai/providers/u1/documents/id-2');
		component.documentUploads.set({ ...component.documentUploads(), idDocumentUrl: { name: 'id.pdf', progress: 100, status: 'uploaded' } });
		component.saveDocs();
		const changes = initiateSensitiveChange.mock.calls[0][1];
		expect(changes.vatCertificateUrl).toBe('');
		expect('certificatesUrl' in changes).toBe(false);
	});
});
