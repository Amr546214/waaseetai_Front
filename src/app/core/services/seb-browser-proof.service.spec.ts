import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { SebBrowserProofService } from './seb-browser-proof.service';
import { environment } from '../../../environments/environment';

const HASH = 'a'.repeat(64), CK = 'b'.repeat(64);
function mount(href = 'https://dev.waseetai.com/provider-overview/profile/specialties', security?: any) {
  const win: any = { location: { href, origin: 'https://dev.waseetai.com', replace: vi.fn() }, history: { state: { state: 1 }, replaceState: vi.fn() }, ...(security ? { SafeExamBrowser: { security } } : {}) };
  TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: { defaultView: win, baseURI: 'https://dev.waseetai.com/' } }] });
  return { svc: TestBed.inject(SebBrowserProofService), win };
}
afterEach(() => { vi.useRealTimers(); TestBed.resetTestingModule(); });

it('captures native document hashes before router navigation, once, and never computes a client key', async () => {
  const security = { browserExamKey: '', configKey: '', updateKeys: (cb: () => void) => { security.browserExamKey = HASH; security.configKey = CK; cb(); } };
  const { svc, win } = mount('https://dev.waseetai.com/provider-overview/profile/specialties?_seb_challenge=C1', security);
  await svc.captureInitialDocument();
  win.location.href = 'https://dev.waseetai.com/provider-overview/profile/setup?_seb_challenge=C1';
  expect(await svc.takeInitialChallenge()).toEqual({ challenge: 'C1', keys: { browserExamKeyHash: HASH, configKeyHash: CK } });
  expect(await svc.takeInitialChallenge()).toBeNull();
  svc.clearChallengeUrl();
  expect(win.history.replaceState).toHaveBeenCalledWith({ state: 1 }, '', 'https://dev.waseetai.com/provider-overview/profile/setup');
});
it('a normal browser never manufactures native proof; a stalled native callback times out closed', async () => {
  const { svc } = mount('https://dev.waseetai.com/provider-overview/profile/specialties?_seb_challenge=C1');
  await svc.captureInitialDocument();
  expect(svc.hasNativeApi()).toBe(false);
  expect((await svc.takeInitialChallenge())?.keys).toBeNull();
  TestBed.resetTestingModule(); vi.useFakeTimers();
  const stalled = mount('https://dev.waseetai.com/provider-overview/profile/specialties?_seb_challenge=C1', { updateKeys: () => {} }).svc;
  const p = stalled.captureInitialDocument(); await vi.advanceTimersByTimeAsync(1500); await p;
  expect((await stalled.takeInitialChallenge())?.keys).toBeNull();
});
it('sends an unexpired proof only to the configured exam API, including keepalive; revokes locally on expiry', () => {
  vi.useFakeTimers(); const { svc } = mount();
  expect(svc.accept('P1', new Date(Date.now() + 30 * 60_000).toISOString())).toBe(true);
  for (const path of ['/assessments/active', '/assessments/A1/answers', '/exam-environment/ticket']) expect(svc.headersFor(environment.url_api + path)).toEqual({ 'X-Waseet-SEB-Proof': 'P1' });
  for (const url of ['https://attacker.test/api/assessments/active', 'https://dev.waseetai.com.evil.test/api/assessments/active', environment.url_api + '-other/assessments/active', environment.url_api + '/public/settings', environment.url_api + '/exam-environment/js-verify']) expect(svc.headersFor(url)).toEqual({});
  expect(svc.needsRenewal()).toBe(false); vi.advanceTimersByTime(11 * 60_000); expect(svc.needsRenewal()).toBe(true);
  vi.advanceTimersByTime(20 * 60_000); expect(svc.headersFor(environment.url_api + '/assessments/active')).toEqual({});
});
it('only opens a same-origin provider challenge by full document load', () => {
  const { svc, win } = mount();
  for (const url of ['https://attacker.test/provider-overview/x?_seb_challenge=C', 'https://dev.waseetai.com/auth/login?_seb_challenge=C', 'https://dev.waseetai.com/provider-overview/profile/setup']) svc.openChallenge(url);
  expect(win.location.replace).not.toHaveBeenCalled();
  const url = 'https://dev.waseetai.com/provider-overview/profile/setup?_seb_challenge=C'; svc.openChallenge(url);
  expect(win.location.replace).toHaveBeenCalledWith(url);
});
it('SSR does not read native APIs, navigate or create a proof', async () => {
  TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: { defaultView: null, baseURI: 'https://dev.waseetai.com/' } }] });
  const svc = TestBed.inject(SebBrowserProofService); await svc.captureInitialDocument();
  expect(svc.hasNativeApi()).toBe(false); expect(svc.currentPath()).toBeNull(); expect(await svc.takeInitialChallenge()).toBeNull();
  expect(svc.headersFor(environment.url_api + '/assessments/active')).toEqual({});
});
