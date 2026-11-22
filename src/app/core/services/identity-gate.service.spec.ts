import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { IdentityGateService, IdentityGateState } from './identity-gate.service';

const state = (over: Partial<IdentityGateState> = {}): IdentityGateState => ({ status: 'UNDER_REVIEW', rejectionReason: null, canAdvance: false, submittedAt: null, missing: [], data: { hasFront: true, hasBack: false }, automaticCheck: 'CHECKING', ...over });
describe('IdentityGateService: matched setup progression with KYC unchanged', () => {
 let svc: IdentityGateService; let http: HttpTestingController;
 beforeEach(() => { vi.useFakeTimers(); TestBed.configureTestingModule({ providers: [IdentityGateService, provideHttpClient(), provideHttpClientTesting()] }); svc = TestBed.inject(IdentityGateService); http = TestBed.inject(HttpTestingController); });
 afterEach(() => { svc.ngOnDestroy(); http.verify(); vi.useRealTimers(); });
 it('allows current matched progression as well as manual approval, but never a bare canAdvance flag on an unverified state', () => {
  svc.apply(state({ canAdvance: true, automaticCheck: 'MATCHED' })); expect(svc.canAdvance()).toBe(true); expect(svc.status()).toBe('UNDER_REVIEW');
  svc.apply(state({ canAdvance: true, automaticCheck: 'NEEDS_REVIEW' })); expect(svc.canAdvance()).toBe(false);
  svc.apply(state({ canAdvance: true, status: 'REJECTED', automaticCheck: 'MATCHED' })); expect(svc.canAdvance()).toBe(false);
  svc.apply(state({ canAdvance: true, status: 'APPROVED', automaticCheck: undefined })); expect(svc.canAdvance()).toBe(true);
 });
 it('polls while comparing, opens Next when the server returns a match, then stops polling', () => {
  svc.apply(state()); vi.advanceTimersByTime(3000);
  http.expectOne(r => r.url.endsWith('/client/profile/setup/identity')).flush({ data: state({ canAdvance: true, automaticCheck: 'MATCHED' }) });
  expect(svc.canAdvance()).toBe(true); expect(svc.status()).toBe('UNDER_REVIEW');
  vi.advanceTimersByTime(60_000); http.expectNone(r => r.url.endsWith('/identity'));
 });
 it('a changed document closes the gate again; network failure never leaves a stale match open', () => {
  svc.apply(state({ canAdvance: true, automaticCheck: 'MATCHED' }));
  svc.save({ frontId: 'new-image' }).subscribe(); expect(svc.canAdvance()).toBe(false);
  http.expectOne(r => r.method === 'PUT').flush({ data: state({ automaticCheck: 'NOT_CHECKED' }) });
  expect(svc.canAdvance()).toBe(false);
  svc.apply(state({ canAdvance: true, automaticCheck: 'MATCHED' }));
  svc.load().subscribe({ error: () => undefined }); http.expectOne(r => r.method === 'GET').flush({}, { status: 503, statusText: 'Unavailable' });
  expect(svc.canAdvance()).toBe(false); expect(svc.loadFailed()).toBe(true);
  svc.apply(state({ canAdvance: true, automaticCheck: 'MATCHED' })); expect(svc.canAdvance()).toBe(true); expect(svc.loadFailed()).toBe(false);
 });
 it('a server refusal closes the gate immediately while its current evidence is re-read', () => {
  svc.apply(state({ canAdvance: true, automaticCheck: 'MATCHED' })); svc.refusedByServer(); expect(svc.canAdvance()).toBe(false);
  http.expectOne(r => r.method === 'GET').flush({ data: state({ automaticCheck: 'NEEDS_REVIEW' }) }); expect(svc.canAdvance()).toBe(false);
 });
});
