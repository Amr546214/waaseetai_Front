import { IdentityGateService } from '../../../../../core/services/identity-gate.service';
import { FakeIdentityGate } from '../../../../../core/services/identity-gate.testing';
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

// C4 (updated for the identity gate): the identity step is now required and reviewed from the step itself; the identity is saved by the gate (sendIdentity), never by the generic step save. A half pair is still refused here.
// An identity approval request needs BOTH sides (the server opens the review only with id number + front + back).
describe('client profile-setup: identity approval needs both sides of the ID', () => {
	beforeEach(() => FakeIdentityGate.reset()); // the fake gate keeps static state: every test starts APPROVED
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
		fixture = (TestBed.overrideComponent(ProfileSetupDashboard, { set: { providers: [{ provide: IdentityGateService, useClass: FakeIdentityGate }] } }), TestBed.createComponent(ProfileSetupDashboard));
		c = fixture.componentInstance;
		fixture.detectChanges();
		c.currentStep.set(2);
		fixture.detectChanges();
	});
	afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

	// Updated: which sides are needed is the server's call (a passport needs only the front). The step opens only when the gate is APPROVED.
	it('front only while the gate is not approved: the step stays (nothing opens), nothing is sent by the generic step save', () => {
		FakeIdentityGate.reset('NOT_SUBMITTED');
		c.setupForm.get('identity.frontId').setValue(PNG);
		c.nextStep(); fixture.detectChanges();
		expect(saveStep).not.toHaveBeenCalled();
		expect(c.currentStep()).toBe(2);
		expect(c.identityDocsProvided()).toBe(false);
	});

	it('front only for a document the server approved (passport): the wizard moves on', () => {
		c.setupForm.get('identity.frontId').setValue(PNG);
		c.nextStep(); fixture.detectChanges();
		expect(c.currentStep()).toBe(3);
	});

	it('both sides + APPROVED by the server: the generic step save sends nothing (the gate saved it) and the wizard moves on', () => {
		c.setupForm.get('identity.frontId').setValue(PNG);
		c.setupForm.get('identity.backId').setValue(PNG);
		expect(c.identityDocsProvided()).toBe(true);
		c.nextStep();
		expect(saveStep).not.toHaveBeenCalled();
		expect(c.currentStep()).toBe(3);
	});

	it('a stored side counts as existing proof on edit: stored front + new back is a complete pair', () => {
		c.storedDocs.set({ frontId: { url: null, access: { private: true, legacy: false } }, backId: null, supportingDocs: null });
		c.setupForm.get('identity.backId').setValue(PNG);
		expect(c.identityDocsProvided()).toBe(true);
		c.nextStep();
		expect(saveStep).not.toHaveBeenCalled();
		expect(c.currentStep()).toBe(3);
	});
});
