import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { IdentityGateService, isIdentityNotApproved } from '../../../../../core/services/identity-gate.service';
import { FakeIdentityGate } from '../../../../../core/services/identity-gate.testing';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('client profile-setup: identity gate behaviour', () => {
	let fixture: ComponentFixture<ProfileSetupDashboard>;
	let c: any;
	let saveStep: ReturnType<typeof vi.fn>;
	const mount = (status: any = 'NOT_SUBMITTED', stepImpl?: (s: number) => any) => {
		FakeIdentityGate.reset(status);
		saveStep = vi.fn((s: number) => stepImpl ? stepImpl(s) : of({ success: true, data: {} }));
		TestBed.configureTestingModule({ imports: [ProfileSetupDashboard], providers: [
			provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
			{ provide: AuthStore, useValue: { currentUser: () => null } },
			{ provide: ProfileApiService, useValue: { getClientProfileSetup: () => of({ data: {} }), saveClientProfileSetup: vi.fn(() => stepImpl ? stepImpl(0) : of({ success: true })), saveClientSetupStep: saveStep } },
		] });
		TestBed.overrideComponent(ProfileSetupDashboard, { set: { providers: [{ provide: IdentityGateService, useClass: FakeIdentityGate }] } });
		fixture = TestBed.createComponent(ProfileSetupDashboard);
		c = fixture.componentInstance; fixture.detectChanges();
	};
	const fillId = (type = 'PASSPORT', number = 'A1234567') => c.setupForm.get('details').patchValue({ idDocumentType: type, idNumber: number, dob: '1990-01-01', country: 'مصر', city: 'القاهرة', occupation: 'مهندس', address: 'x' });
	afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

	it('a photo upload saves data + image through the identity endpoint, starts the review and STAYS on the identity step', () => {
		mount(); fillId(); c.currentStep.set(2); fixture.detectChanges();
		c.setupForm.get('identity.frontId').setValue(PNG);
		c.sendIdentity();
		expect(FakeIdentityGate.saved).toHaveLength(1);
		expect(FakeIdentityGate.saved[0]).toMatchObject({ idIssuingCountry: 'EG', idDocumentType: 'PASSPORT', idNumber: 'A1234567', dob: '1990-01-01', frontId: PNG });
		expect(c.gate.status()).toBe('UNDER_REVIEW');
		expect(c.currentStep()).toBe(2);
		expect(c.setupForm.get('details.idNumber').value).toBe('A1234567'); // nothing erased
	});

	it('choosing the photo file itself (onFileSelected) saves through the gate and starts the review', async () => {
		mount(); fillId(); c.currentStep.set(2); fixture.detectChanges();
		const input = document.createElement('input'); input.type = 'file';
		Object.defineProperty(input, 'files', { value: [new File([new Uint8Array([137, 80, 78, 71])], 'id.png', { type: 'image/png' })] });
		await c.onFileSelected({ target: input } as any, 'identity', 'frontId');
		await vi.waitFor(() => expect(FakeIdentityGate.saved).toHaveLength(1));
		expect(FakeIdentityGate.saved[0].frontId).toContain('data:image/png');
		expect(c.currentStep()).toBe(2);
	});

	it('incomplete identity data: nothing is sent, the problem is shown, the image stays in the form', () => {
		mount(); c.currentStep.set(2); c.setupForm.get('identity.frontId').setValue(PNG);
		c.sendIdentity();
		expect(FakeIdentityGate.saved).toHaveLength(0);
		expect(c.gateProblem()).toContain('الخطوة الأولى');
		expect(c.setupForm.get('identity.frontId').value).toBe(PNG);
	});

	it('changing the image after approval re-locks: the next step closes again', () => {
		mount('APPROVED'); fillId(); c.currentStep.set(2); fixture.detectChanges();
		expect(c.gate.canAdvance()).toBe(true);
		c.setupForm.get('identity.frontId').setValue(PNG); c.sendIdentity();
		expect(c.gate.canAdvance()).toBe(false);
		c.nextStep();
		expect(c.currentStep()).toBe(2);
	});

	it('the server refusing a skipped step (409 IDENTITY_NOT_APPROVED) brings the user back to the identity step with the reason', () => {
		const err = new HttpErrorResponse({ status: 409, error: { success: false, code: 'IDENTITY_NOT_APPROVED', message: 'وثيقة الهوية غير معتمدة بعد' } });
		expect(isIdentityNotApproved(err)).toBe(true);
		mount('UNDER_REVIEW', (s) => s === 3 ? throwError(() => err) : of({ success: true, data: {} }));
		c.currentStep.set(3); c.setupForm.get('bank.paypalPayoutEmail').setValue('me@example.com');
		c.nextStep(); fixture.detectChanges();
		expect(c.currentStep()).toBe(2);
		expect(c.gateProblem()).toContain('غير معتمدة');
	});

	it('a wizard resumed past the identity (details + PayPal saved) opens on the identity step while it is not approved', () => {
		FakeIdentityGate.reset('UNDER_REVIEW');
		TestBed.configureTestingModule({ imports: [ProfileSetupDashboard], providers: [
			provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
			{ provide: AuthStore, useValue: { currentUser: () => null } },
			{ provide: ProfileApiService, useValue: { getClientProfileSetup: () => of({ data: { idNumber: 'A1234567', dob: '1990-01-01T00:00:00.000Z', country: 'مصر', city: 'القاهرة', industry: 'x', address: 'y', paypalPayoutEmail: 'a@b.co' } }), saveClientProfileSetup: vi.fn(), saveClientSetupStep: vi.fn() } },
		] });
		TestBed.overrideComponent(ProfileSetupDashboard, { set: { providers: [{ provide: IdentityGateService, useClass: FakeIdentityGate }] } });
		fixture = TestBed.createComponent(ProfileSetupDashboard); fixture.detectChanges();
		expect(fixture.componentInstance.currentStep()).toBe(2);
	});

	it('a final submission that changes approved evidence (409 EVIDENCE_CHANGED_IN_SUBMISSION) returns to the identity step with a clear message', () => {
		const err = new HttpErrorResponse({ status: 409, error: { success: false, code: 'IDENTITY_NOT_APPROVED', message: 'x', errors: [{ code: 'IDENTITY_NOT_APPROVED', status: 'APPROVED', reason: 'EVIDENCE_CHANGED_IN_SUBMISSION' }] } });
		mount('APPROVED', (s) => s === 0 ? throwError(() => err) : of({ success: true, data: {} }));
		c.currentStep.set(5); c.submitForm(); // invalid form -> jumps; make it valid first
		c.setupForm.patchValue({ details: { idDocumentType: 'PASSPORT', idNumber: 'A1234567', dob: '1990-01-01', country: 'مصر', city: 'القاهرة', occupation: 'x', address: 'y' }, bank: { paypalPayoutEmail: 'a@b.co' }, agreements: { accurate: true, terms: true, privacy: true } });
		c.currentStep.set(5); c.submitForm(); fixture.detectChanges();
		expect(c.currentStep()).toBe(2);
		expect(c.gateProblem()).toContain('تختلف عن الوثيقة المعتمدة');
	});

	it('the back side is not required for a passport', () => {
		mount(); c.setupForm.get('details.idDocumentType').setValue('PASSPORT'); expect(c.backRequired()).toBe(false);
		c.setupForm.get('details.idDocumentType').setValue('NATIONAL_ID'); expect(c.backRequired()).toBe(true);
	});

	it('legacy VERIFIED/APPROVED + step 1 re-save re-reads the state', () => {
		mount('APPROVED'); fillId(); c.setupForm.get('details.city').setValue('القاهرة'); c.currentStep.set(1);
		const spy = vi.spyOn(c.gate, 'load');
		c.nextStep();
		expect(spy).toHaveBeenCalled();
	});
});
