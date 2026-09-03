import { Component, inject, computed, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CheckoutService } from '../../../../core/services/checkout.service';

@Component({
  selector: 'app-checkout-failure',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './failure.html',
  styleUrl: './failure.css',
})
export class CheckoutFailureComponent implements OnInit {
  private checkoutService = inject(CheckoutService);
  private router = inject(Router);
  private isRedirecting = false;

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

  ngOnInit(): void {
    history.replaceState({ checkoutFinal: true }, '', window.location.href);
    history.pushState({ checkoutFinal: true }, '', window.location.href);
  }

  @HostListener('window:popstate', ['$event'])
  onPopState(event: PopStateEvent): void {
    if (this.isRedirecting) return;
    this.isRedirecting = true;
    this.router.navigate(['/marketplace'], { replaceUrl: true });
  }
}
