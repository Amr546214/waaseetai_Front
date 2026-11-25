import { IdentityGateService } from '../../../../../core/services/identity-gate.service';
import { FakeIdentityGate } from '../../../../../core/services/identity-gate.testing';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { KycDocumentService } from '../../../../../core/services/kyc-document.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// C4 (updated for the identity gate): the identity step is now required and reviewed from the step itself; the identity is saved by the gate (sendIdentity), never by the generic step save. A half pair is still refused here.
// An identity approval request needs BOTH sides (the server opens the review only with id number + front + back).
describe('client profile-setup: persisted front document and current identity match', () => {
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
		vi.spyOn(c.gate, 'load').mockImplementation(() => { const g = {status: 'NOT_SUBMITTED', canAdvance: false, data: {hasFront:false, hasBack:false}}; c.gate.apply(g); return of(g); });
		c.gate.load().subscribe();
		c.setupForm.get('identity.frontId').setValue(PNG);
		c.nextStep(); fixture.detectChanges();
		expect(saveStep).not.toHaveBeenCalled();
		expect(c.currentStep()).toBe(2);
		expect(c.identityDocsProvided()).toBe(false); // a local preview is not persisted evidence
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

	it('a document the server refuses (identity used by another account): the picture is removed at once and the reason sits under the box, not in the top banner', () => {
		c.setupForm.get('details').patchValue({ country: 'مصر', idDocumentType: 'NATIONAL_ID', idNumber: '30408012203296' });
		c.setupForm.get('identity.frontId').setValue(PNG);
		vi.spyOn(c.gate, 'save').mockReturnValue(throwError(() => ({ status: 409, error: { message: 'هذه الهوية مسجّلة بالفعل بحساب آخر' } })));
		c.sendIdentity(); fixture.detectChanges();
		expect(c.setupForm.get('identity.frontId').value).toBe('');
		expect(c.gateProblem()).toContain('تعذّر تأكيد حفظ الهوية');
		expect(c.idDocInspections()['frontId']?.status).toBe('warning');
		expect(c.idDocInspections()['frontId']?.message).toContain('مسجّلة');
	});
 it('distinguishes selection from persistence and saves the retained selection after missing data are completed', () => {
  c.setupForm.get('identity.frontId').setValue(PNG);
  const save = vi.spyOn(c.gate, 'save');
  c.sendIdentity(); fixture.detectChanges(); expect(save).not.toHaveBeenCalled();
  expect(c.setupForm.get('identity.frontId').value).toBe(PNG);
  expect(c.identityUploadMessage('frontId')).toContain('لم يُحفظ');
  expect(fixture.nativeElement.textContent).not.toContain('تم تجهيز الملف بنجاح');
  c.setupForm.get('details').patchValue({country:'مصر',idDocumentType:'NATIONAL_ID',idNumber:'30408012203296'});
  const pending = new Subject<any>(); save.mockReturnValue(pending);
  c.sendIdentity(); expect(c.identityUploadMessage('frontId')).toContain('لم يؤكّد السيرفر');
  pending.next({data:{hasFront:true,hasBack:false}}); pending.complete();
  expect(c.identityUploadMessage('frontId')).toContain('وحفظه على السيرفر'); expect(c.identityDocsProvided()).toBe(true);
  save.mockReturnValue(of({data:{hasFront:true,hasBack:false}})); c.sendIdentity();
  expect(save.mock.calls.at(-1)?.[0]).not.toHaveProperty('frontId');
 });
 it('keeps selection for retry after a network failure without claiming success', () => {
  c.setupForm.get('details').patchValue({country:'مصر',idDocumentType:'NATIONAL_ID',idNumber:'30408012203296'});
  c.setupForm.get('identity.frontId').setValue(PNG);
  vi.spyOn(c.gate,'save').mockReturnValue(throwError(() => ({status:503})));
  c.sendIdentity(); expect(c.setupForm.get('identity.frontId').value).toBe(PNG); expect(c.identityUploadMessage('frontId')).toContain('لم يتأكد');
 });
 it('restores a private saved front on a new load without requiring a back or resending the document', () => {
  vi.spyOn(TestBed.inject(ProfileApiService),'getClientProfileSetup').mockReturnValue(of({data:{frontIdUrlAccess:{private:true,legacy:false},kycStatus:'PENDING'}}) as any);
  c.loadClientProfile(); expect(c.storedDocs().frontId.access.private).toBe(true); expect(c.identityDocsProvided()).toBe(true); expect(c.backRequired()).toBe(false);
  expect(c.newIdentityUpload('frontId',c.setupForm.get('identity.frontId').value)).toBeUndefined();
 });

 it('selecting an actual File sends its bytes and only the confirmed response marks it saved', async () => {
  FakeIdentityGate.reset('NOT_SUBMITTED'); c.gate.load().subscribe();
  c.setupForm.get('details').patchValue({country:'مصر',idDocumentType:'NATIONAL_ID',idNumber:'30408012203296'});
  const pending = new Subject<any>(); const save = vi.spyOn(c.gate,'save').mockReturnValue(pending);
  const input = {files:[new File(['png'], 'front.png', {type:'image/png'})], value:'front.png'};
  await c.onFileSelected({target:input} as any,'identity','frontId');
  await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.calls[0][0]).toMatchObject({frontId:'data:image/png;base64,cG5n'});
  expect(c.identityUploads().frontId).toBe('saving');
  pending.next({data:{hasFront:true,hasBack:false}}); pending.complete();
  expect(c.identityUploads().frontId).toBe('saved');
 });

});
