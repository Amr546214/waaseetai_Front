import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

export const SEB_CHALLENGE_PARAM = '_seb_challenge';
type NativeKeys = { browserExamKeyHash: string; configKeyHash: string };
type SebWindow = Window & { SafeExamBrowser?: { security?: { browserExamKey?: string; configKey?: string; updateKeys?: (callback: () => void) => void } } };
const isHash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v);

/** Native keys are already hashed by SEB with the document URL. Never persist
 * a proof in local/session storage or cookies, and never mistake a JS object
 * or user-agent for successful verification: only the backend can grant it. */
@Injectable({ providedIn: 'root' })
export class SebBrowserProofService {
  private readonly doc = inject(DOCUMENT);
  private proof: { value: string; expiresAt: number } | null = null;
  private initial: Promise<{ challenge: string; keys: NativeKeys | null } | null> = Promise.resolve(null);

  /** Called at bootstrap before router navigation can change the document URL. */
  captureInitialDocument(): Promise<void> {
    const win = this.doc.defaultView as SebWindow | null;
    if (!win) return Promise.resolve();
    const challenge = new URL(win.location.href).searchParams.get(SEB_CHALLENGE_PARAM);
    if (!challenge) return Promise.resolve();
    this.initial = this.readNativeKeys(win).then(keys => ({ challenge, keys }));
    return this.initial.then(() => undefined);
  }

  private readNativeKeys(win: SebWindow): Promise<NativeKeys | null> {
    const security = win.SafeExamBrowser?.security;
    if (!security) return Promise.resolve(null);
    return new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return; settled = true; clearTimeout(timer);
        resolve(isHash(security.browserExamKey) ? { browserExamKeyHash: security.browserExamKey, configKeyHash: isHash(security.configKey) ? security.configKey : '' } : null);
      };
      const timer = setTimeout(() => { if (!settled) { settled = true; resolve(null); } }, 1500);
      try {
        // updateKeys is needed on older versions and when SEB injects into frames.
        if (typeof security.updateKeys === 'function') security.updateKeys(finish);
        else finish();
      } catch { settled = true; clearTimeout(timer); resolve(null); }
    });
  }

  hasNativeApi(): boolean {
    const security = (this.doc.defaultView as SebWindow | null)?.SafeExamBrowser?.security;
    return !!security && (typeof security.updateKeys === 'function' || isHash(security.browserExamKey));
  }
  /** UX only: never used as proof or to authorize an exam API. */
  isSebBrowser(): boolean {
    return this.hasNativeApi() || /SafeExamBrowser|\bSEB[\/\s]/i.test(this.doc.defaultView?.navigator.userAgent ?? '');
  }
  takeInitialChallenge() {
    const initial = this.initial; this.initial = Promise.resolve(null); return initial;
  }
  clearChallengeUrl(): void {
    const win = this.doc.defaultView;
    if (!win) return;
    const url = new URL(win.location.href);
    if (!url.searchParams.has(SEB_CHALLENGE_PARAM)) return;
    url.searchParams.delete(SEB_CHALLENGE_PARAM);
    win.history.replaceState(win.history.state, '', url.href);
  }
  currentPath(): string | null {
    const win = this.doc.defaultView; if (!win) return null;
    const url = new URL(win.location.href); url.searchParams.delete(SEB_CHALLENGE_PARAM);
    return url.pathname.startsWith('/provider-overview/') ? url.pathname + url.search : null;
  }
  openChallenge(url: string): void {
    const win = this.doc.defaultView; if (!win) return;
    const target = new URL(url);
    if (target.origin !== win.location.origin || !target.pathname.startsWith('/provider-overview/') || !target.searchParams.has(SEB_CHALLENGE_PARAM)) return;
    // A full load ensures the native keys cover the nonce-bearing document URL.
    // Never rely on pushState or client-computed hashes for this handshake.
    win.location.replace(target.href);
  }
  accept(value: unknown, expiresAt: unknown): boolean {
    if (typeof value !== 'string' || !value || value.length > 8192 || typeof expiresAt !== 'string') return false;
    const expiry = Date.parse(expiresAt); if (!Number.isFinite(expiry) || expiry <= Date.now()) return false;
    this.proof = { value, expiresAt: expiry }; return true;
  }
  clear(): void { this.proof = null; }
  /** Refresh before starting a 15-minute exam if its proof is nearly expired. */
  needsRenewal(): boolean { return !!this.proof && this.proof.expiresAt - Date.now() < 20 * 60_000; }
  headersFor(url: string): Record<string, string> {
    if (!this.proof || this.proof.expiresAt <= Date.now()) { this.clear(); return {}; }
    const base = new URL(environment.url_api.replace(/\/$/, '') + '/', this.doc.baseURI);
    const target = new URL(url, this.doc.baseURI);
    if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) return {};
    const path = target.pathname.slice(base.pathname.length);
    return /^(?:assessments(?:\/|$)|exam-environment\/ticket$)/.test(path) ? { 'X-Waseet-SEB-Proof': this.proof.value } : {};
  }
}
