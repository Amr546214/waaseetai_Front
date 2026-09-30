import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { Slug } from './slug';

describe('Slug', () => {
  let component: Slug;
  let fixture: ComponentFixture<Slug>;

  beforeEach(async () => {
    // Pre-existing test-environment gaps (unrelated to this batch): no
    // global localStorage for the real AuthStore, and no ActivatedRoute
    // provider for this route-param-driven component — every test in this
    // file crashed before reaching its own logic.
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });

    await TestBed.configureTestingModule({
      imports: [Slug],
      providers: [provideRouter([])],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Slug);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Regression coverage (Batch 4) — same eligibility contract as
  // marketplace.ts/curated.ts/card.ts (see marketplace-service.service.ts
  // getMarketplaceModels): a Client's active purchase must route to the real
  // project, never a normal actionable "buy again" card.
  describe('active-purchase eligibility (model.eligibility)', () => {
    const baseModel: any = { id: 'svc-1', title: 't', provider: { id: 'p1', name: 'p', initials: 'p' } };

    it('2) an eligible service links to the normal offer/buy page', () => {
      const model = { ...baseModel, eligibility: { hasActivePurchase: false, activeProjectId: null } };
      expect(component.hasActivePurchase(model)).toBe(false);
      expect(component.cardLink(model)).toEqual(['/marketplace/offer', 'svc-1']);
    });

    it('2) a service with an active purchase links to the real project id', () => {
      const model = { ...baseModel, eligibility: { hasActivePurchase: true, activeProjectId: 'proj-1' } };
      expect(component.hasActivePurchase(model)).toBe(true);
      expect(component.cardLink(model)).toEqual(['/client-overview/projects', 'proj-1']);
    });

    it('6) a guest/other-role model (no eligibility field) keeps normal behavior', () => {
      expect(component.hasActivePurchase(baseModel)).toBe(false);
      expect(component.cardLink(baseModel)).toEqual(['/marketplace/offer', 'svc-1']);
    });
  });
});
