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
  });

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
});
