import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { Offer } from './offer';

describe('Offer', () => {
  let component: Offer;
  let fixture: ComponentFixture<Offer>;

  beforeEach(async () => {
    // Pre-existing test-environment gaps (unrelated to this batch): no
    // global localStorage for the real AuthStore, and no ActivatedRoute
    // provider for this route-param-driven component — every test in this
    // file crashed before reaching its own logic.
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });

    await TestBed.configureTestingModule({
      imports: [Offer],
      providers: [provideRouter([])],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Offer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Regression coverage (Batch 4 — re-verification, not a new fix): the
  // purchase HANDLER itself already respects eligibility, not just button
  // styling — confirming this still holds on current main untouched.
  describe('active-purchase eligibility guard (addToCart/openActiveProject)', () => {
    it('3) addToCart() is a no-op when the Client already has an active purchase — it never calls the cart service', () => {
      const addToCartSpy = vi.spyOn((component as any).cartService, 'addToCart$');
      component.model.set({ id: 'svc-1', title: 't', category: 'c', status: 'PUBLISHED', totalAmount: 100, totalDays: 5, aiScore: 0, rating: 0, provider: { id: 'p1', name: 'p', initials: 'p' } } as any);
      component.activePurchase.set({ projectId: 'proj-1', contractStatus: 'ACTIVE' });

      component.addToCart();

      expect(addToCartSpy).not.toHaveBeenCalled();
    });

    it('openActiveProject() navigates to the real project id the backend returned, never a fabricated one', () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      component.activePurchase.set({ projectId: 'real-proj-77', contractStatus: 'ACTIVE' });

      component.openActiveProject();

      expect(navigateSpy).toHaveBeenCalledWith(['/client-overview/projects', 'real-proj-77']);
    });
  });

  // Batch 6: the sidebar previously showed a hardcoded "عادل" (fair) price
  // verdict under an "AI" label for every offer, unconditionally — no real
  // price-fairness computation exists anywhere in the backend
  // (ServiceCatalog has no such field). Removed rather than faked.
  it('never renders a fabricated "fair price" AI verdict, regardless of the real price', () => {
    component.model.set({
      id: 'svc-1', title: 'خدمة تجريبية', category: 'تصميم', status: 'PUBLISHED',
      totalAmount: 999999, totalDays: 3, aiScore: 80, rating: 4.5,
      provider: { id: 'p-1', name: 'مقدم الخدمة', initials: 'م' },
    } as any);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('عادل');
    expect(text).not.toContain('النطاق العادل');
  });
});
