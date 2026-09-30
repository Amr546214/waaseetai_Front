import { Component, inject, signal, effect, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../../../core/services/cart.service';
import { MarketplaceService, MarketplaceModel } from '../../../../core/services/marketplace.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { Subscription, Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cart.html',
  styleUrls: ['../components/checkout-tokens.css', './cart.css'],
})
export class CartComponent implements OnInit, OnDestroy {
  step = 1;

  private cartService = inject(CartService);
  private marketplaceService = inject(MarketplaceService);
  private router = inject(Router);
  private authStore = inject(AuthStore);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  items = this.cartService.items;
  coupon = this.cartService.coupon;
  itemCount = this.cartService.itemCount;
  subtotal = this.cartService.subtotal;
  discount = this.cartService.discount;
  total = this.cartService.total;

  couponInput = signal('');
  couponMessage = signal<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  isApplyingCoupon = signal(false);
  aiRecommendations = signal<MarketplaceModel[]>([]);
  aiLoading = signal(false);
  aiError = signal(false);
  // Reflects the backend's honest generationSource — never assume GEMINI
  // before a response actually confirms it (see F6 security follow-up).
  aiGenerationSource = signal<'GEMINI' | 'DETERMINISTIC' | null>(null);

  // "إضافة للسلة" on the recommendation cards (P-BF-001 rec-add-btn)
  addedRecIds = signal<Set<string>>(new Set());
  addingRecId = signal<string | null>(null);
  recError = signal<string | null>(null);

  // Gap 1/2 (duplicate-purchase awareness on the cart page) — reuses the
  // same GET /marketplace/models/:id/my-purchase endpoint the offer page
  // already relies on (findActiveServicePurchases on the backend). Keyed by
  // modelId -> the client's already-running project for that service, so a
  // link can jump straight to it (same nav pattern as offer.ts's
  // openActiveProject()).
  conflictingItems = signal<Map<string, { projectId: string | null }>>(new Map());
  // Same conflict data, but for the AI-recommendation cards below the cart —
  // lets the "إضافة للسلة" button be proactively disabled before the user
  // ever clicks, instead of relying only on the backend's reactive 409.
  recConflictIds = signal<Set<string>>(new Set());
  checkoutBlockedMessage = signal<string | null>(null);

  readonly duplicatePurchaseMessage = 'لديك مشروع نشط لهذه الخدمة — لا يمكن شراؤها مرة أخرى قبل اكتمال المشروع الحالي';

  private aiSub?: Subscription;
  private lastCheckedCartKey = '';
  private lastCheckedRecKey = '';

  constructor() {
    // Cart items load asynchronously (CartService.loadCart() is fire-and-
    // forget), and addRecommendation()/removeItem()/etc. mutate the items
    // signal later too — an effect (rather than a one-shot call right after
    // loadCart()) means every one of those cases is covered by the same
    // logic, including "a newly-added recommendation must be included".
    effect(() => {
      if (!this.isBrowser) return;
      const ids = Array.from(new Set(this.activeItems.map(i => i.modelId)));
      const key = ids.slice().sort().join('|');
      if (key === this.lastCheckedCartKey) return;
      this.lastCheckedCartKey = key;
      this.refreshCartConflicts(ids);
    });

    effect(() => {
      if (!this.isBrowser) return;
      const ids = this.aiRecommendations().map(r => r.id);
      const key = ids.slice().sort().join('|');
      if (key === this.lastCheckedRecKey) return;
      this.lastCheckedRecKey = key;
      this.refreshRecommendationConflicts(ids);
    });
  }

  ngOnInit() {
    this.cartService.loadCart();
    this.loadAiRecommendations();
  }

  ngOnDestroy() {
    this.aiSub?.unsubscribe();
  }

  /** Batch-checks GET /marketplace/models/:id/my-purchase for every given
   *  service id in parallel, returning only the ones the client already has
   *  an active (non-terminal) contract-backed project for. A per-call
   *  catchError means one failing lookup can never break the whole batch —
   *  worst case that one service is silently treated as "no conflict",
   *  exactly like offer.ts's own error handling for this same endpoint. */
  private fetchActivePurchaseMap(ids: string[]): Observable<Map<string, { projectId: string | null }>> {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (!uniqueIds.length) return of(new Map<string, { projectId: string | null }>());
    const calls = uniqueIds.map(id =>
      this.marketplaceService.getMyPurchaseStatus(id).pipe(
        map((res: any) => ({ id, data: res?.data })),
        catchError(() => of({ id, data: null as any }))
      )
    );
    return forkJoin(calls).pipe(
      map(results => {
        const conflictMap = new Map<string, { projectId: string | null }>();
        for (const r of results) {
          if (r.data?.active) conflictMap.set(r.id, { projectId: r.data.projectId ?? null });
        }
        return conflictMap;
      })
    );
  }

  private refreshCartConflicts(ids: string[] = Array.from(new Set(this.activeItems.map(i => i.modelId)))) {
    this.fetchActivePurchaseMap(ids).subscribe(conflictMap => {
      this.conflictingItems.set(conflictMap);
      if (conflictMap.size === 0) this.checkoutBlockedMessage.set(null);
    });
  }

  private refreshRecommendationConflicts(ids: string[] = this.aiRecommendations().map(r => r.id)) {
    this.fetchActivePurchaseMap(ids).subscribe(conflictMap => this.recConflictIds.set(new Set(conflictMap.keys())));
  }

  /** Follows the client's already-running project for a conflicting cart
   *  item — same navigation pattern as offer.ts's openActiveProject(). */
  followConflictingProject(modelId: string) {
    const projectId = this.conflictingItems().get(modelId)?.projectId ?? null;
    this.router.navigate(projectId ? ['/client-overview/projects', projectId] : ['/client-overview/projects/active']);
  }

  get activeItems() {
    return this.items().filter(i => !i.savedForLater);
  }

  get savedItems() {
    return this.items().filter(i => i.savedForLater);
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  }

  removeItem(itemId: string) {
    this.cartService.removeFromCart(itemId);
  }

  toggleSaveForLater(itemId: string) {
    this.cartService.saveForLater(itemId);
  }

  clearCart() {
    if (this.isBrowser) {
      const confirmed = confirm('هل أنت متأكد من مسح السلة؟');
      if (confirmed) {
        this.cartService.clearCart();
      }
    }
  }

  applyCoupon() {
    const code = this.couponInput().trim();
    if (!code) {
      this.couponMessage.set({ type: 'info', text: 'أدخل كود الخصم أولاً' });
      return;
    }
    this.isApplyingCoupon.set(true);
    this.cartService.applyCoupon(code).subscribe({
      next: (result) => {
        if (result.success) {
          this.couponMessage.set({ type: 'success', text: result.message });
          this.couponInput.set('');
        } else {
          this.couponMessage.set({ type: 'error', text: result.message });
        }
        this.isApplyingCoupon.set(false);
        setTimeout(() => this.couponMessage.set(null), 3000);
      },
      error: () => {
        this.isApplyingCoupon.set(false);
        this.couponMessage.set({ type: 'error', text: 'حدث خطأ، حاول مرة أخرى' });
        setTimeout(() => this.couponMessage.set(null), 3000);
      },
    });
  }

  removeCoupon() {
    this.cartService.removeCoupon();
    this.couponMessage.set(null);
  }

  proceedToCheckout() {
    if (this.itemCount() === 0) return;
    // Gap 1: block navigation to /checkout/review while any active cart
    // item still conflicts with an already-running project for that same
    // service — the backend would reject this at createOrder() anyway (409),
    // but surfacing it here avoids a pointless round-trip to the review page.
    if (this.conflictingItems().size > 0) {
      this.checkoutBlockedMessage.set('يرجى إزالة الخدمة/الخدمات التي لديك مشروع نشط لها من السلة، أو متابعة المشروع الحالي، قبل إتمام الشراء');
      setTimeout(() => this.checkoutBlockedMessage.set(null), 6000);
      return;
    }
    this.checkoutBlockedMessage.set(null);
    this.router.navigate(['/checkout/review']);
  }

  addRecommendation(event: Event, rec: MarketplaceModel) {
    event.preventDefault();
    event.stopPropagation();
    if (this.addingRecId() || this.addedRecIds().has(rec.id) || this.recConflictIds().has(rec.id)) return;
    if (!this.authStore.isAuthenticated()) {
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.addingRecId.set(rec.id);
    this.recError.set(null);
    this.cartService.addToCart$({
      modelId: rec.id,
      title: rec.title,
      category: rec.category,
      categorySlug: rec.categorySlug,
      coverImage: rec.coverImage,
      totalAmount: rec.totalAmount,
      totalDays: rec.totalDays,
      level: rec.level,
      aiScore: rec.aiScore,
      provider: {
        id: rec.provider.id,
        name: rec.provider.name,
        avatar: rec.provider.avatar,
        initials: rec.provider.initials,
        isVerified: rec.isVerified,
      },
      savedForLater: false,
    }).subscribe({
      next: () => {
        this.addingRecId.set(null);
        this.addedRecIds.update(ids => new Set(ids).add(rec.id));
        // Gap 1: re-run the cart conflict check so this newly-added
        // recommendation is immediately reflected if it turns out to
        // conflict (defense-in-depth alongside the items()-driven effect
        // above, which would also pick this up reactively on its own).
        this.refreshCartConflicts();
      },
      error: (err) => {
        this.addingRecId.set(null);
        this.recError.set(err?.displayMessage || err?.error?.message || 'تعذر إضافة الخدمة إلى السلة');
        setTimeout(() => this.recError.set(null), 5000);
      },
    });
  }

  private loadAiRecommendations() {
    if (!this.isBrowser) return;
    this.aiLoading.set(true);
    this.aiError.set(false);
    this.aiSub = this.marketplaceService.getAiRecommendations({ limit: 3 }).subscribe({
      next: (res) => {
        const recs = res?.data?.recommendations || res?.recommendations || [];
        this.aiRecommendations.set(recs);
        this.aiGenerationSource.set(res?.data?.generationSource === 'GEMINI' ? 'GEMINI' : 'DETERMINISTIC');
        this.aiLoading.set(false);
      },
      error: () => {
        this.aiError.set(true);
        this.aiGenerationSource.set(null);
        this.aiLoading.set(false);
      },
    });
  }
}
