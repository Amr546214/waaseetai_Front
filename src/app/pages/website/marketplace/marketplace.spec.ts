import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';

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

  // AI Cleanup Batch 5 — the landing "AI picks" row is backed by
  // POST /marketplace/ai-recommendations: a real Gemini result (GEMINI) or an
  // honest viewsCount-desc fallback (DETERMINISTIC, aiMatchPercentage null).
  describe('AI recommendations truthfulness (Batch 5)', () => {
    const rec = (over: any = {}) => ({ id: 'm1', title: 'نموذج', totalAmount: 100, totalDays: 3, aiScore: 81, aiMatchPercentage: null, provider: { id: 'p', name: 'p', initials: 'p' }, ...over });

    function load(data: any) {
      vi.spyOn((component as any).marketplaceService, 'getAiRecommendations').mockReturnValue(of({ data }));
      component.loadAiRecommendations();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('a DETERMINISTIC fallback is not titled as AI picks and shows the stored score as quality, never as a match', () => {
      const host = load({ generationSource: 'DETERMINISTIC', bannerInsight: 'تم استرجاع 1 نموذج من البيانات المنشورة المطابقة للبحث الحالي.', recommendations: [rec()] });
      const text = host.textContent || '';
      expect(component.aiGenerationSource()).toBe('DETERMINISTIC');
      expect(text).not.toContain('اختيارات الذكاء الاصطناعي');
      expect(text).toContain('الأكثر مشاهدة');
      expect(text).toContain('جودة AI 81%');
      expect(text).not.toContain('تطابق 81%');
    });

    it('a genuine GEMINI recommendation keeps its real match percentage and AI title', () => {
      const host = load({ generationSource: 'GEMINI', bannerInsight: 'جملة AI', recommendations: [rec({ aiScore: 74, aiMatchPercentage: 74 })] });
      const text = host.textContent || '';
      expect(text).toContain('اختيارات الذكاء الاصطناعي');
      expect(text).toContain('تطابق AI 74%');
    });

    it('the banner shows the backend bannerInsight instead of staying on the "جاري تحليل" placeholder', () => {
      load({ generationSource: 'DETERMINISTIC', bannerInsight: 'تم استرجاع 2 نموذج', recommendations: [] });
      expect(component.aiBannerInsight()).toBe('تم استرجاع 2 نموذج');
    });
  });

  describe('filters drawer + budget slider', () => {
    it('opens, closes, and closes on Escape', () => {
      expect(component.filtersOpen()).toBe(false);
      component.openFilters();
      expect(component.filtersOpen()).toBe(true);
      component.onEscape();
      expect(component.filtersOpen()).toBe(false);
      component.openFilters();
      component.closeFilters();
      expect(component.filtersOpen()).toBe(false);
    });

    it('budget fill follows the slider: 0 at the first value, 1 at the last, live while dragging', () => {
      component.priceLimit.set(1000);
      expect(component.priceFill()).toBe(1); // no limit chosen => full range
      component.onPriceInput({ target: { value: '0' } } as unknown as Event);
      expect(component.priceFill()).toBe(0);
      component.onPriceInput({ target: { value: '250' } } as unknown as Event);
      expect(component.priceFill()).toBe(0.25);
      component.onPriceInput({ target: { value: '1000' } } as unknown as Event);
      expect(component.priceFill()).toBe(1);
    });
  });
});
