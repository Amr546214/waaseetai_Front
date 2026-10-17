import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CartService } from '../../../../../core/services/cart.service';
import { formatMoney } from '../../../../../core/utils/money.util';

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

  formatPrice(value: number): string {
    return formatMoney(value, 0);
  }
}
