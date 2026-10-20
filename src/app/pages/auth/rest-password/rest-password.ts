import { OTP_DELIVERY_HINT } from '../../../core/forms/otp-delivery';
import { Component, DestroyRef, signal, ElementRef, OnDestroy, ChangeDetectorRef, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PhoneInputComponent } from '../../../sheards/phone-input/phone-input.component';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { mapHttpError } from '../../../core/forms/http-error';
import { WaitHandle, WaitTimerService, waitScope } from '../../../core/wait/wait-timer.service';
import { isRateLimitError } from '../../../core/utils/rate-limit.util';
import { attemptSubmit, InvalidField } from '../../../core/forms/form-helpers';
import { validationMessage } from '../../../core/forms/validation-messages';
import { matchFieldsValidator, strongPasswordValidator } from '../../../core/forms/password.validator';
import { backendBannerMessage, genericBanner } from '../../../shared/forms/submit-feedback';
import { FormSummaryComponent } from '../../../shared/forms/form-summary.component';

const RESET_LABELS: Record<string, string> = {
  email: 'البريد الإلكتروني',
  newPassword: 'كلمة المرور الجديدة',
  confirmPassword: 'تأكيد كلمة المرور',
};

@Component({
  selector: 'app-rest-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PhoneInputComponent, FormSummaryComponent],
  templateUrl: './rest-password.html',
  styleUrl: './rest-password.css',
  encapsulation: ViewEncapsulation.None,
})
export class RestPassword implements OnDestroy {
  readonly deliveryHint = OTP_DELIVERY_HINT;
  private authApi = inject(AuthApiService);
  private readonly host = inject(ElementRef<HTMLElement>);
  /** What is missing after a failed submit attempt (shown by <ws-form-summary>). */
  missingFields: InvalidField[] = [];

  currentStep = 1;
  // Phone-based recovery is disabled for now: SMS delivery isn't implemented on the backend.
  channel: 'email' | 'phone' = 'email';
  phoneChannelEnabled = false;

  recoveryForm: FormGroup;
  verificationForm: FormGroup;
  passwordForm: FormGroup;

  showNewPassword = false;
  showConfirmPassword = false;

  private readonly waits = inject(WaitTimerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly handles = new Map<string, WaitHandle>();
  /** True once the server told us when the current code stops being valid (no validity timer is shown otherwise). */
  private validityKnown = false;
  showOtpError = false;

  bannerError = '';
  bannerLock = false;
  isLoading = false;

  /** Email the reset code was requested for; carried across steps to the verify/reset calls. */
  private verifiedEmail = '';

  constructor(private fb: FormBuilder, private location: Location, private cdr: ChangeDetectorRef) {
    this.recoveryForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
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
      // Backend resetPasswordSchema: 8+ chars, an uppercase letter, a digit. (No "log out all devices" option:
      // the backend does not support it, so it is not offered.)
      newPassword: ['', [Validators.required, strongPasswordValidator]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: matchFieldsValidator('newPassword', 'confirmPassword') });
    // Typing the e-mail on step 1 re-binds the send button to THAT e-mail's stored wait (a refresh must not bypass the server's block).
    this.recoveryForm.get('email')!.valueChanges.pipe(takeUntilDestroyed()).subscribe(v => { if (this.currentStep === 1) this.waitEmail.set(String(v || '')); });
  }

  ngOnDestroy() {
    // Handles release their share of the central clock with the component's DestroyRef; the stored end timestamps stay for a return visit.
  }

  private handle(action: string, email: string): WaitHandle {
    const scope = waitScope(action, email);
    let h = this.handles.get(scope);
    if (!h) { h = this.waits.track(scope, this.destroyRef); this.handles.set(scope, h); }
    return h;
  }

  /** Next code may be requested (server: resendAvailableAt / Retry-After) for the typed (step 1) or verified (step 2) e-mail. Disables only the send / resend button. */
  get sendWait(): WaitHandle { return this.handle('reset-otp-send', this.waitEmail()); }

  /** The reset code's validity (server: expiresAt). A different thing from the resend wait. */
  get validityWait(): WaitHandle { return this.handle('reset-otp-valid', this.verifiedEmail); }

  /** The e-mail the send / resend wait is keyed by (typed on step 1, verified on step 2). A signal so the buttons re-render when it changes. */
  private readonly waitEmail = signal('');

  get codeExpired(): boolean { return this.validityKnown && !this.validityWait.active(); }

  /** Starts the resend wait and the validity timer from what the server answered; nothing is started when it gave no time. */
  private applySendResponse(res: any) {
    this.sendWait.startFromResponse({ resendAvailableAt: res?.resendAvailableAt });
    const exp = res?.expiresAt ? Date.parse(res.expiresAt) : NaN;
    if (Number.isFinite(exp)) { this.validityKnown = true; this.validityWait.start(exp); } else this.validityKnown = false;
  }

  /** Design step pill (P-AU-013 showStep): "الخطوة n من 3", then "تم" on success. */
  get stepPill(): string {
    return ['', 'الخطوة 1 من 3', 'الخطوة 2 من 3', 'الخطوة 3 من 3', 'تم'][this.currentStep] || '';
  }

  stepState(i: number): string {
    return i < this.currentStep ? 'step-done' : i === this.currentStep ? 'step-active' : 'step-idle';
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
    if (this.isLoading || (this.channel === 'email' && this.sendWait.active())) return;
    if (this.channel === 'email') {
      const attempt = attemptSubmit(this.recoveryForm, { root: this.host.nativeElement, labels: RESET_LABELS });
      if (!attempt.valid) {
        this.bannerError = '';
        this.cdr.markForCheck();
        return;
      }
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
      next: (res: any) => {
        this.isLoading = false;
        this.verifiedEmail = email;
        this.waitEmail.set(email);
        this.currentStep = 2;
        this.applySendResponse(res);
        this.cdr.markForCheck();
      },
      error: async (err) => {
        const mapped = mapHttpError(err, { unauthorizedIs: 'credentials', fallback: 'حدث خطأ أثناء إرسال رمز التحقق، حاول مرة أخرى' });
        // 400/422 about the e-mail -> under the field; network / 429 / 5xx stay one honest banner.
        if (isRateLimitError(err)) this.handle('reset-otp-send', email).startFromResponse(err);
        this.bannerError = genericBanner(mapped) ?? await backendBannerMessage(this.host.nativeElement, mapped, { resolve: { email: 'field-email' } });
        this.isLoading = false;
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

  resendOtp() {
    if (!this.verifiedEmail || this.isLoading || this.sendWait.active()) return;

    this.showOtpError = false;
    this.bannerError = '';
    this.isLoading = true;
    this.cdr.markForCheck();

    this.authApi.forgotPassword({ email: this.verifiedEmail }).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.verificationForm.reset();
        this.applySendResponse(res);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        const mapped = mapHttpError(err, { unauthorizedIs: 'credentials', fallback: 'حدث خطأ أثناء إعادة إرسال الرمز، حاول مرة أخرى' });
        this.bannerError = mapped.message;
        // Rate limited: keep resend locked until the end the server gave (Retry-After / retryAt); no stated wait = no timer.
        if (mapped.kind === 'rate-limit') this.sendWait.startFromResponse(err);
        this.cdr.markForCheck();
      }
    });
  }

  verifyOtp() {
    if (this.isLoading) return;
    if (this.verificationForm.invalid) {
      // Never a silent no-op: say what is needed and put the cursor on the first empty box.
      this.verificationForm.markAllAsTouched();
      this.showOtpError = true;
      this.bannerError = 'أدخل رمز التحقق المكوّن من 6 أرقام';
      this.focusOtpInput(this.otpIndexes.find(i => !this.otpDigit(i)) ?? 0);
      this.cdr.markForCheck();
      return;
    }

    const code = this.getOtpCode();
    this.showOtpError = false;
    this.bannerError = '';
    this.isLoading = true;
    this.cdr.markForCheck();

    this.authApi.verifyResetCode({ email: this.verifiedEmail, code }).subscribe({
      next: () => {
        this.isLoading = false;
        this.currentStep = 3;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.showOtpError = true;
        this.bannerError = mapHttpError(err, { unauthorizedIs: 'credentials', fallback: 'رمز التحقق غير صحيح أو منتهي الصلاحية' }).message;
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
    this.waitEmail.set(step === 1 ? String(this.recoveryForm.value.email || '') : this.verifiedEmail);
  }

  toggleNewPassword() {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  /** Arabic message for a field of the new-password form (shown once touched, or after a submit attempt). */
  fieldError(form: FormGroup, name: string): string | null {
    const c = form.get(name);
    return c && (c.touched || c.dirty) && c.invalid ? validationMessage(c.errors, RESET_LABELS[name]) : null;
  }

  /** Cross-field message (password confirmation). */
  get confirmMismatchError(): string | null {
    const touched = this.passwordForm.get('confirmPassword')?.touched || this.passwordForm.touched;
    return touched && this.passwordForm.hasError('mismatch') ? 'كلمة المرور وتأكيدها غير متطابقتين' : null;
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
    if (this.isLoading) return;
    this.bannerError = '';
    const attempt = attemptSubmit(this.passwordForm, { root: this.host.nativeElement, labels: RESET_LABELS });
    this.missingFields = attempt.missing;
    if (!attempt.valid) {
      this.cdr.markForCheck();
      return;
    }

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
      error: async (err) => {
        const mapped = mapHttpError(err, { unauthorizedIs: 'credentials', fallback: 'حدث خطأ أثناء تغيير كلمة المرور، حاول مرة أخرى' });
        // 400/422 about the password -> under the field; network / 429 / 5xx stay one honest banner.
        this.bannerError = genericBanner(mapped) ?? await backendBannerMessage(this.host.nativeElement, mapped, { resolve: { newPassword: 'new-password', password: 'new-password' } });
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }
}
