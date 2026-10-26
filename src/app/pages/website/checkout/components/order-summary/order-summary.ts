import { Component, Input, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CartService } from '../../../../../core/services/cart.service';
import { formatAmount } from '../../../../../core/utils/currency';

@Component({
  selector: 'app-order-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-summary.html',
  styleUrl: './order-summary.css',
})
export class OrderSummary {
  @Input() compact = false;

  private cartService = inject(CartService);

  items = this.cartService.items;
  coupon = this.cartService.coupon;
  itemCount = this.cartService.itemCount;
  subtotal = this.cartService.subtotal;
  discount = this.cartService.discount;
  total = this.cartService.total;

  /** the order's / cart's own currency (a missing one reads as USD, legacy) */
  currency = computed(() => this.items().find(i => !i.savedForLater)?.currency);

  formatPrice(value: number, currency?: string): string {
    return formatAmount(value, currency ?? this.currency());
  }
}
