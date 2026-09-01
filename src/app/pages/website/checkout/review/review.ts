import { Component } from '@angular/core';
import { CheckoutStepper } from '../components/checkout-stepper/checkout-stepper';
import { OrderSummary } from '../components/order-summary/order-summary';

@Component({
  selector: 'app-checkout-review',
  standalone: true,
  imports: [CheckoutStepper, OrderSummary],
  templateUrl: './review.html',
  styleUrl: './review.css',
})
export class CheckoutReviewComponent {
  step = 2;
}
