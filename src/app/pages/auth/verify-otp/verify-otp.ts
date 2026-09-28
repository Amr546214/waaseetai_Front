import { Component, inject, OnInit, OnDestroy, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../../core/store/auth.store';
import { AuthApiService } from '../../../core/services/auth-api.service';

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
  // Zoneless app: timer ticks and HTTP callbacks must request a render explicitly.
  private cdr = inject(ChangeDetectorRef);

  otpCtrl = new FormControl('', [Validators.required, Validators.minLength(6), Validators.maxLength(6), Validators.pattern('^[0-9]*$')]);
  
  isLoading = false;
  errorMsg = '';
  successMsg = '';

  countdown = 60;
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
      this.countdown = 0; // Bypass the guard
      this.resendOtp();
    } else {
      // Fresh registration flow
      this.startCountdown();
    }
  }

  ngOnDestroy() {
    this.clearTimer();
  }

  private startCountdown() {
    this.countdown = 60;
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
      this.errorMsg = 'الرجاء إدخال رمز التحقق المكون من 6 أرقام';
      return;
    }
    
    const userId = this.authStore.pendingUserId();
    if (!userId) return;

    this.isLoading = true;
    this.errorMsg = '';

    this.authApi.verifyOtp({ userId, code: this.otpCtrl.value! }).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          // AuthStore takes care of authentication and state updates via its API service tap().
          // We redirect to dashboard
          this.router.navigate(['/']);
        } else {
          this.errorMsg = res.message || 'حدث خطأ أثناء التحقق';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMsg = err.error?.message || 'فشل التحقق، يرجى المحاولة مرة أخرى';
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
    if (!userId) return;

    this.errorMsg = '';
    this.successMsg = '';
    this.isLoading = true;

    this.authApi.resendOtp(userId).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.successMsg = 'تم إرسال الرمز بنجاح';
          this.startCountdown();
        } else {
          this.errorMsg = res.message || 'حدث خطأ أثناء إعادة الإرسال';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMsg = err.error?.message || 'فشل إعادة الإرسال، يرجى المحاولة مرة أخرى';
        this.cdr.markForCheck();
      }
    });
  }
}
