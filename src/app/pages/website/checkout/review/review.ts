import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CheckoutStepper } from '../components/checkout-stepper/checkout-stepper';
import { OrderSummary } from '../components/order-summary/order-summary';
import { CartService } from '../../../../core/services/cart.service';
import { CheckoutService } from '../../../../core/services/checkout.service';
import { AuthStore } from '../../../../core/store/auth.store';

@Component({
  selector: 'app-checkout-review',
  standalone: true,
  imports: [CommonModule, CheckoutStepper, OrderSummary, RouterLink],
  templateUrl: './review.html',
  styleUrl: './review.css',
})
export class CheckoutReviewComponent {
  step = 2;

  private cartService = inject(CartService);
  private checkoutService = inject(CheckoutService);
  private authStore = inject(AuthStore);
  private router = inject(Router);

  items = this.cartService.items;
  itemCount = this.cartService.itemCount;
  subtotal = this.cartService.subtotal;
  discount = this.cartService.discount;
  total = this.cartService.total;
  coupon = this.cartService.coupon;

  isProcessing = signal(false);
  errorMessage = signal<string | null>(null);

  user = this.authStore.currentUser;

  activeItems = computed(() => this.items().filter(i => !i.savedForLater));

  get fullName(): string {
    const u = this.user();
    if (!u) return '—';
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';
  }

  get email(): string {
    const u = this.user();
    return u?.email || '—';
  }

  get phone(): string {
    const u = this.user();
    if (!u) return '—';
    const cc = u.phoneCountryCode || '';
    const num = u.phoneNumber || '';
    return [cc, num].filter(Boolean).join(' ') || '—';
  }

  get accountTypeLabel(): string {
    const u = this.user();
    if (!u) return '—';
    const map: Record<string, string> = {
      CLIENT_INDIVIDUAL: 'فرد',
      CLIENT_COMPANY: 'شركة',
      PROVIDER_INDIVIDUAL: 'مزود فردي',
      PROVIDER_COMPANY: 'مزود شركة',
    };
    return map[u.accountType] || u.accountType || '—';
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  }

  proceedToPayment() {
    if (this.itemCount() === 0 || this.isProcessing()) return;
    this.isProcessing.set(true);
    this.errorMessage.set(null);

    const result = this.checkoutService.createOrder();
    if (result.success) {
      this.router.navigate(['/checkout/payment']);
    } else {
      this.errorMessage.set(result.message);
      this.isProcessing.set(false);
    }
  }
}
