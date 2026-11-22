import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { sebProofInterceptor } from './seb-proof.interceptor';
import { SebBrowserProofService } from '../services/seb-browser-proof.service';
import { SpecialtyService } from '../services/specialty.service';
import { CatalogChangesService } from '../services/catalog-changes.service';
import { environment } from '../../../environments/environment';

const api = environment.url_api;
beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([sebProofInterceptor])), provideHttpClientTesting(), { provide: CatalogChangesService, useValue: {} }] }));
afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule(); vi.unstubAllGlobals(); localStorage.clear(); });

it('attaches the memory proof to protected HTTP requests, clears it on refusal, and never sends it to another origin', () => {
  const proof = TestBed.inject(SebBrowserProofService), client = TestBed.inject(HttpClient), http = TestBed.inject(HttpTestingController);
  proof.accept('P1', new Date(Date.now() + 30 * 60_000).toISOString());
  client.get('https://another.test/api/assessments/active').subscribe();
  const foreign = http.expectOne('https://another.test/api/assessments/active'); expect(foreign.request.headers.has('X-Waseet-SEB-Proof')).toBe(false); foreign.flush({});
  client.post(api + '/assessments/generate', {}).subscribe({ error: () => {} });
  const exam = http.expectOne(api + '/assessments/generate'); expect(exam.request.headers.get('X-Waseet-SEB-Proof')).toBe('P1');
  exam.flush({ code: 'EXAM_ENVIRONMENT_REQUIRED' }, { status: 403, statusText: 'Forbidden' });
  expect(proof.headersFor(api + '/assessments/active')).toEqual({});
});

it('last-chance keepalive autosave carries the same proof and answers without going through HttpClient', () => {
  const fetchMock = vi.fn(() => Promise.resolve({})); vi.stubGlobal('fetch', fetchMock); localStorage.setItem('waseet_token', 'test-login');
  TestBed.inject(SebBrowserProofService).accept('P1', new Date(Date.now() + 30 * 60_000).toISOString());
  TestBed.inject(SpecialtyService).saveAttemptAnswersKeepalive('A1', { Q1: 'A' }, 9);
  const [url, options] = fetchMock.mock.calls[0] as any;
  expect(url).toBe(api + '/assessments/A1/answers'); expect(options.keepalive).toBe(true);
  expect(options.headers['X-Waseet-SEB-Proof']).toBe('P1'); expect(options.headers.Authorization).toBe('Bearer test-login');
  expect(JSON.parse(options.body)).toEqual({ answers: { Q1: 'A' }, seq: 9 });
});
