import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CheckoutStepper } from '../components/checkout-stepper/checkout-stepper';
import { OrderSummary } from '../components/order-summary/order-summary';
import { CartService } from '../../../../core/services/cart.service';
import { CheckoutService } from '../../../../core/services/checkout.service';
import { PaymentMethod } from '../../../../core/models/checkout.model';

interface PaymentMethodOption {
  id: PaymentMethod;
  label: string;
  icon: string;
  available: boolean;
  badge?: string;
}

@Component({
  selector: 'app-checkout-payment',
  standalone: true,
  imports: [CommonModule, CheckoutStepper, OrderSummary, RouterLink],
  templateUrl: './payment.html',
  styleUrl: './payment.css',
})
export class CheckoutPaymentComponent {
  step = 3;

  private cartService = inject(CartService);
  private checkoutService = inject(CheckoutService);
  private router = inject(Router);

  itemCount = this.cartService.itemCount;
  total = this.cartService.total;
  currentOrder = this.checkoutService.currentOrder;

  selectedMethod = signal<PaymentMethod | null>(null);
  isProcessing = signal(false);
  errorMessage = signal<string | null>(null);
  showComingSoon = signal(false);

  paymentMethods: PaymentMethodOption[] = [
    {
      id: 'card',
      label: 'بطاقة بنكية',
      icon: 'card',
      available: true,
    },
    {
      id: 'wallet',
      label: 'المحفظة',
      icon: 'wallet',
      available: true,
    },
    {
      id: 'stc_pay',
      label: 'STC Pay',
      icon: 'stc',
      available: false,
      badge: 'قريباً',
    },
    {
      id: 'apple_pay',
      label: 'Apple Pay',
      icon: 'apple',
      available: false,
      badge: 'قريباً',
    },
  ];

  canPay = computed(() => {
    const method = this.selectedMethod();
    return method !== null && !this.isProcessing() && this.itemCount() > 0;
  });

  selectMethod(method: PaymentMethodOption) {
    if (!method.available) {
      this.showComingSoon.set(true);
      setTimeout(() => this.showComingSoon.set(false), 2500);
      return;
    }
    this.selectedMethod.set(method.id);
    this.errorMessage.set(null);
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
    const result = this.checkoutService.initiatePayment(method);
    if (result.success) {
      this.router.navigate(['/checkout/confirm']);
    } else {
      this.errorMessage.set(result.message);
      this.isProcessing.set(false);
    }
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  }
}
