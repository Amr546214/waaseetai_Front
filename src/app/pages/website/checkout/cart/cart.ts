import { Component, inject, signal, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CheckoutStepper } from '../components/checkout-stepper/checkout-stepper';
import { OrderSummary } from '../components/order-summary/order-summary';
import { CartService } from '../../../../core/services/cart.service';
import { MarketplaceService, MarketplaceModel } from '../../../../core/services/marketplace.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, CheckoutStepper, OrderSummary, RouterLink],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
})
export class CartComponent implements OnInit, OnDestroy {
  step = 1;

  private cartService = inject(CartService);
  private marketplaceService = inject(MarketplaceService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  items = this.cartService.items;
  coupon = this.cartService.coupon;
  itemCount = this.cartService.itemCount;
  subtotal = this.cartService.subtotal;
  discount = this.cartService.discount;
  total = this.cartService.total;

  couponInput = signal('');
  couponMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  isApplyingCoupon = signal(false);
  aiRecommendations = signal<MarketplaceModel[]>([]);
  aiLoading = signal(false);
  aiError = signal(false);

  private aiSub?: Subscription;

  ngOnInit() {
    this.loadAiRecommendations();
  }

  ngOnDestroy() {
    this.aiSub?.unsubscribe();
  }

  get activeItems() {
    return this.items().filter(i => !i.savedForLater);
  }

  get savedItems() {
    return this.items().filter(i => i.savedForLater);
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
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
    if (!code) return;
    this.isApplyingCoupon.set(true);
    const result = this.cartService.applyCoupon(code);
    if (result.success) {
      this.couponMessage.set({ type: 'success', text: result.message });
      this.couponInput.set('');
    } else {
      this.couponMessage.set({ type: 'error', text: result.message });
    }
    this.isApplyingCoupon.set(false);
    setTimeout(() => this.couponMessage.set(null), 3000);
  }

  removeCoupon() {
    this.cartService.removeCoupon();
    this.couponMessage.set(null);
  }

  proceedToCheckout() {
    if (this.itemCount() === 0) return;
    this.router.navigate(['/checkout/review']);
  }

  private loadAiRecommendations() {
    if (!this.isBrowser) return;
    this.aiLoading.set(true);
    this.aiError.set(false);
    this.aiSub = this.marketplaceService.getAiRecommendations({ limit: 3 }).subscribe({
      next: (res) => {
        const recs = res?.data?.recommendations || res?.recommendations || [];
        this.aiRecommendations.set(recs);
        this.aiLoading.set(false);
      },
      error: () => {
        this.aiError.set(true);
        this.aiLoading.set(false);
      },
    });
  }
}
