import { Component, inject, computed, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CheckoutService } from '../../../../core/services/checkout.service';
import { formatMoney } from '../../../../core/utils/money.util';

@Component({
  selector: 'app-checkout-failure',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './failure.html',
  styleUrls: ['../components/checkout-tokens.css', './failure.css'],
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


  formatPrice(value: number): string {
    return formatMoney(value, 0);
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
