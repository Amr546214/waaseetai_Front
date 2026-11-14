import { Component, computed, inject, signal } from '@angular/core';
import { IdentityFontsRuntime } from '../../../../../core/identity/identity-fonts.runtime';
import { SiteIdentityService } from '../../../../../core/identity/site-identity.service';

/** Reads the existing browser state. A fresh request runs only on an explicit click. */
@Component({
  selector: 'sc-identity-load-status',
  templateUrl: './identity-load-status.html',
  styles: [`
    :host { display: block; margin-bottom: 18px; }
    section { padding: 16px 20px; border: 1px solid var(--border); border-radius: var(--radius-lg, 16px); background: var(--surface); }
    header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    h2 { margin: 0; font-size: 16px; font-weight: 900; }
    p { font-size: 12.5px; line-height: 1.8; color: var(--txt-2); margin: 8px 0; }
    button { padding: 8px 14px; border-radius: 10px; border: 1px solid var(--border); background: var(--pg); color: var(--txt); font: inherit; font-size: 12px; cursor: pointer; }
    button:disabled { opacity: .6; cursor: wait; }
    dl { display: flex; flex-wrap: wrap; gap: 12px 32px; margin: 12px 0; }
    dt { font-size: 12px; color: var(--txt-2); } dd { margin: 4px 0 0; font-size: 16px; font-weight: 800; color: var(--txt); }
    .error { color: var(--red, #FF8C69); } .ok { color: var(--green, #0FA99A); }
    ul { padding-inline-start: 20px; font-size: 12px; color: var(--red, #FF8C69); } li { overflow-wrap: anywhere; margin: 6px 0; }
  `],
})
export class IdentityLoadStatus {
  readonly identity = inject(SiteIdentityService);
  readonly fonts = inject(IdentityFontsRuntime);
  readonly busy = signal(false);
  readonly checked = signal(false);
  readonly publicReadOk = signal(false);
  readonly assets = computed(() => Object.values(this.identity.manifest().items).filter(item => !item.value).length);
  readonly overrides = computed(() => Object.values(this.identity.manifest().items).reduce((count, item) => count + Object.keys(item.value ?? {}).length, 0));

  async refresh(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try { this.publicReadOk.set(await this.identity.refresh(true)); }
    catch { this.publicReadOk.set(false); }
    finally { this.checked.set(true); this.busy.set(false); }
  }
}
