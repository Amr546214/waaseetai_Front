import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { Marketplace } from './marketplace';

describe('Marketplace', () => {
  let component: Marketplace;
  let fixture: ComponentFixture<Marketplace>;

  beforeEach(async () => {
    // Pre-existing test-environment gap (unrelated to this batch): this
    // runner provides no global localStorage, and Marketplace injects the
    // real AuthStore, whose constructor reads it synchronously — every test
    // in this file crashed before reaching its own logic.
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });

    await TestBed.configureTestingModule({
      imports: [Marketplace],
      providers: [provideRouter([])],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Marketplace);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }, 30000);
  // Pre-existing: this beforeEach is borderline-slow even before Batch 5 (it
  // was already close to the 10s default hookTimeout with 5 tests); Batch 5
  // added 2 more tests re-running the same slow setup, which pushed it over
  // non-deterministically. Bumping only this file's hook timeout — no
  // component logic changed.

  afterEach(() => vi.unstubAllGlobals());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Regression coverage (Batch 4): a Client already having an active
  // purchase for a service must not see a normal, actionable "buy again"
  // card — the card must navigate to the real existing project instead, and
  // never fabricate a destination when the backend didn't return one.
  describe('active-purchase eligibility (model.eligibility, from getMarketplaceModels)', () => {
    const baseModel: any = { id: 'svc-1', title: 't', provider: { id: 'p1', name: 'p', initials: 'p' } };

    it('1) an eligible service (no active purchase) links to the normal offer/buy page', () => {
      const model = { ...baseModel, eligibility: { hasActivePurchase: false, activeProjectId: null } };
      expect(component.hasActivePurchase(model)).toBe(false);
      expect(component.cardLink(model)).toEqual(['/marketplace/offer', 'svc-1']);
    });

    it('2) a service with an active purchase links to the real project, never the offer/buy page', () => {
      const model = { ...baseModel, eligibility: { hasActivePurchase: true, activeProjectId: 'proj-1' } };
      expect(component.hasActivePurchase(model)).toBe(true);
      expect(component.cardLink(model)).toEqual(['/client-overview/projects', 'proj-1']);
    });

    it('6) guests / non-Client roles (no eligibility field at all) keep the exact normal behavior', () => {
      const model = { ...baseModel }; // no `eligibility` key — guest/other-role response shape
      expect(component.hasActivePurchase(model)).toBe(false);
      expect(component.cardLink(model)).toEqual(['/marketplace/offer', 'svc-1']);
    });

    it('3/5) an active purchase with a missing activeProjectId (inconsistent data) never fabricates a destination — falls back to the offer page rather than a broken/empty route', () => {
      const model = { ...baseModel, eligibility: { hasActivePurchase: true, activeProjectId: null } };
      expect(component.cardLink(model)).toEqual(['/marketplace/offer', 'svc-1']);
    });
  });

  // Batch 5 — this page's result-grid level badge was already real-data-driven
  // (unlike the dashboard/curated bugs), but had its own private 3-entry color
  // map. resultLevelStyle() now delegates to the same canonical helper used by
  // slug.ts/card.ts/curated.ts so a provider's badge color can never diverge
  // between pages.
  describe('canonical provider level styling (Batch 5)', () => {
    const baseModel: any = { id: 'svc-1', title: 't', provider: { id: 'p1', name: 'p', initials: 'p' } };

    it('uses the canonical highlighted-level color for a known real level', () => {
      expect(component.resultLevelStyle({ ...baseModel, level: 'خبير' })).toEqual({ bg: 'rgba(123,47,190,.85)', color: '#E0C6FF' });
    });

    it('falls back to the neutral default rather than fabricating a color for an unhighlighted/unexpected level', () => {
      expect(component.resultLevelStyle({ ...baseModel, level: 'مبتدئ' })).toEqual({ bg: 'rgba(43,212,199,.6)', color: '#2BD4C7' });
      expect(component.resultLevelStyle({ ...baseModel, level: undefined })).toEqual({ bg: 'rgba(43,212,199,.6)', color: '#2BD4C7' });
    });
  });
});
