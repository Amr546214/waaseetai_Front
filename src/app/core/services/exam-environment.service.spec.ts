import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ExamEnvironmentService } from './exam-environment.service';
import { SpecialtyService } from './specialty.service';
import { SebBrowserProofService } from './seb-browser-proof.service';
import { sebProofInterceptor } from '../interceptors/seb-proof.interceptor';
import { environment } from '../../../environments/environment';

const api = environment.url_api;
const restricted = { mode: 'required', ready: true, restricted: true, verified: false, jsApiEnabled: true };
function mount(initial: any = null, native = true) {
  const proof = { takeInitialChallenge: vi.fn().mockResolvedValue(initial), clearChallengeUrl: vi.fn(), clear: vi.fn(), currentPath: () => '/provider-overview/profile/specialties?takeTest=S', hasNativeApi: () => native, openChallenge: vi.fn(), accept: vi.fn().mockReturnValue(true), needsRenewal: () => false, headersFor: () => ({}) };
  TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([sebProofInterceptor])), provideHttpClientTesting(), { provide: SebBrowserProofService, useValue: proof }, { provide: SpecialtyService, useFactory: () => { const http = TestBed.inject(HttpClient); return { getExamEnvironment: () => http.get(api + '/assessments/exam-environment') }; } }] });
  return { svc: TestBed.inject(ExamEnvironmentService), http: TestBed.inject(HttpTestingController), proof };
}
afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule(); });

it('normal Chrome stays unverified and cannot mint a challenge; default mode makes no handshake', async () => {
  const { svc, http } = mount(null, false); svc.load(); http.expectOne(api + '/assessments/exam-environment').flush({ data: restricted }); await Promise.resolve();
  expect(svc.satisfied()).toBe(false); http.expectNone(api + '/exam-environment/js-challenge');
  svc.load(); http.expectOne(api + '/assessments/exam-environment').flush({ data: { ...restricted, mode: 'off', restricted: false } });
  expect(svc.satisfied()).toBe(true); http.expectNone(api + '/exam-environment/js-challenge');
});
it('shares concurrent checks, asks the server for a fresh URL, and never starts an exam while redirecting', async () => {
  const { svc, http, proof } = mount(); const done = vi.fn(); svc.load(done); svc.load(done);
  http.expectOne(api + '/assessments/exam-environment').flush({ data: restricted }); await Promise.resolve();
  const c = http.expectOne(api + '/exam-environment/js-challenge'); expect(c.request.body.path).toContain('/provider-overview/');
  c.flush({ data: { url: 'https://dev.waseetai.com/provider-overview/profile/specialties?_seb_challenge=C1' } });
  expect(proof.openChallenge).toHaveBeenCalledTimes(1); expect(svc.satisfied()).toBe(false); expect(done).toHaveBeenCalledTimes(2);
});
it('exchanges the initial native hashes then asks the server again; a local claim alone cannot satisfy the gate', async () => {
  const initial = { challenge: 'C1', keys: { browserExamKeyHash: 'a'.repeat(64), configKeyHash: 'b'.repeat(64) } };
  const { svc, http, proof } = mount(initial); svc.load(); http.expectOne(api + '/assessments/exam-environment').flush({ data: restricted }); await Promise.resolve();
  const v = http.expectOne(api + '/exam-environment/js-verify'); expect(v.request.body).toEqual({ challenge: 'C1', ...initial.keys });
  v.flush({ data: { proof: 'P1', expiresAt: '2099-01-01T00:00:00Z' } });
	  expect(proof.accept).toHaveBeenCalledWith('P1', '2099-01-01T00:00:00Z'); expect(svc.satisfied()).toBe(false);
  http.expectOne(api + '/assessments/exam-environment').flush({ data: { ...restricted, verified: true } });
  expect(svc.env()?.verified).toBe(true); expect(proof.clearChallengeUrl).toHaveBeenCalledTimes(1);
});
it('a rejected native exchange leaves the restricted gate closed without a redirect loop', async () => {
  const { svc, http, proof } = mount({ challenge: 'C1', keys: { browserExamKeyHash: 'bad', configKeyHash: 'bad' } }); svc.load();
  http.expectOne(api + '/assessments/exam-environment').flush({ data: restricted }); await Promise.resolve();
  http.expectOne(api + '/exam-environment/js-verify').flush({ code: 'EXAM_ENVIRONMENT_REQUIRED' }, { status: 403, statusText: 'Forbidden' });
  expect(svc.satisfied()).toBe(false); expect(proof.openChallenge).not.toHaveBeenCalled();
});

it('does not activate the new handshake against an older backend, even inside SEB', () => {
  const { svc, http, proof } = mount(); svc.load();
  http.expectOne(api + '/assessments/exam-environment').flush({ data: { ...restricted, jsApiEnabled: undefined } });
  expect(svc.satisfied()).toBe(false); expect(proof.takeInitialChallenge).not.toHaveBeenCalled(); expect(proof.openChallenge).not.toHaveBeenCalled();
});

it('clears a nearly expired proof before starting another exam and stays closed during renewal', async () => {
  const { svc, http, proof } = mount(); proof.needsRenewal = () => true; svc.load();
  http.expectOne(api + '/assessments/exam-environment').flush({ data: { ...restricted, verified: true } });
  expect(svc.satisfied()).toBe(false); expect(proof.clear).toHaveBeenCalled(); await Promise.resolve();
  http.expectOne(api + '/exam-environment/js-challenge').flush({ data: { url: 'https://dev.waseetai.com/provider-overview/profile/specialties?_seb_challenge=C2' } });
  expect(svc.satisfied()).toBe(false);
});
