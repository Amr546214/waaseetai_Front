import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect } from 'vitest';

import { SaPlans } from '../../subscriptions/sa-plans/sa-plans';
import { SaUpgrade } from '../../subscriptions/sa-upgrade/sa-upgrade';
import { SaActiveSubs } from '../../subscriptions/sa-active-subs/sa-active-subs';
import { SaSubInvoices } from '../../subscriptions/sa-sub-invoices/sa-sub-invoices';
import { SaBoost } from '../../subscriptions/sa-boost/sa-boost';
import { SaAds } from '../../subscriptions/sa-ads/sa-ads';
import { SaPromotions } from '../../subscriptions/sa-promotions/sa-promotions';
import { SaPlanDetails } from '../../subscriptions/sa-plan-details/sa-plan-details';

// The infrastructure pages (servers, database, performance, APIs, CDN, backups) read real measurements now: see shared/infra-panel spec.
// The team / tasks / performance pages are real now (admin-team-pages.spec.ts covers their honest unavailable measures).
// Admin sweep (D3): every converted page must render the honest "not available"
// state (status card with a reason) and no fabricated numeric KPIs.
const PAGES: [string, any][] = [
  ['sa-plans', SaPlans],
  ['sa-upgrade', SaUpgrade], ['sa-active-subs', SaActiveSubs], ['sa-sub-invoices', SaSubInvoices],
  ['sa-boost', SaBoost], ['sa-ads', SaAds], ['sa-promotions', SaPromotions], ['sa-plan-details', SaPlanDetails],
];

describe('converted admin pages show an honest unavailable state', () => {
  for (const [name, cmp] of PAGES) {
    it(`${name} renders a reason and no digits`, () => {
      TestBed.configureTestingModule({
        imports: [cmp],
        providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
      });
      const fixture = TestBed.createComponent(cmp);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const card = el.querySelector('.sau-card');
      expect(card).toBeTruthy();
      expect(card!.querySelector('.sau-card-sub')!.textContent!.length).toBeGreaterThan(20);
      expect(el.querySelector('h1')!.textContent!.trim().length).toBeGreaterThan(0);
      // no fake KPIs: no digits anywhere except the literal /api/health path on sa-apis
      const text = (el.textContent ?? '').replace('/api/health', '');
      expect(/[0-9٠-٩]/.test(text)).toBe(false);
      TestBed.inject(HttpTestingController, null as any)?.match(() => true);
    });
  }
});
