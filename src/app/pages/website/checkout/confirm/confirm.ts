import { Component, inject, signal, computed, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../../../core/services/cart.service';
import { CheckoutService } from '../../../../core/services/checkout.service';
import { formatAmount } from '../../../../core/utils/currency';
import { WaitTimerService, waitScope } from '../../../../core/wait/wait-timer.service';
import { RATE_LIMIT_MESSAGE } from '../../../../core/utils/rate-limit.util';
import { rateLimitSentence } from '../../../../core/wait/wait-format';

@Component({
  selector: 'app-checkout-confirm',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './confirm.html',
  styleUrls: ['../components/checkout-tokens.css', './confirm.css'],
})
export class CheckoutConfirmComponent {
  step = 4;

  @ViewChildren('otpInput') otpInputRefs!: QueryList<ElementRef<HTMLInputElement>>;

  private cartService = inject(CartService);
  private checkoutService = inject(CheckoutService);
  private router = inject(Router);

  items = this.cartService.items;
  itemCount = this.cartService.itemCount;
  total = this.cartService.total;
  currentOrder = this.checkoutService.currentOrder;
  maskedPhone = this.checkoutService.maskedPhone;
  paymentReference = this.checkoutService.paymentReference;
  serviceError = this.checkoutService.error;

  activeItems = computed(() => this.items().filter(i => !i.savedForLater));
  serviceNames = computed(() => this.activeItems().map(i => i.title).join(' + '));

  otpDigits = signal<string[]>(['', '', '', '', '', '']);
  isProcessing = signal(false);
  errorMessage = signal<string | null>(null);
  resendMessage = signal<string | null>(null);
  /** Shown right under the code boxes when the user presses confirm before all 6 digits are in. */
  otpError = signal<string | null>(null);

  // Three DIFFERENT timers, each from the server (never a number written here):
  //  - validity: when the code stops being valid (expiresAt of the payment OTP); informational, it does not block resend.
  //  - resend: only when the server answered a resend with 429 (there is no fixed resend gate); disables ONLY the resend button.
  //  - confirm: only when the server answered the confirmation with 429 and a wait; disables ONLY the confirm button.
  // End timestamps live in WaitTimerService (survive a refresh / background tab); reaching zero never sends or confirms anything.
  private readonly waits = inject(WaitTimerService);
  private readonly orderKey = this.checkoutService.currentOrder()?.id ?? '';
  readonly validityWait = this.waits.track(waitScope('checkout-otp-valid', this.orderKey));
  readonly resendWait = this.waits.track(waitScope('checkout-otp-resend', this.orderKey));
  readonly confirmWait = this.waits.track(waitScope('checkout-otp-confirm', this.orderKey));
  private readonly rateLimitedNoTime = signal(false);
  /** True once a code with a known expiry ran out. */
  private readonly validityKnown = signal(false);
  codeExpired = computed(() => this.validityKnown() && !this.validityWait.active());
  rateLimitText = computed(() => {
    const w = this.confirmWait.active() ? this.confirmWait : this.resendWait.active() ? this.resendWait : null;
    return w ? rateLimitSentence(w.remainingSeconds(), true) : this.rateLimitedNoTime() ? RATE_LIMIT_MESSAGE : null;
  });

  constructor() {
    const exp = this.checkoutService.otpExpiresAt();
    if (exp != null) { this.validityKnown.set(true); this.validityWait.start(exp); }
  }

  otpValue = computed(() => this.otpDigits().join(''));
  isOtpComplete = computed(() => this.otpValue().length === 6);
  canConfirm = computed(() => this.isOtpComplete() && !this.isProcessing());
  hasActivePayment = computed(() => {
    return !!this.currentOrder() && !!this.paymentReference();
  });

  displayPhone = computed(() => {
    const contact = this.maskedPhone();
    return contact || 'بريدك الإلكتروني';
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
      this.otpError.set(null);
      return;
    }

    const digits = [...this.otpDigits()];
    digits[index] = raw;
    this.otpDigits.set(digits);
    input.value = raw;
    this.otpError.set(null);

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
      this.confirmPayment();
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
      this.otpError.set(null);
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
    if (this.isProcessing() || this.confirmWait.active()) return;
    if (!this.isOtpComplete()) {
      // Never a silent no-op: say what is needed, next to the boxes, and put the cursor on the first empty one.
      this.otpError.set('أدخل رمز التحقق المكوّن من 6 أرقام');
      this.focusInput(Math.max(0, this.otpDigits().findIndex(d => !d)));
      return;
    }
    const otp = this.normalizeDigits(this.otpValue());
    this.isProcessing.set(true);
    this.errorMessage.set(null);
    this.rateLimitedNoTime.set(false);

    this.checkoutService.confirmPayment(otp).subscribe({
      next: (result) => {
        if (result.success) {
          const orderId = result.data?.orderId || this.currentOrder()?.id || '';
          this.router.navigate(['/checkout/success'], {
            replaceUrl: true,
            queryParams: orderId ? { orderId } : {},
          });
        } else {
          if (result.errorKind === 'RATE_LIMITED') this.applyRateLimit(this.confirmWait, result.retryEndsAt); else this.errorMessage.set(result.message);
          this.isProcessing.set(false);
        }
      },
      error: () => {
        this.errorMessage.set('حدث خطأ، حاول مرة أخرى');
        this.isProcessing.set(false);
      },
    });
  }

  /** A 429 keeps the typed digits and the order; it waits for the server's time (or says honestly that none was given). */
  private applyRateLimit(handle: typeof this.confirmWait, endsAt: number | undefined) {
    this.errorMessage.set(null);
    if (endsAt != null) { handle.start(endsAt); this.rateLimitedNoTime.set(!handle.active()); } else this.rateLimitedNoTime.set(true);
  }

  resendOtp() {
    if (this.resendWait.active()) return;
    this.resendMessage.set(null);
    this.rateLimitedNoTime.set(false);
    this.checkoutService.resendOtp().subscribe({
      next: (result) => {
        if (result.success) {
          this.resendMessage.set(result.message);
          // the NEW code's validity, from the server's expiresAt; no expiry from the server = no timer
          const exp = this.checkoutService.otpExpiresAt();
          this.validityKnown.set(exp != null);
          if (exp != null) this.validityWait.start(exp); else this.validityWait.clear();
          this.otpDigits.set(['', '', '', '', '', '']);
          this.errorMessage.set(null);
          this.focusInput(0);
          setTimeout(() => this.resendMessage.set(null), 3000);
        } else if (result.errorKind === 'RATE_LIMITED') {
          this.applyRateLimit(this.resendWait, result.retryEndsAt);
        } else {
          this.errorMessage.set(result.message);
        }
      },
      error: () => {
        this.errorMessage.set('حدث خطأ، حاول مرة أخرى');
      },
    });
  }

  countdownDisplay = computed(() => this.validityWait.clock());

  canResend = computed(() => !this.resendWait.active());

  /** the order's / cart's own currency (a missing one reads as USD, legacy) */
  currency = computed(() => this.currentOrder()?.currency ?? this.activeItems()[0]?.currency);

  formatPrice(value: number, currency?: string): string {
    return formatAmount(value, currency ?? this.currency());
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
}
