import { Component } from '@angular/core';
import { CheckoutStepper } from '../components/checkout-stepper/checkout-stepper';
import { OrderSummary } from '../components/order-summary/order-summary';

@Component({
  selector: 'app-checkout-payment',
  standalone: true,
  imports: [CheckoutStepper, OrderSummary],
  templateUrl: './payment.html',
  styleUrl: './payment.css',
})
export class CheckoutPaymentComponent {
  step = 3;
}
