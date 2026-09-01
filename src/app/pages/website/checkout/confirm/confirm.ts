import { Component } from '@angular/core';
import { CheckoutStepper } from '../components/checkout-stepper/checkout-stepper';

@Component({
  selector: 'app-checkout-confirm',
  standalone: true,
  imports: [CheckoutStepper],
  templateUrl: './confirm.html',
  styleUrl: './confirm.css',
})
export class CheckoutConfirmComponent {
  step = 4;
}
