import { Injectable, PLATFORM_ID, computed, inject, signal, DestroyRef } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { HttpClient, HttpContext } from '@angular/common/http';
import { SKIP_LOADING } from '../interceptors/loading.interceptor';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import { setPlatformRegional } from '../utils/regional';

/** What the server publishes about the platform itself (GET /public/settings): names, support details, legal texts and the maintenance state. A server answer MAINTENANCE (503) also lands here. */
export const DEFAULT_BRAND = 'وسيط AI';
/** shown by the support buttons (login «account frozen» dialog, report-a-problem page) while the `supportEmail` setting is empty; the server's registry reports the same literal as the value in use */
export const DEFAULT_SUPPORT_EMAIL = 'support@waseet.ai';
/** the support / WhatsApp number shown by the contact page and the footer while the `supportPhone` setting is empty (the server's registry reports the same literal as the value in use) */
export const DEFAULT_SUPPORT_PHONE = '+966 55 256 0392';
/** wa.me link of a displayed number: digits only, a leading 00 dropped (the number must be written in international form) */
export const waLink = (phone: string) =>
  `https://wa.me/${phone.replace(/\D/g, '').replace(/^00/, '')}`;
/** the server's answer during maintenance has this sentence when no banner text is configured; the web app uses it when the server sent none */
export const DEFAULT_MAINTENANCE_MESSAGE = 'المنصة في صيانة مؤقتة. سنعود قريبًا.';
@Injectable({ providedIn: 'root' })
export class PlatformInfoService {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);
  private active = false;
  private again = false;
  private epoch = 0;
  readonly revision = signal(-1);
  readonly publicRevision = signal(-1);
  private browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly maintenance = signal<string | null>(null);
  private title = inject(Title);
  /** the name shown in shell labels: the platform setting, else the built-in brand */
  readonly name = signal('');
  readonly brand = computed(() => this.name() || DEFAULT_BRAND);
  /** the published support address / legal versions (empty = not set) */
  readonly supportEmailSetting = signal('');
  readonly termsVersion = signal('');
  readonly privacyVersion = signal('');
  /** the saved legal texts (empty = not set: the pages render their static text) */
  readonly termsContent = signal('');
  readonly privacyContent = signal('');
  readonly supportPhoneSetting = signal('');
  readonly supportPhone = computed(() => this.supportPhoneSetting() || DEFAULT_SUPPORT_PHONE);
  readonly supportPhoneLink = computed(() => waLink(this.supportPhone()));
  readonly supportEmail = computed(() => this.supportEmailSetting() || DEFAULT_SUPPORT_EMAIL);
  private applyPublic(d: Record<string, unknown> | undefined) {
    const str = (k: string) => (typeof d?.[k] === 'string' ? (d[k] as string).trim() : '');
    this.supportEmailSetting.set(str('supportEmail'));
    this.termsVersion.set(str('termsVersion'));
    this.privacyVersion.set(str('privacyVersion'));
    this.supportPhoneSetting.set(str('supportPhone'));
    this.termsContent.set(str('termsContent'));
    this.privacyContent.set(str('privacyContent'));
  }
  private applyName(v: unknown) {
    const n = typeof v === 'string' ? v.trim() : '';
    this.name.set(n);
    if (this.browser && n) this.title.setTitle(`${n} | للخدمات الذكية`);
  }

  /** All HTTP, socket and 503 inputs share this database revision boundary. */
  applyState(on: boolean, message: string, revision: number): boolean {
    if (!Number.isSafeInteger(revision) || revision < 0 || revision < this.revision()) return false;
    this.revision.set(revision);
    this.maintenance.set(on ? message.trim() || DEFAULT_MAINTENANCE_MESSAGE : null);
    return true;
  }
  private applySnapshot(d: Record<string, unknown>, revision?: number) {
    // A legacy response without a revision can initialize text, but cannot overwrite any versioned state.
    if (revision === undefined) {
      if (this.revision() >= 0) return;
      this.applyMaintenance(
        d['maintenanceMode'] === true,
        String(d['maintenanceBannerText'] || ''),
      );
    } else if (
      !this.applyState(
        d['maintenanceMode'] === true,
        String(d['maintenanceBannerText'] || ''),
        revision,
      )
    )
      return;
    setPlatformRegional(d);
    this.applyPublic(d);
    this.applyName(d['platformName']);
    if (revision !== undefined) this.publicRevision.set(revision);
  }
  /** Public settings synchronize in the background; the app bootstrap has its own initialization loader. */
  load(): void {
    if (!this.browser) return;
    if (this.active) {
      this.again = true;
      return;
    }
    this.active = true;
    const epoch = ++this.epoch;
    this.http
      .get<{ data: Record<string, unknown>; revision?: number }>(
        `${environment.url_api}/public/settings`,
        { context: new HttpContext().set(SKIP_LOADING, true) },
      )
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.active = false;
          if (this.again && !this.destroyRef.destroyed) {
            this.again = false;
            this.load();
          }
        }),
      )
      .subscribe({
        next: (r) => {
          if (epoch === this.epoch) this.applySnapshot(r.data || {}, r.revision);
        },
        error: () => undefined,
      });
  }
  loadOnce(): Promise<void> {
    if (!this.browser) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, 1500);
      this.http
        .get<{ data: Record<string, unknown>; revision?: number }>(
          `${environment.url_api}/public/settings`,
          { context: new HttpContext().set(SKIP_LOADING, true) },
        )
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (r) => {
            this.applySnapshot(r.data || {}, r.revision);
            clearTimeout(timer);
            resolve();
          },
          error: () => {
            clearTimeout(timer);
            resolve();
          },
        });
    });
  }
  /** Unversioned callers are initialization-only. A 503 without a revision triggers an authoritative read. */
  applyMaintenance(on: boolean, message: string, revision?: number) {
    if (revision !== undefined) this.applyState(on, message, revision);
    else if (this.revision() < 0)
      this.maintenance.set(on ? message.trim() || DEFAULT_MAINTENANCE_MESSAGE : null);
  }
  setMaintenance(message: string, revision?: number) {
    if (revision !== undefined) this.applyState(true, message, revision);
    else this.load();
  }
}
