import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { IdentityGuide } from './identity-guide';
import { AdminAccessService } from '../../../../../core/services/admin-access.service';
import { SiteIdentityAdminApi } from '../../../../../core/identity/site-identity-admin.api';
import { PlatformTokensStore } from '../platform-tokens/platform-tokens.store';

function setup(can = true) {
 const api = { publish: vi.fn(), upload: vi.fn(), restore: vi.fn() };
 const store = { load: vi.fn(), phase: signal('idle'), item: () => null };
 TestBed.configureTestingModule({ imports: [IdentityGuide], providers: [provideRouter([]),
  { provide: AdminAccessService, useValue: { can: () => can } },
  { provide: SiteIdentityAdminApi, useValue: api }, { provide: PlatformTokensStore, useValue: store },
 ] });
 const f = TestBed.createComponent(IdentityGuide); f.detectChanges();
 return { f, c: f.componentInstance, root: (f.nativeElement as HTMLElement).shadowRoot!, api, store };
}

describe('original identity guide and real editors', () => {
 afterEach(() => TestBed.resetTestingModule());
 it('does not load the large reference on entry; opening uses an opaque sandbox without account access', () => {
  const t = setup(); expect(t.root.querySelector('iframe')).toBeNull();
  t.c.openReference(); t.f.detectChanges();
  const frame = t.root.querySelector('iframe')!;
  expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
  expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
  expect(frame.getAttribute('src')).toBe('/assets/site-control/identity-guide/index.html');
  expect(t.api.publish).not.toHaveBeenCalled();
 });
 it('ignores another window, malformed commands and publish commands even from the real frame', () => {
  const t = setup(); t.c.openReference(); t.f.detectChanges();
  const frame = t.root.querySelector('iframe')!;
  t.c.onMessage({ source: window, data: { type: 'waseet-identity-edit', section: 'colors' } } as unknown as MessageEvent);
  t.c.onMessage({ source: frame.contentWindow, data: { type: 'publish', section: 'colors' } } as MessageEvent);
  t.c.onMessage({ source: frame.contentWindow, data: { type: 'waseet-identity-edit', section: 'unknown' } } as MessageEvent);
  expect(t.c.selected()).toBe('reference'); expect(t.api.publish).not.toHaveBeenCalled();
 });
 it('a real frame message only selects the shared versioned editor; it never applies changes', () => {
  const t = setup(); t.c.openReference(); t.f.detectChanges();
  const frame = t.root.querySelector('iframe')!;
  // DOM emulators can expose null contentWindow for frames in a shadow root. Use a stable WindowProxy test double.
  const source = {} as Window;
  Object.defineProperty(frame, 'contentWindow', { configurable: true, value: source });
  t.c.onMessage({ source: window, data: { type: 'waseet-identity-ready' } } as unknown as MessageEvent);
  expect(t.c.loaded()).toBe(false);
  t.c.onMessage({ source, data: { type: 'waseet-identity-ready' } } as MessageEvent);
  expect(t.c.loaded()).toBe(true);
  t.c.onMessage({ source, data: { type: 'waseet-identity-edit', section: 'colors' } } as MessageEvent);
  t.f.detectChanges();
  expect(t.c.selected()).toBe('colors'); expect(t.root.querySelector('sc-token-editor')).toBeTruthy();
  expect(t.store.load).toHaveBeenCalled(); expect(t.api.publish).not.toHaveBeenCalled(); expect(t.api.upload).not.toHaveBeenCalled();
 });
 it('keeps an opened editor mounted when switching sections so unsaved fields are not discarded', () => {
  const t = setup(); t.c.select('colors'); t.f.detectChanges();
  const original = t.root.querySelector('sc-token-editor');
  t.c.select('typography'); t.f.detectChanges();
  expect(t.root.querySelectorAll('sc-token-editor').length).toBe(2);
  t.c.select('colors'); t.f.detectChanges();
  expect(t.root.querySelector('sc-token-editor')).toBe(original);
  expect(t.api.publish).not.toHaveBeenCalled();
 });
 it('does not offer an icon-library route without its existing page permission', () => {
  const t = setup(false); t.c.select('icons'); t.f.detectChanges();
  expect(t.root.querySelector('a[href*="/site-control/icons"]')).toBeNull();
  expect(t.root.textContent).toContain('يحتاج صلاحية');
 });
 it('Escape leaves the expanded guide without publishing or changing its selected editor', () => {
  const t = setup(); t.c.expanded.set(true); t.c.closeExpanded();
  expect(t.c.expanded()).toBe(false); expect(t.api.publish).not.toHaveBeenCalled();
 });
});
