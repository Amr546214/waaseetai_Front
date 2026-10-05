import { Component, ElementRef, OnDestroy, ChangeDetectorRef, DestroyRef, ViewEncapsulation, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { AuthResponse } from '../../../core/models/auth.model';
import { AuthStore } from '../../../core/store/auth.store';
import { SocialAuthService, GoogleSigninButtonModule } from '@abacritt/angularx-social-login';
import { getDefaultDashboard } from '../../../core/guards/auth.guards';
import { mapHttpError } from '../../../core/forms/http-error';
import { unverifiedLoginNotice } from '../../../core/forms/otp-delivery';
import { OtpHandoffService } from '../../../core/services/otp-handoff.service';
import { attemptSubmit, InvalidField } from '../../../core/forms/form-helpers';
import { validationMessage } from '../../../core/forms/validation-messages';
import { UiNotificationService } from '../../../core/services/ui-notification.service';
import { FormSummaryComponent } from '../../../shared/forms/form-summary.component';

const LOGIN_LABELS = { email: 'البريد الإلكتروني', password: 'كلمة المرور' };

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, GoogleSigninButtonModule, FormSummaryComponent],
  templateUrl: './login.html',
  styleUrl: './login.css',
  encapsulation: ViewEncapsulation.None,
})
export class Login implements OnDestroy {
  loginForm: FormGroup;
  otpForm: FormGroup;
  showPassword = false;

  errorMessage = '';
  /** What is missing after a failed submit attempt (shown by <ws-form-summary>). */
  missingFields: InvalidField[] = [];
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly notify = inject(UiNotificationService);
  private readonly otpHandoff = inject(OtpHandoffService);
  appleNotice = '';
  isSubmitting = false;
  // Set on a 404 from /auth/google (intent: 'login') — no Waseet account
  // exists for that Google identity. Per product requirement: a Login
  // attempt must never auto-create an account, only point the user at Sign Up.
  accountNotFoundError = false;

  // Login-time phone OTP challenge (see auth.service.ts loginUser/googleAuth
  // — set when the account has phoneOtpEnabled). userId comes from the
  // /auth/login or /auth/google response and is forwarded to verify/resend.
  otpRequired = false;
  private pendingLoginUserId: string | null = null;
  otpCountdown = 90;
  private otpCountdownTimer: any = null;

  constructor(
    private fb: FormBuilder,
    private authApi: AuthApiService,
    private authStore: AuthStore,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private socialAuthService: SocialAuthService,
    private destroyRef: DestroyRef
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      remember: [false]
    });

    this.otpForm = this.fb.group({
      code1: ['', Validators.required],
      code2: ['', Validators.required],
      code3: ['', Validators.required],
      code4: ['', Validators.required],
      code5: ['', Validators.required],
      code6: ['', Validators.required]
    });
  }

  ngOnInit() {
    // CRITICAL (part 1 — stale subscription leak): SocialAuthService.authState
    // is a single app-wide ReplaySubject(1) singleton, and this subscription
    // is set up in ngOnInit (re-created every time this page is visited).
    // Without takeUntilDestroyed(), navigating away never unsubscribes it —
    // the closure leaks and stays alive for the rest of the tab session. A
    // later Google sign-in event fired from a completely different page
    // (e.g. Register) would then ALSO reach this leaked handler, which
    // unconditionally sends intent:'login' — silently authenticating a real
    // session behind an unrelated signup attempt.
    //
    // CRITICAL (part 2 — replay-on-subscribe): takeUntilDestroyed() alone is
    // NOT sufficient. Being a ReplaySubject(1), EVERY brand-new subscription
    // (e.g. arriving at THIS page fresh, after clicking "تسجيل الدخول" from
    // Register's "account already exists" message) immediately, synchronously
    // receives whatever Google credential was last emitted anywhere in the
    // app — even though the user never touched this page's Google button.
    // Google's real sign-in flow is always asynchronous (a network
    // round-trip + user interaction with Google's own popup/consent screen),
    // so a value delivered SYNCHRONOUSLY during .subscribe() itself can only
    // ever be a replayed leftover from before this component existed, never
    // a genuine action on this instance — `allowProcessing` starts false and
    // is flipped true only after .subscribe() returns, so that one
    // synchronous replay (if any) is deliberately ignored, while any real
    // future click is processed normally.
    let allowProcessing = false;
    this.socialAuthService.authState.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((user) => {
      if (!allowProcessing) return;
      if (user && user.idToken) {
        this.isSubmitting = true;
        this.errorMessage = '';
        this.accountNotFoundError = false;
        this.cdr.markForCheck();
        this.authApi.googleAuth(user.idToken, 'login').subscribe({
          next: (res) => {
            this.isSubmitting = false;
            this.cdr.markForCheck();

            if (res.data?.phoneOtpRequired && res.data?.userId) {
              this.openOtpModal(res.data.userId);
              return;
            }

            // Existing Google account that never finished email verification: no token comes back,
            // so resume at the email-OTP step instead of navigating with an empty user.
            if (res.data && !res.data.token && res.data.verified === false && res.data.userId) {
              this.goToEmailVerification(res.data);
              return;
            }

            // intent: 'login' can only ever succeed for an existing,
            // already-registered account (the backend 404s otherwise, caught
            // below) — never a first-time signup, so this always goes
            // straight to the dashboard, never the profile-completion splash.
            const authedUser = res.data?.user || this.authStore.currentUser();
            this.router.navigateByUrl(getDefaultDashboard(authedUser?.accountType, authedUser?.activeRole));
          },
          error: (err) => {
            this.isSubmitting = false;
            if (err.status === 404) {
              this.accountNotFoundError = true;
              // Server text if it is Arabic, otherwise the fixed "no account" message.
              this.errorMessage = /[\u0600-\u06FF]/.test(err.error?.message || '')
                ? err.error.message
                : 'لا يوجد حساب بهذا البريد الإلكتروني، يرجى إنشاء حساب أولاً';
            } else {
              this.errorMessage = mapHttpError(err, { unauthorizedIs: 'credentials', fallback: 'حدث خطأ أثناء تسجيل الدخول بجوجل' }).message;
            }
            this.cdr.markForCheck();
          }
        });
      }
    });
    // Any buffered replay was delivered synchronously above, inside
    // .subscribe() itself — this line only runs once that's done, so
    // flipping the gate here makes every subsequent (necessarily async,
    // necessarily real) emission processable.
    allowProcessing = true;
  }

  ngOnDestroy() {
    if (this.otpCountdownTimer) clearInterval(this.otpCountdownTimer);
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  appleSignIn() {
    // Apple Sign-In is not wired to a backend endpoint yet — tell the user
    // instead of failing silently.
    this.appleNotice = 'تسجيل الدخول عبر آبل سيكون متاحاً قريباً، يمكنك المتابعة بجوجل أو بالبريد';
    this.cdr.markForCheck();
  }

  onSubmit() {
    this.errorMessage = '';
    this.accountNotFoundError = false;
    const attempt = attemptSubmit(this.loginForm, { root: this.host.nativeElement, labels: LOGIN_LABELS });
    this.missingFields = attempt.missing;
    if (!attempt.valid) {
      this.cdr.markForCheck();
      return;
    }

    this.isSubmitting = true;
    this.cdr.markForCheck();

    const payload = {
      email: this.loginForm.value.email,
      password: this.loginForm.value.password
    };

    this.authApi.login(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.cdr.markForCheck();
        if (res.data?.verified) {
          const user = res.data.user || this.authStore.currentUser();
          this.router.navigateByUrl(getDefaultDashboard(user?.accountType, user?.activeRole));
        } else if (res.data?.phoneOtpRequired && res.data?.userId) {
          this.openOtpModal(res.data.userId);
        } else {
          // Registered but never verified: the backend has just e-mailed a fresh code (and authApi.login
          // stored the pending user id), so continue at the verification step instead of the sign-up page.
          this.goToEmailVerification(res.data);
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        // 401 here means wrong credentials, never an expired session (and the interceptor must not log out).
        this.errorMessage = mapHttpError(err, { unauthorizedIs: 'credentials' }).message;
        this.cdr.markForCheck();
      }
    });
  }

  /** Unverified account: send the user to the email-OTP step with an explanation. */
  private goToEmailVerification(data?: AuthResponse['data']) {
    // Only claim "sent" when the backend says so; a throttled send tells the user the earlier code still works.
    const notice = unverifiedLoginNotice(data);
    this.otpHandoff.set(notice);
    this.notify.info(notice.message, { duration: 8000 });
    this.router.navigate(['/auth/verify-otp']);
  }

  /** Arabic message for a field of the login form (shown once touched, or after a submit attempt). */
  fieldError(name: 'email' | 'password'): string | null {
    const c = this.loginForm.get(name);
    return c && (c.touched || c.dirty) && c.invalid ? validationMessage(c.errors, LOGIN_LABELS[name]) : null;
  }

  private openOtpModal(userId: string) {
    this.pendingLoginUserId = userId;
    this.otpRequired = true;
    this.errorMessage = '';
    this.otpForm.reset();
    this.startOtpCountdown();
    this.cdr.markForCheck();
  }

  closeOtpModal() {
    this.otpRequired = false;
    this.pendingLoginUserId = null;
    this.errorMessage = '';
    if (this.otpCountdownTimer) clearInterval(this.otpCountdownTimer);
    this.cdr.markForCheck();
  }

  get formattedOtpCountdown() {
    const m = Math.floor(this.otpCountdown / 60);
    const s = this.otpCountdown % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }

  startOtpCountdown() {
    this.otpCountdown = 90;
    if (this.otpCountdownTimer) clearInterval(this.otpCountdownTimer);
    this.otpCountdownTimer = setInterval(() => {
      if (this.otpCountdown > 0) {
        this.otpCountdown--;
      } else {
        clearInterval(this.otpCountdownTimer);
      }
      this.cdr.markForCheck();
    }, 1000);
  }

  resendLoginOtp() {
    if (this.otpCountdown > 0 || this.isSubmitting || !this.pendingLoginUserId) return;

    this.isSubmitting = true;
    this.errorMessage = '';

    this.authApi.resendLoginOtp(this.pendingLoginUserId).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.startOtpCountdown();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = mapHttpError(err, { unauthorizedIs: 'credentials', fallback: 'حدث خطأ أثناء إعادة الإرسال' }).message;
        this.cdr.markForCheck();
      }
    });
  }

  submitLoginOtp() {
    if (!this.pendingLoginUserId) return;
    if (this.otpForm.invalid) {
      // Never a silent no-op: say what is needed and put the cursor on the first empty box.
      this.otpForm.markAllAsTouched();
      this.errorMessage = 'أدخل رمز التحقق المكوّن من 6 أرقام';
      const firstEmpty = this.otpIndexes.find(i => !this.otpDigit(i)) ?? 0;
      this.focusOtpInput(firstEmpty);
      this.cdr.markForCheck();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    const val = this.otpForm.value;
    const code = `${val.code1}${val.code2}${val.code3}${val.code4}${val.code5}${val.code6}`;

    this.authApi.verifyLoginOtp({ userId: this.pendingLoginUserId, code }).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.otpRequired = false;
        if (this.otpCountdownTimer) clearInterval(this.otpCountdownTimer);
        this.cdr.markForCheck();

        const user = res.data?.user || this.authStore.currentUser();
        this.router.navigateByUrl(getDefaultDashboard(user?.accountType, user?.activeRole));
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = mapHttpError(err, { unauthorizedIs: 'credentials', fallback: 'رمز التحقق غير صحيح' }).message;
        this.cdr.markForCheck();
      }
    });
  }

  // Same interaction rules as the register-page OTP boxes: digits only,
  // Arabic/Persian digits normalized, full-code paste from any box,
  // Backspace walks back, Enter submits.
  readonly otpIndexes = [0, 1, 2, 3, 4, 5];

  otpDigit(index: number): string {
    return this.otpForm.get(`code${index + 1}`)?.value ?? '';
  }

  onOtpInput(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = this.normalizeDigits(input.value);

    if (raw.length > 1) {
      this.fillOtpFrom(raw);
      return;
    }

    this.otpForm.get(`code${index + 1}`)?.setValue(raw);
    input.value = raw;
    this.errorMessage = '';

    if (raw && index < 5) {
      this.focusOtpInput(index + 1);
    }
    this.cdr.markForCheck();
  }

  onOtpKeydown(index: number, event: KeyboardEvent) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (this.otpDigit(index)) {
        this.otpForm.get(`code${index + 1}`)?.setValue('');
      } else if (index > 0) {
        this.otpForm.get(`code${index}`)?.setValue('');
        this.focusOtpInput(index - 1);
      }
      this.cdr.markForCheck();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.submitLoginOtp();
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
    this.otpIndexes.forEach(i => this.otpForm.get(`code${i + 1}`)?.setValue(digits[i] ?? ''));
    this.errorMessage = '';
    this.cdr.markForCheck();
    this.focusOtpInput(Math.min(digits.length, 6) - 1);
  }

  private focusOtpInput(index: number) {
    const el = document.getElementById(`login-otp-${index}`) as HTMLInputElement | null;
    el?.focus();
    el?.select();
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
}
