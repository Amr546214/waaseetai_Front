import { Component, inject, signal, computed, OnDestroy, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CheckoutStepper } from '../components/checkout-stepper/checkout-stepper';
import { OrderSummary } from '../components/order-summary/order-summary';
import { CartService } from '../../../../core/services/cart.service';
import { CheckoutService } from '../../../../core/services/checkout.service';

@Component({
  selector: 'app-checkout-confirm',
  standalone: true,
  imports: [CommonModule, CheckoutStepper, OrderSummary, RouterLink],
  templateUrl: './confirm.html',
  styleUrl: './confirm.css',
})
export class CheckoutConfirmComponent implements OnDestroy {
  step = 4;

  @ViewChildren('otpInput') otpInputRefs!: QueryList<ElementRef<HTMLInputElement>>;

  private cartService = inject(CartService);
  private checkoutService = inject(CheckoutService);
  private router = inject(Router);

  itemCount = this.cartService.itemCount;
  total = this.cartService.total;
  currentOrder = this.checkoutService.currentOrder;
  maskedPhone = this.checkoutService.maskedPhone;
  paymentReference = this.checkoutService.paymentReference;
  serviceError = this.checkoutService.error;

  otpDigits = signal<string[]>(['', '', '', '', '', '']);
  isProcessing = signal(false);
  errorMessage = signal<string | null>(null);
  resendMessage = signal<string | null>(null);
  countdown = signal(0);

  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  otpValue = computed(() => this.otpDigits().join(''));
  isOtpComplete = computed(() => this.otpValue().length === 6);
  canConfirm = computed(() => this.isOtpComplete() && !this.isProcessing());
  hasActivePayment = computed(() => {
    return !!this.currentOrder() && !!this.paymentReference();
  });

  displayPhone = computed(() => {
    const phone = this.maskedPhone();
    return phone || 'رقمك المسجل';
  });

  onOtpInput(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = this.normalizeDigits(input.value);

    if (raw.length > 1) {
      const pasted = raw.slice(0, 6).split('');
      const digits = ['', '', '', '', '', ''];
      for (let i = 0; i < 6; i++) {
        digits[i] = pasted[i] || '';
      }
      this.otpDigits.set(digits);
      const lastFilled = Math.min(pasted.length - 1, 5);
      this.focusInput(lastFilled);
      this.errorMessage.set(null);
      return;
    }

    const digits = [...this.otpDigits()];
    digits[index] = raw;
    this.otpDigits.set(digits);
    input.value = raw;

    if (raw && index < 5) {
      this.focusInput(index + 1);
    }
    this.errorMessage.set(null);
  }

  onOtpKeydown(index: number, event: KeyboardEvent) {
    if (event.key === 'Backspace') {
      const digits = [...this.otpDigits()];
      if (digits[index]) {
        digits[index] = '';
        this.otpDigits.set(digits);
        event.preventDefault();
      } else if (index > 0) {
        digits[index - 1] = '';
        this.otpDigits.set(digits);
        this.focusInput(index - 1);
        event.preventDefault();
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.canConfirm()) {
        this.confirmPayment();
      }
    }
  }

  onOtpPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pasted = this.normalizeDigits(event.clipboardData?.getData('text') || '').slice(0, 6);
    if (pasted.length > 0) {
      const digits = ['', '', '', '', '', ''];
      for (let i = 0; i < pasted.length && i < 6; i++) {
        digits[i] = pasted[i];
      }
      this.otpDigits.set(digits);
      const focusIndex = Math.min(pasted.length - 1, 5);
      this.focusInput(focusIndex);
      this.errorMessage.set(null);
    }
  }

  private focusInput(index: number) {
    const inputs = this.otpInputRefs?.toArray();
    if (inputs && inputs[index]) {
      inputs[index].nativeElement.focus();
      inputs[index].nativeElement.select();
    }
  }

  confirmPayment() {
    if (!this.canConfirm()) return;
    const otp = this.normalizeDigits(this.otpValue());
    this.isProcessing.set(true);
    this.errorMessage.set(null);

    const result = this.checkoutService.confirmPayment(otp);
    if (result.success) {
      this.router.navigate(['/checkout/success'], { replaceUrl: true });
    } else {
      this.errorMessage.set(result.message);
      this.isProcessing.set(false);
    }
  }

  resendOtp() {
    this.resendMessage.set(null);
    const result = this.checkoutService.resendOtp();
    if (result.success) {
      this.resendMessage.set(result.message);
      this.startCountdown();
      this.otpDigits.set(['', '', '', '', '', '']);
      this.errorMessage.set(null);
      this.focusInput(0);
      setTimeout(() => this.resendMessage.set(null), 3000);
    } else {
      this.errorMessage.set(result.message);
    }
  }

  private startCountdown() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.countdown.set(120);
    this.countdownInterval = setInterval(() => {
      const current = this.countdown();
      if (current <= 1) {
        this.countdown.set(0);
        if (this.countdownInterval) {
          clearInterval(this.countdownInterval);
          this.countdownInterval = null;
        }
      } else {
        this.countdown.set(current - 1);
      }
    }, 1000);
  }

  countdownDisplay = computed(() => {
    const seconds = this.countdown();
    if (seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  });

  canResend = computed(() => this.countdown() === 0);

  formatPrice(value: number): string {
    return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  }

  private normalizeDigits(value: string): string {
    const arabic = '٠١٢٣٤٥٦٧٨٩';
    const persian = '۰۱۲۳۴۵۶۷۸۹';

    return value
      .split('')
      .map(char => {
        const arabicIndex = arabic.indexOf(char);
        if (arabicIndex !== -1) return String(arabicIndex);

        const persianIndex = persian.indexOf(char);
        if (persianIndex !== -1) return String(persianIndex);

        return char;
      })
      .join('')
      .replace(/\D/g, '');
  }

  ngOnDestroy() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }
}
