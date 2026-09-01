import { Component } from '@angular/core';
import { CheckoutStepper } from '../components/checkout-stepper/checkout-stepper';
import { OrderSummary } from '../components/order-summary/order-summary';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CheckoutStepper, OrderSummary],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
})
export class CartComponent {
  step = 1;
}
