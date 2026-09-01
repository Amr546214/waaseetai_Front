import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CheckoutService } from '../../../../core/services/checkout.service';

@Component({
  selector: 'app-checkout-failure',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './failure.html',
  styleUrl: './failure.css',
})
export class CheckoutFailureComponent {
  private checkoutService = inject(CheckoutService);

  currentOrder = this.checkoutService.currentOrder;
  errorMessage = this.checkoutService.error;

  hasOrder = computed(() => !!this.currentOrder());
  hasError = computed(() => !!this.errorMessage());
  orderNumber = computed(() => this.currentOrder()?.orderNumber || '');
  orderTotal = computed(() => this.currentOrder()?.total || 0);

  helpItems = [
    'لم يتم خصم أي مبلغ إذا لم تكتمل العملية',
    'يمكنك إعادة المحاولة أو اختيار طريقة دفع أخرى',
    'إذا استمرت المشكلة تواصل مع الدعم',
  ];

  formatPrice(value: number): string {
    return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  }
}
