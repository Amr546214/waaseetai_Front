import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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

  // Batch 5 — service-detail's own level badge was already the canonical
  // real-data reference other surfaces were compared against; levelStyle()
  // now delegates to the single shared helper (provider-level-style.util.ts)
  // instead of its own private map, so this page's behavior is unchanged
  // while the duplication is removed.
  describe('canonical provider level styling (Batch 5)', () => {
    const baseModel: any = { id: 'svc-1', title: 't', provider: { id: 'p1', name: 'p', initials: 'p' } };

    it('uses the canonical highlighted-level color for a known real level', () => {
      expect(component.levelStyle({ ...baseModel, level: 'خبير' })).toEqual({ bg: 'rgba(123,47,190,.85)', color: '#E0C6FF' });
    });

    it('falls back to the neutral default rather than fabricating a color for an unhighlighted/unexpected level', () => {
      expect(component.levelStyle({ ...baseModel, level: 'مبتدئ' })).toEqual({ bg: 'rgba(43,212,199,.6)', color: '#2BD4C7' });
      expect(component.levelStyle({ ...baseModel, level: undefined })).toEqual({ bg: 'rgba(43,212,199,.6)', color: '#2BD4C7' });
    });
  });

  describe('filters drawer draft (nothing applies until "تطبيق الفلاتر")', () => {
    const input = (v: number) => ({ target: { value: String(v) } }) as unknown as Event;
    let navigate: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      component.priceLimit.set(1000);
    });

    it('editing inside the drawer never navigates or touches the committed filters', () => {
      component.openFilters();
      component.onPriceInput(input(39));
      component.draftLevel('خبير');
      component.draftRating(4);
      component.draftDays(7);
      expect(component.priceValue()).toBe(39);
      expect(navigate).not.toHaveBeenCalled();
      expect(component.selectedMaxPrice()).toBeNull();
      expect(component.selectedLevels()).toEqual([]);
    });

    it('closing discards the draft; reopening shows the current (unmodified) filters', () => {
      component.openFilters();
      component.onPriceInput(input(39));
      component.closeFilters();
      component.openFilters();
      expect(component.priceValue()).toBe(1000);
      expect(component.draftView().levels).toEqual([]);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('Escape discards the draft', () => {
      component.openFilters();
      component.onPriceInput(input(39));
      component.onEscape();
      expect(component.filtersOpen()).toBe(false);
      expect(component.priceValue()).toBe(1000);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('apply navigates exactly once with the whole draft, then closes', () => {
      component.openFilters();
      component.onPriceInput(input(39));
      component.draftLevel('خبير');
      component.draftRating(4);
      component.applyAndClose();
      expect(navigate).toHaveBeenCalledTimes(1);
      const params = (navigate.mock.calls[0] as any[]).find((a) => a && typeof a === 'object' && !Array.isArray(a) && 'queryParams' in a).queryParams;
      expect(params).toMatchObject({ maxPrice: 39, level: 'خبير', minRating: 4, page: null });
      expect(component.filtersOpen()).toBe(false);
    });

    it('reset inside the drawer only clears the draft; it is applied by apply', () => {
      component.selectedMaxPrice.set(200);
      component.openFilters();
      component.resetDraft();
      expect(navigate).not.toHaveBeenCalled();
      expect(component.priceValue()).toBe(1000);
      expect(component.selectedMaxPrice()).toBe(200);
    });
  });
});
