import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Step {
  num: number;
  label: string;
}

const STEPS: Step[] = [
  { num: 1, label: 'السلة' },
  { num: 2, label: 'مراجعة الطلب' },
  { num: 3, label: 'الدفع' },
  { num: 4, label: 'التأكيد' },
];

@Component({
  selector: 'app-checkout-stepper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './checkout-stepper.html',
  styleUrl: './checkout-stepper.css',
})
export class CheckoutStepper {
  @Input() step = 1;
  steps = STEPS;
}
