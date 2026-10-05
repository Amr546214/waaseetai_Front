import { Component, ElementRef, ChangeDetectorRef, DestroyRef, ViewEncapsulation, inject } from '@angular/core';
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

/** Same wording as the backend 503, so a challenge response and a 503 read identically. */
export const SMS_UNAVAILABLE_MESSAGE = 'التحقق عبر الرسائل النصية غير متاح حاليًا، يرجى التواصل مع الدعم لإكمال تسجيل الدخول';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, GoogleSigninButtonModule, FormSummaryComponent],
  templateUrl: './login.html',
  styleUrl: './login.css',
  encapsulation: ViewEncapsulation.None,
})
export class Login {
  loginForm: FormGroup;
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
  }

  ngOnInit() {
    // The login page always starts empty: no email/password is ever stored by the app, and the browser's
    // saved-credential autofill / form restoration is switched off in the template. This also wipes anything
    // a browser still managed to paint into the fields (it can do so after the first render).
    this.clearCredentialFields();
    setTimeout(() => this.clearCredentialFields(), 150);
    setTimeout(() => this.clearCredentialFields(), 600);

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

            // SMS / phone verification is not supported: never open an SMS step, explain and point to support.
            if (res.data?.phoneOtpRequired) {
              this.showSmsUnavailable();
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
        } else if (res.data?.phoneOtpRequired) {
          this.showSmsUnavailable();
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

  /** Phone/SMS verification does not exist: say so in Arabic and route to support; never show an SMS step. */
  private showSmsUnavailable() {
    this.errorMessage = SMS_UNAVAILABLE_MESSAGE;
    this.cdr.markForCheck();
  }

  /** Password/e-mail fields are read-only until the user focuses them, so browsers do not autofill saved credentials. */
  unlockField(event: Event) {
    (event.target as HTMLInputElement).removeAttribute('readonly');
  }

  private clearCredentialFields() {
    const root: HTMLElement | undefined = this.host.nativeElement;
    if (!this.loginForm.dirty) {
      this.loginForm.reset({ email: '', password: '', remember: false });
      root?.querySelectorAll<HTMLInputElement>('#identifier, #password').forEach(i => { if (document.activeElement !== i) i.value = ''; });
      this.cdr.markForCheck();
    }
  }
}
