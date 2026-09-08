import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CheckoutStepper } from '../components/checkout-stepper/checkout-stepper';
import { CartService } from '../../../../core/services/cart.service';
import { CheckoutService } from '../../../../core/services/checkout.service';
import { CheckoutApiService, PaymentMethodItem } from '../../../../core/services/checkout-api.service';
import { PaymentMethod } from '../../../../core/models/checkout.model';

interface PaymentMethodOption {
  id: PaymentMethod;
  label: string;
  sub: string;
  icon: 'card' | 'wallet' | 'stc' | 'apple';
  available: boolean;
  badge?: string;
  balance?: number;
}

const FALLBACK_METHODS: PaymentMethodOption[] = [
  { id: 'card', label: 'بطاقة ائتمانية / مدى', sub: 'Visa · Mastercard · مدى', icon: 'card', available: true },
  { id: 'wallet', label: 'المحفظة الإلكترونية', sub: 'رصيد المحفظة', icon: 'wallet', available: true, badge: 'متاح' },
  { id: 'stc_pay', label: 'STC Pay', sub: 'ادفع عبر تطبيق STC Pay', icon: 'stc', available: true },
  { id: 'apple_pay', label: 'Apple Pay', sub: 'ادفع بلمسة واحدة', icon: 'apple', available: true },
];

@Component({
  selector: 'app-checkout-payment',
  standalone: true,
  imports: [CommonModule, CheckoutStepper, RouterLink],
  templateUrl: './payment.html',
  styleUrl: './payment.css',
})
export class CheckoutPaymentComponent implements OnInit {
  step = 3;

  private cartService = inject(CartService);
  private checkoutService = inject(CheckoutService);
  private checkoutApi = inject(CheckoutApiService);
  private router = inject(Router);

  items = this.cartService.items;
  itemCount = this.cartService.itemCount;
  subtotal = this.cartService.subtotal;
  discount = this.cartService.discount;
  total = this.cartService.total;
  coupon = this.cartService.coupon;
  currentOrder = this.checkoutService.currentOrder;

  selectedMethod = signal<PaymentMethod | null>(null);
  isProcessing = signal(false);
  errorMessage = signal<string | null>(null);
  showComingSoon = signal(false);
  methodsLoading = signal(false);
  agreedToTerms = signal(false);

  paymentMethods = signal<PaymentMethodOption[]>(FALLBACK_METHODS);

  activeItems = computed(() => this.items().filter(i => !i.savedForLater));

  canPay = computed(() => {
    const method = this.selectedMethod();
    return method !== null && !this.isProcessing() && this.itemCount() > 0 && this.agreedToTerms();
  });

  ngOnInit() {
    this.loadPaymentMethods();
  }

  private loadPaymentMethods() {
    this.methodsLoading.set(true);
    this.checkoutApi.getPaymentMethods().subscribe({
      next: (res: any) => {
        const data = res?.data ?? res;
        const methods = Array.isArray(data) ? data : [];
        const mapped: PaymentMethodOption[] = methods.map((m: PaymentMethodItem) => ({
          id: m.id as PaymentMethod,
          label: m.name || m.id,
          sub: m.badge || m.id,
          icon: (m.id === 'wallet' ? 'wallet' : m.id === 'stc_pay' ? 'stc' : m.id === 'apple_pay' ? 'apple' : 'card') as any,
          available: m.available,
          badge: m.badge,
          balance: m.balance,
        }));
        this.paymentMethods.set(mapped.length > 0 ? mapped : FALLBACK_METHODS);
        this.methodsLoading.set(false);
      },
      error: (err: any) => {
        console.error('[Payment] Failed to load payment methods:', err);
        this.paymentMethods.set(FALLBACK_METHODS);
        this.methodsLoading.set(false);
      },
    });
  }

  selectMethod(method: PaymentMethodOption) {
    if (!method.available) {
      this.showComingSoon.set(true);
      setTimeout(() => this.showComingSoon.set(false), 2500);
      return;
    }
    this.selectedMethod.set(method.id);
    this.errorMessage.set(null);
  }

  toggleTerms() {
    this.agreedToTerms.set(!this.agreedToTerms());
  }

  payNow() {
    if (!this.canPay()) return;
    const method = this.selectedMethod();
    if (!method) return;

    this.isProcessing.set(true);
    this.errorMessage.set(null);

    if (!this.currentOrder()) {
      this.checkoutService.createOrder().subscribe({
        next: (orderResult) => {
          if (!orderResult.success) {
            this.errorMessage.set(orderResult.message);
            this.isProcessing.set(false);
            return;
          }
          this.proceedToPaymentStep(method);
        },
        error: () => {
          this.errorMessage.set('حدث خطأ، حاول مرة أخرى');
          this.isProcessing.set(false);
        },
      });
      return;
    }

    this.proceedToPaymentStep(method);
  }

  private proceedToPaymentStep(method: PaymentMethod) {
    this.checkoutService.initiatePayment(method).subscribe({
      next: (result) => {
        if (result.success) {
          this.router.navigate(['/checkout/confirm']);
        } else {
          this.errorMessage.set(result.message);
          this.isProcessing.set(false);
        }
      },
      error: () => {
        this.errorMessage.set('حدث خطأ، حاول مرة أخرى');
        this.isProcessing.set(false);
      },
    });
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  }

  walletAfterPay(balance?: number): string {
    if (!balance) return '—';
    return this.formatPrice(Math.max(0, balance - this.total()));
  }
}
