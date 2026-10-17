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

// C4: the client identity step is optional, but an identity approval request needs BOTH sides (the server opens the review only with id number + front + back).
describe('client profile-setup: identity approval needs both sides of the ID', () => {
	let fixture: ComponentFixture<ProfileSetupDashboard>;
	let c: any;
	let saveStep: ReturnType<typeof vi.fn>;
	const PNG = 'data:image/png;base64,iVBORw0KGgo=';

	beforeEach(() => {
		saveStep = vi.fn(() => of({ success: true }));
		TestBed.configureTestingModule({
			imports: [ProfileSetupDashboard],
			providers: [
				provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
				{ provide: AuthStore, useValue: { currentUser: () => null } },
				{ provide: KycDocumentService, useValue: { createAccessLink: vi.fn() } },
				{ provide: ProfileApiService, useValue: { getClientProfileSetup: () => of({ data: {} }), saveClientProfileSetup: vi.fn(() => of({ success: true })), saveClientSetupStep: saveStep } },
			],
		});
		fixture = TestBed.createComponent(ProfileSetupDashboard);
		c = fixture.componentInstance;
		fixture.detectChanges();
		c.currentStep.set(2);
		fixture.detectChanges();
	});
	afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

	it('front only: the step is refused, the missing back side is named and nothing is sent', () => {
		c.setupForm.get('identity.frontId').setValue(PNG);
		c.nextStep(); fixture.detectChanges();
		expect(saveStep).not.toHaveBeenCalled();
		expect(c.currentStep()).toBe(2);
		expect(c.fileErrors()['backId']).toContain('الوجه الخلفي');
		expect(c.identityDocsProvided()).toBe(false); // never "تم الإرسال" for half a pair
	});

	it('back only: the missing front side is named', () => {
		c.setupForm.get('identity.backId').setValue(PNG);
		c.nextStep();
		expect(saveStep).not.toHaveBeenCalled();
		expect(c.fileErrors()['frontId']).toContain('الوجه الأمامي');
	});

	it('both sides: the step is saved and counts as submitted; neither side: the optional step is skipped as before', () => {
		c.setupForm.get('identity.frontId').setValue(PNG);
		c.setupForm.get('identity.backId').setValue(PNG);
		expect(c.identityDocsProvided()).toBe(true);
		c.nextStep();
		expect(saveStep).toHaveBeenCalledTimes(1);
		expect(c.currentStep()).toBe(3);
	});

	it('a stored side counts as existing proof on edit: stored front + new back is a complete pair', () => {
		c.storedDocs.set({ frontId: { url: null, access: { private: true, legacy: false } }, backId: null, supportingDocs: null });
		c.setupForm.get('identity.backId').setValue(PNG);
		expect(c.identityDocsProvided()).toBe(true);
		c.nextStep();
		expect(saveStep).toHaveBeenCalledTimes(1);
	});
});
