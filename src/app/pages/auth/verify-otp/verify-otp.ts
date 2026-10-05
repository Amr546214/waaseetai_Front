import { Component, inject, OnInit, OnDestroy, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../../core/store/auth.store';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { getDefaultDashboard } from '../../../core/guards/auth.guards';
import { mapHttpError } from '../../../core/forms/http-error';
import { resendNotice } from '../../../core/forms/otp-delivery';
import { OtpHandoffService } from '../../../core/services/otp-handoff.service';

@Component({
  selector: 'app-verify-otp',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './verify-otp.html',
  styleUrls: ['./verify-otp.css'],
  encapsulation: ViewEncapsulation.None,
})
export class VerifyOtp implements OnInit, OnDestroy {
  private authStore = inject(AuthStore);
  private authApi = inject(AuthApiService);
  private router = inject(Router);
  private otpHandoff = inject(OtpHandoffService);
  // Zoneless app: timer ticks and HTTP callbacks must request a render explicitly.
  private cdr = inject(ChangeDetectorRef);

  otpCtrl = new FormControl('', [Validators.required, Validators.minLength(6), Validators.maxLength(6), Validators.pattern('^[0-9]*$')]);
  
  isLoading = false;
  errorMsg = '';
  successMsg = '';

  // 0 until a code is really sent: the countdown means "a code was just sent, wait before asking for another".
  countdown = 0;
  private timer: any;

  ngOnInit() {
    if (!this.authStore.isPendingVerification()) {
      // If no pending user, redirect to login
      this.router.navigate(['/auth/login']);
      return;
    }
    
    // If they arrived with an active token, they were redirected from a 403.
    // They need a fresh OTP sent automatically.
    if (this.authStore.token()) {
      // Every send counts against the shared auth rate limit (10/hour per IP), so a refresh or a back/forward
      // visit must not fire a new code each time: send only if none was sent for this user in the last 90 s.
      const recent = this.recentAutoSendSeconds(this.authStore.pendingUserId());
      if (recent === null) {
        this.countdown = 0; // Bypass the guard
        this.resendOtp();
      } else {
        this.successMsg = 'أرسلنا لك رمز تحقق قبل قليل، استخدمه أو انتظر قبل طلب رمز جديد.';
        this.startCountdown(Math.max(1, 90 - recent));
      }
    } else {
      // Arrived from an unverified login: show what really happened. The resend countdown starts only when a
      // code was actually sent; otherwise (not sent / throttled / reload) resend stays available.
      const notice = this.otpHandoff.consume();
      if (notice?.sent) {
        this.successMsg = notice.message;
        this.startCountdown();
      } else if (notice) {
        this.errorMsg = notice.message;
      }
    }
  }

  ngOnDestroy() {
    this.clearTimer();
  }

  private static readonly AUTO_SEND_WINDOW_S = 90;

  /** Seconds since the last automatic send for this user in this tab, or null when none/expired. */
  private recentAutoSendSeconds(userId: string | null): number | null {
    if (!userId) return null;
    try {
      const at = Number(sessionStorage.getItem(`waseet_otp_autosend_${userId}`));
      const elapsed = at ? Math.floor((Date.now() - at) / 1000) : null;
      return elapsed !== null && elapsed >= 0 && elapsed < VerifyOtp.AUTO_SEND_WINDOW_S ? elapsed : null;
    } catch { return null; }
  }

  private markAutoSend(userId: string) {
    try { sessionStorage.setItem(`waseet_otp_autosend_${userId}`, String(Date.now())); } catch { /* storage unavailable */ }
  }

  private startCountdown(seconds = 60) {
    this.countdown = seconds;
    this.clearTimer();
    this.timer = setInterval(() => {
      if (this.countdown > 0) {
        this.countdown--;
      } else {
        this.clearTimer();
      }
      this.cdr.markForCheck();
    }, 1000);
  }

  private clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async verify() {
    if (this.otpCtrl.invalid) {
      // Never a silent no-op: say what is needed and put the cursor on the first empty box.
      this.otpCtrl.markAsTouched();
      this.errorMsg = 'الرجاء إدخال رمز التحقق المكون من 6 أرقام';
      this.focusOtpInput(this.otpIndexes.find(i => !this.otpDigit(i)) ?? 0);
      this.cdr.markForCheck();
      return;
    }

    const userId = this.authStore.pendingUserId();
    if (!userId) {
      this.errorMsg = 'انتهت جلسة التفعيل. سجّل الدخول مرة أخرى لإكمال تفعيل حسابك.';
      this.cdr.markForCheck();
      return;
    }

    this.isLoading = true;
    this.errorMsg = '';

    this.authApi.verifyOtp({ userId, code: this.otpCtrl.value! }).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          // AuthStore takes care of authentication and state updates via its API service tap().
          // Continue to the user's own dashboard.
          const user = res.data?.user || this.authStore.currentUser();
          this.router.navigateByUrl(getDefaultDashboard(user?.accountType, user?.activeRole));
        } else {
          this.errorMsg = res.message || 'حدث خطأ أثناء التحقق';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMsg = mapHttpError(err, { unauthorizedIs: 'credentials', fallback: 'فشل التحقق، يرجى المحاولة مرة أخرى' }).message;
        this.cdr.markForCheck();
      }
    });
  }

  // Six design OTP boxes (P-AU-009) feeding the single otpCtrl: digits only,
  // Arabic/Persian digits normalized, full-code paste, Backspace walks back, Enter submits.
  readonly otpIndexes = [0, 1, 2, 3, 4, 5];

  get formattedCountdown(): string {
    const m = Math.floor(this.countdown / 60);
    const s = this.countdown % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }

  otpDigit(index: number): string {
    return this.otpDigitsBuf[index] ?? '';
  }

  private setDigits(digits: string[]) {
    // The control only becomes valid (6 digits) once every box is filled.
    this.otpDigitsBuf = digits;
    this.otpCtrl.setValue(digits.join(''));
  }

  private otpDigitsBuf: string[] = ['', '', '', '', '', ''];

  onOtpInput(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = this.normalizeDigits(input.value);
    if (raw.length > 1) { this.fillOtpFrom(raw); return; }
    const digits = this.currentDigits();
    digits[index] = raw;
    input.value = raw;
    this.setDigits(digits);
    this.errorMsg = '';
    if (raw && index < 5) this.focusOtpInput(index + 1);
  }

  onOtpKeydown(index: number, event: KeyboardEvent) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const digits = this.currentDigits();
      if (digits[index]) {
        digits[index] = '';
      } else if (index > 0) {
        digits[index - 1] = '';
        this.focusOtpInput(index - 1);
      }
      this.setDigits(digits);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.verify();
    }
  }

  onOtpPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pasted = this.normalizeDigits(event.clipboardData?.getData('text') || '');
    if (pasted) this.fillOtpFrom(pasted);
  }

  private currentDigits(): string[] {
    return this.otpIndexes.map(i => this.otpDigitsBuf[i] || '');
  }

  private fillOtpFrom(value: string) {
    const digits = value.slice(0, 6).split('');
    this.setDigits(this.otpIndexes.map(i => digits[i] ?? ''));
    this.errorMsg = '';
    this.focusOtpInput(Math.min(digits.length, 6) - 1);
  }

  private focusOtpInput(index: number) {
    const el = document.getElementById(`otp-${index}`) as HTMLInputElement | null;
    el?.focus();
    el?.select();
  }

  /** Converts Arabic/Persian digits to English and strips everything that isn't 0-9. */
  private normalizeDigits(value: string): string {
    const arabic = '٠١٢٣٤٥٦٧٨٩';
    const persian = '۰۱۲۳۴۵۶۷۸۹';
    return value.split('').map(c => {
      const a = arabic.indexOf(c); if (a !== -1) return String(a);
      const p = persian.indexOf(c); if (p !== -1) return String(p);
      return c;
    }).join('').replace(/[^0-9]/g, '');
  }

  resendOtp() {
    if (this.countdown > 0) return;

    const userId = this.authStore.pendingUserId();
    if (!userId) {
      this.errorMsg = 'انتهت جلسة التفعيل. سجّل الدخول مرة أخرى لإكمال تفعيل حسابك.';
      this.cdr.markForCheck();
      return;
    }

    this.errorMsg = '';
    this.successMsg = '';
    this.isLoading = true;

    this.authApi.resendOtp(userId).subscribe({
      next: (res) => {
        this.isLoading = false;
        const notice = resendNotice(res);
        if (notice.sent) {
          this.successMsg = notice.message;
          this.markAutoSend(userId);
          this.startCountdown();
        } else {
          // Nothing went out: say so, no countdown, the button stays usable.
          this.errorMsg = notice.message;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        const mapped = mapHttpError(err, { unauthorizedIs: 'credentials', fallback: 'فشل إعادة الإرسال، يرجى المحاولة مرة أخرى' });
        this.errorMsg = mapped.message;
        // Rate limited: keep resend locked for the time the server asked, instead of letting the user hammer it.
        if (mapped.kind === 'rate-limit' && mapped.retryAfterSeconds) this.startCountdown(mapped.retryAfterSeconds);
        this.cdr.markForCheck();
      }
    });
  }
}
