import { signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { SpecialtyService } from '../../../../../core/services/specialty.service';
import { SetupTestService } from '../../../../../core/services/setup-test.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { IdentityGateService } from '../../../../../core/services/identity-gate.service';
import { FakeIdentityGate } from '../../../../../core/services/identity-gate.testing';

describe('provider profile-setup: identity gate behaviour', { timeout: 30000 }, () => {
  let fixture: ComponentFixture<ProfileSetupDashboard>;
  let c: any;
  let http: HttpTestingController;
  const mount = async (status: any, stored: any = {}, save: any = vi.fn(() => of({ success: true }))) => {
    FakeIdentityGate.reset(status);
    await TestBed.configureTestingModule({ imports: [ProfileSetupDashboard], providers: [
      provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthStore, useValue: { currentUser: () => null } },
      { provide: ProfileApiService, useValue: { getProviderProfileSetup: () => of({ data: stored }), saveProviderProfileSetup: save } },
      { provide: SpecialtyService, useValue: { getCategories: () => of({ success: true, data: [] }), getPublicSpecialties: () => of({ success: true, data: [] }) } },
      { provide: SetupTestService, useValue: { needsExamEnvironment: signal(false), warningMsg: signal(null), errorMsg: signal(null), bannedMsg: signal(null), result: signal(null), totalQuestions: signal(0), currentQuestion: signal(null), isGenerating: signal(false), statusMsg: signal(''), disconnect: vi.fn() } },
    ] }).compileComponents();
    TestBed.overrideComponent(ProfileSetupDashboard, { set: { providers: [{ provide: IdentityGateService, useClass: FakeIdentityGate }] } });
    fixture = TestBed.createComponent(ProfileSetupDashboard); c = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController); fixture.detectChanges();
    c.currentStep.set(4); fixture.detectChanges();
  };
  afterEach(() => { http.match(r => r.url.includes('/skills/catalog')).forEach(r => r.flush({ success: true, data: { category: null, skills: [] } })); fixture.destroy(); });

  it('data + image go to the identity endpoint (stay on step 4, review starts); the number is kept', async () => {
    await mount('NOT_SUBMITTED', { country: 'مصر', idNumber: 'A1234567', idDocumentType: 'PASSPORT' });
    c.setupForm.get('profData.dob')?.setValue('1990-01-01');
    c.pendingRefs = { frontId: 'private:front-1' };
    c.sendIdentity();
    expect(FakeIdentityGate.saved).toHaveLength(1);
    expect(FakeIdentityGate.saved[0]).toMatchObject({ idIssuingCountry: 'EG', idDocumentType: 'PASSPORT', idNumber: 'A1234567', frontId: 'private:front-1' });
    expect(c.gate.status()).toBe('UNDER_REVIEW');
    expect(c.currentStep()).toBe(4);
    expect(c.setupForm.get('docs.idNumber').value).toBe('A1234567');
  });

  it('missing country/type/number: nothing is sent and the reason is shown', async () => {
    await mount('NOT_SUBMITTED', {});
    c.sendIdentity();
    expect(FakeIdentityGate.saved).toHaveLength(0);
    expect(c.gateProblem()).toBeTruthy();
  });

  it('after approval a changed image re-locks step 5', async () => {
    await mount('APPROVED', { country: 'مصر', idNumber: 'A1234567', idDocumentType: 'PASSPORT' });
    expect(c.gate.canAdvance()).toBe(true);
    c.pendingRefs = { frontId: 'private:new' }; c.sendIdentity();
    expect(c.gate.canAdvance()).toBe(false);
    c.goToStep(5);
    expect(c.currentStep()).toBe(4);
  });

  it('the back side label says it is optional, for a national ID and for a passport alike', async () => {
    await mount('NOT_SUBMITTED', { country: 'مصر', idNumber: 'A1', idDocumentType: 'NATIONAL_ID' });
    fixture.detectChanges();
    const label = () => (fixture.nativeElement.querySelector('[data-testid="back-id-label"]') as HTMLElement).textContent;
    expect(label()).toContain('اختياري');
    expect(label()).not.toContain('إلزامي');
    c.setupForm.get('docs.idDocumentType').setValue('PASSPORT'); fixture.detectChanges();
    expect(label()).toContain('اختياري');
  });

  it('the document type is not picked by the owner: it comes from the picture (list shown only when the AI cannot tell)', async () => {
    await mount('NOT_SUBMITTED', { country: 'مصر', idNumber: 'A1' });
    fixture.detectChanges();
    const q = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement;
    expect(q('identity-document-type-auto').hidden).toBe(false);
    expect(q('identity-document-type-auto').textContent).toContain('يُحدَّد نوع الوثيقة تلقائيًا');
    expect(q('identity-document-type-fallback').hidden).toBe(true);
    (c as any).applyDetectedKind({ documentKind: 'PASSPORT' }, 'FRONT'); fixture.detectChanges();
    expect(c.setupForm.get('docs.idDocumentType').value).toBe('PASSPORT');
    expect(q('identity-document-type-auto').textContent).toContain('جواز سفر');
    expect(q('identity-document-type-fallback').hidden).toBe(true);
    // a new front picture of another kind replaces it
    (c as any).applyDetectedKind({ documentKind: 'NATIONAL_ID' }, 'FRONT'); fixture.detectChanges();
    expect(c.setupForm.get('docs.idDocumentType').value).toBe('NATIONAL_ID');
    // not recognised: the list appears so the owner can pick
    c.setupForm.get('docs.idDocumentType').setValue('');
    (c as any).applyDetectedKind({ documentKind: 'UNKNOWN' }, 'FRONT'); fixture.detectChanges();
    expect(q('identity-document-type-fallback').hidden).toBe(false);
    expect(q('identity-document-type-auto').hidden).toBe(true);
  });

  it('a final submission that changes approved evidence (EVIDENCE_CHANGED_IN_SUBMISSION) returns to step 4 with a clear message', async () => {
    const err = new HttpErrorResponse({ status: 409, error: { success: false, code: 'IDENTITY_NOT_APPROVED', message: 'x', errors: [{ code: 'IDENTITY_NOT_APPROVED', status: 'APPROVED', reason: 'EVIDENCE_CHANGED_IN_SUBMISSION' }] } });
    await mount('APPROVED', {});
    c.currentStep.set(6);
    (c as any).profileApi.saveProviderProfileSetup = () => ({ subscribe: (o: any) => o.error(err) });
    (c as any).validateStep = () => true;
    c.saveAndGoToTest();
    expect(c.currentStep()).toBe(4);
    expect(c.gateProblem()).toContain('تختلف عن الوثيقة المعتمدة');
  });

  it('final submission refused by the server (409 IDENTITY_NOT_APPROVED) returns to the identity step', async () => {
    const err = new HttpErrorResponse({ status: 409, error: { success: false, code: 'IDENTITY_NOT_APPROVED', message: 'وثيقة الهوية غير معتمدة بعد' } });
    await mount('UNDER_REVIEW', {}, vi.fn(() => { throw err; }));
    c.currentStep.set(6);
    (c as any).profileApi.saveProviderProfileSetup = () => ({ subscribe: (o: any) => o.error(err) });
    (c as any).validateStep = () => true;
    c.saveAndGoToTest();
    expect(c.currentStep()).toBe(4);
    expect(c.gateProblem()).toContain('غير معتمدة');
  });
  it('does not label a storage upload as saved until the gate confirms the reference; failures keep it for retry', async () => {
    await mount('NOT_SUBMITTED', {country:'مصر', idNumber:'A1234567', idDocumentType:'PASSPORT'});
    c.pendingRefs = {frontId:'private:new'};
    const pending = new Subject<any>(); const save = vi.spyOn(c.gate,'save').mockReturnValue(pending);
    c.sendIdentity(); expect(c.identitySaved().frontId).not.toBe(true);
    pending.next({data:{hasFront:true,hasBack:false}}); pending.complete();
    expect(c.identitySaved().frontId).toBe(true); expect(c.pendingRefs).toEqual({});
    c.pendingRefs = {frontId:'private:retry'}; c.identitySaved.set({});
    save.mockReturnValue(throwError(() => ({status:503}))); c.sendIdentity();
    expect(c.pendingRefs.frontId).toBe('private:retry'); expect(c.identitySaved().frontId).not.toBe(true);
  });
  it('preserves a second pending reference when a prior save returns, then persists it', async () => {
    await mount('NOT_SUBMITTED', {country:'مصر', idNumber:'A1234567', idDocumentType:'PASSPORT'});
    c.pendingRefs = {frontId:'private:front'};
    const first = new Subject<any>(); const save = vi.spyOn(c.gate,'save').mockReturnValueOnce(first).mockReturnValue(of({data:{hasFront:true,hasBack:true}}));
    c.sendIdentity(); c.pendingRefs.backId = 'private:back';
    first.next({data:{hasFront:true,hasBack:false}}); first.complete();
    expect(save).toHaveBeenCalledTimes(2); expect(save.mock.calls[1][0]).toMatchObject({backId:'private:back'}); expect(c.pendingRefs).toEqual({});
  });

});
