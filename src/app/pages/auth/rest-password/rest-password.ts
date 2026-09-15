import { Component, OnDestroy, ChangeDetectorRef, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PhoneInputComponent } from '../../../sheards/phone-input/phone-input.component';
import { AuthApiService } from '../../../core/services/auth-api.service';

@Component({
  selector: 'app-rest-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PhoneInputComponent],
  templateUrl: './rest-password.html',
  styleUrl: './rest-password.css',
  encapsulation: ViewEncapsulation.None,
})
export class RestPassword implements OnDestroy {
  private authApi = inject(AuthApiService);

  currentStep = 1;
  // Phone-based recovery is disabled for now: SMS delivery isn't implemented on the backend.
  channel: 'email' | 'phone' = 'email';
  phoneChannelEnabled = false;

  recoveryForm: FormGroup;
  verificationForm: FormGroup;
  passwordForm: FormGroup;

  showNewPassword = false;
  showConfirmPassword = false;

  otpSeconds = 90;
  otpTimerInterval: any;
  showOtpError = false;

  bannerError = '';
  bannerLock = false;
  isLoading = false;

  /** Email the reset code was requested for; carried across steps to the verify/reset calls. */
  private verifiedEmail = '';

  constructor(private fb: FormBuilder, private location: Location, private cdr: ChangeDetectorRef) {
    this.recoveryForm = this.fb.group({
      email: ['', [Validators.email]],
      phone: ['', [Validators.minLength(9), Validators.maxLength(9), Validators.pattern('^[0-9]*$')]]
    });

    this.verificationForm = this.fb.group({
      code1: ['', [Validators.required, Validators.pattern('^[0-9]$')]],
      code2: ['', [Validators.required, Validators.pattern('^[0-9]$')]],
      code3: ['', [Validators.required, Validators.pattern('^[0-9]$')]],
      code4: ['', [Validators.required, Validators.pattern('^[0-9]$')]],
      code5: ['', [Validators.required, Validators.pattern('^[0-9]$')]],
      code6: ['', [Validators.required, Validators.pattern('^[0-9]$')]]
    });

    this.passwordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      logoutAll: [true]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnDestroy() {
    this.clearTimer();
  }

  goBack() {
    this.location.back();
  }

  setChannel(ch: 'email' | 'phone') {
    if (ch === 'phone' && !this.phoneChannelEnabled) return;
    this.channel = ch;
    this.bannerError = '';
    this.cdr.markForCheck();
  }

  sendOtp() {
    if (this.channel === 'email' && (!this.recoveryForm.value.email || this.recoveryForm.get('email')?.invalid)) {
      this.bannerError = 'ادخل بريدا إلكترونيا صحيحا';
      this.cdr.markForCheck();
      return;
    }
    if (this.channel === 'phone') {
      // Phone recovery isn't wired to a backend yet; the option is hidden, this is a guard.
      this.bannerError = 'استرجاع كلمة المرور عبر الجوال غير متاح حاليا';
      this.cdr.markForCheck();
      return;
    }

    const email = this.recoveryForm.value.email;
    this.bannerError = '';
    this.isLoading = true;
    this.cdr.markForCheck();

    this.authApi.forgotPassword({ email }).subscribe({
      next: () => {
        this.isLoading = false;
        this.verifiedEmail = email;
        this.currentStep = 2;
        this.startTimer();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.bannerError = err.error?.message || 'حدث خطأ أثناء إرسال رمز التحقق، حاول مرة أخرى';
        this.cdr.markForCheck();
      }
    });
  }

  get maskedValue() {
    if (this.channel === 'email') {
      const email = this.recoveryForm.value.email;
      if (!email) return '';
      const [name, domain] = email.split('@');
      return `${name[0]}***@${domain}`;
    } else {
      const phone = this.recoveryForm.value.phone;
      if (!phone) return '';
      return `+966 5X XXX ${phone.slice(-4)}`;
    }
  }

  // OTP boxes mirror the checkout confirm page: digits only, Arabic/Persian digits
  // normalized to English, full-code paste from any box, Enter submits.
  readonly otpIndexes = [0, 1, 2, 3, 4, 5];

  otpDigit(index: number): string {
    return this.verificationForm.get(`code${index + 1}`)?.value ?? '';
  }

  onOtpInput(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = this.normalizeDigits(input.value);

    if (raw.length > 1) {
      this.fillOtpFrom(raw);
      return;
    }

    this.verificationForm.get(`code${index + 1}`)?.setValue(raw);
    input.value = raw;
    this.clearOtpError();

    if (raw && index < 5) {
      this.focusOtpInput(index + 1);
    }
    this.cdr.markForCheck();
  }

  onOtpKeydown(index: number, event: KeyboardEvent) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (this.otpDigit(index)) {
        this.verificationForm.get(`code${index + 1}`)?.setValue('');
      } else if (index > 0) {
        this.verificationForm.get(`code${index}`)?.setValue('');
        this.focusOtpInput(index - 1);
      }
      this.cdr.markForCheck();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.verifyOtp();
    }
  }

  onOtpPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pasted = this.normalizeDigits(event.clipboardData?.getData('text') || '');
    if (pasted) {
      this.fillOtpFrom(pasted);
    }
  }

  private fillOtpFrom(value: string) {
    const digits = value.slice(0, 6).split('');
    this.otpIndexes.forEach(i => this.verificationForm.get(`code${i + 1}`)?.setValue(digits[i] ?? ''));
    this.clearOtpError();
    this.cdr.markForCheck();
    this.focusOtpInput(Math.min(digits.length, 6) - 1);
  }

  private focusOtpInput(index: number) {
    const el = document.getElementById(`otp-${index}`) as HTMLInputElement | null;
    el?.focus();
    el?.select();
  }

  private clearOtpError() {
    this.showOtpError = false;
    this.bannerError = '';
  }

  /** Converts Arabic/Persian digits to English and strips everything that isn't 0-9. */
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
      .replace(/[^0-9]/g, '');
  }

  startTimer() {
    this.clearTimer();
    this.otpSeconds = 90;
    this.otpTimerInterval = setInterval(() => {
      this.otpSeconds--;
      if (this.otpSeconds <= 0) {
        this.clearTimer();
      }
      this.cdr.markForCheck();
    }, 1000);
  }

  clearTimer() {
    if (this.otpTimerInterval) {
      clearInterval(this.otpTimerInterval);
    }
  }

  get formattedTimer() {
    const m = Math.floor(this.otpSeconds / 60);
    const s = this.otpSeconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }

  resendOtp() {
    if (!this.verifiedEmail || this.isLoading) return;

    this.showOtpError = false;
    this.bannerError = '';
    this.isLoading = true;
    this.cdr.markForCheck();

    this.authApi.forgotPassword({ email: this.verifiedEmail }).subscribe({
      next: () => {
        this.isLoading = false;
        this.verificationForm.reset();
        this.startTimer();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.bannerError = err.error?.message || 'حدث خطأ أثناء إعادة إرسال الرمز، حاول مرة أخرى';
        this.cdr.markForCheck();
      }
    });
  }

  verifyOtp() {
    if (!this.verificationForm.valid || this.isLoading) return;

    const code = this.getOtpCode();
    this.showOtpError = false;
    this.bannerError = '';
    this.isLoading = true;
    this.cdr.markForCheck();

    this.authApi.verifyResetCode({ email: this.verifiedEmail, code }).subscribe({
      next: () => {
        this.isLoading = false;
        this.currentStep = 3;
        this.clearTimer();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.showOtpError = true;
        this.bannerError = err.error?.message || 'رمز التحقق غير صحيح أو منتهي الصلاحية';
        this.cdr.markForCheck();
      }
    });
  }

  private getOtpCode(): string {
    const v = this.verificationForm.value;
    return `${v.code1}${v.code2}${v.code3}${v.code4}${v.code5}${v.code6}`;
  }

  backToStep(step: number) {
    this.currentStep = step;
    if (step === 2) {
      this.startTimer();
    } else {
      this.clearTimer();
    }
  }

  toggleNewPassword() {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('newPassword')?.value === g.get('confirmPassword')?.value
      ? null : { 'mismatch': true };
  }

  get passwordStrength() {
    const pw = this.passwordForm.get('newPassword')?.value || '';
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[a-zA-Z]/.test(pw)) score++;
    if (pw.length >= 12) score++;

    const labels = ['', 'ضعيفة', 'مقبولة', 'جيدة', 'قوية'];
    return { score: Math.min(4, score), label: labels[Math.min(4, score)] };
  }

  savePassword() {
    if (this.passwordForm.hasError('mismatch')) {
      this.bannerError = 'كلمة المرور غير متطابقة';
      this.cdr.markForCheck();
      return;
    }
    if (!this.passwordForm.valid || this.isLoading) return;

    const newPassword = this.passwordForm.value.newPassword;
    this.bannerError = '';
    this.isLoading = true;
    this.cdr.markForCheck();

    this.authApi.resetPassword({ email: this.verifiedEmail, code: this.getOtpCode(), newPassword }).subscribe({
      next: () => {
        this.isLoading = false;
        this.currentStep = 4;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.bannerError = err.error?.message || 'حدث خطأ أثناء تغيير كلمة المرور، حاول مرة أخرى';
        this.cdr.markForCheck();
      }
    });
  }
}
