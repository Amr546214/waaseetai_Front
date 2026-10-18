import { Component, ElementRef, AfterViewInit, ChangeDetectorRef, DestroyRef, ViewEncapsulation, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { AuthResponse } from '../../../core/models/auth.model';
import { AuthStore } from '../../../core/store/auth.store';
import { SocialAuthService, GoogleSigninButtonModule } from '@abacritt/angularx-social-login';
import { GoogleBtnStateDirective } from '../../../shared/directives/google-btn-state.directive';
import { getDefaultDashboard } from '../../../core/guards/auth.guards';
import { mapHttpError } from '../../../core/forms/http-error';
import { loginOtpNotice, unverifiedLoginNotice } from '../../../core/forms/otp-delivery';
import { OtpHandoffService } from '../../../core/services/otp-handoff.service';
import { attemptSubmit, InvalidField } from '../../../core/forms/form-helpers';
import { validationMessage } from '../../../core/forms/validation-messages';
import { UiNotificationService } from '../../../core/services/ui-notification.service';
import { backendBannerMessage, genericBanner } from '../../../shared/forms/submit-feedback';
import { FormSummaryComponent } from '../../../shared/forms/form-summary.component';
import { WaitTimerService, waitScope } from '../../../core/wait/wait-timer.service';
import { isRateLimitError, RATE_LIMIT_MESSAGE, startWaitFromError } from '../../../core/utils/rate-limit.util';
import { parseRetryAfter } from '../../../core/wait/retry-after.util';
import { rateLimitSentence } from '../../../core/wait/wait-format';

const LOGIN_LABELS = { email: 'البريد الإلكتروني', password: 'كلمة المرور' };

/** Same wording as the backend 503, so a challenge response and a 503 read identically. */
export const SMS_UNAVAILABLE_MESSAGE = 'التحقق عبر الرسائل النصية غير متاح حاليًا، يرجى التواصل مع الدعم لإكمال تسجيل الدخول';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, GoogleSigninButtonModule, GoogleBtnStateDirective, FormSummaryComponent],
  templateUrl: './login.html',
  styleUrl: './login.css',
  encapsulation: ViewEncapsulation.None,
})
export class Login implements AfterViewInit {
  loginForm: FormGroup;
  showPassword = false;

  errorMessage = '';
  /** What is missing after a failed submit attempt (shown by <ws-form-summary>). */
  missingFields: InvalidField[] = [];
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly notify = inject(UiNotificationService);
  private readonly otpHandoff = inject(OtpHandoffService);
  isSubmitting = false;
  private readonly waits = inject(WaitTimerService);
  private readonly loginEmail = signal('');
  /** The server's wait after a 429 on login, per e-mail (end timestamp: a refresh does not bypass it). Disables ONLY the login button; zero never logs in by itself. */
  readonly loginWait = this.waits.trackKeyed('login', () => this.loginEmail());
  private readonly loginRateLimitedNoTime = signal(false);
  /** «طلبات كثيرة، يمكنك إعادة المحاولة بعد 1:23» (ticking) / the honest sentence when the server gave no time; '' otherwise. */
  /** The server's wait after a 429 on Google sign-in (end timestamp, survives a refresh). Gates ONLY the Google button; nothing is retried at zero. */
  readonly googleWait = this.waits.track(waitScope('google-auth', 'login'));
  private readonly googleRateLimitedNoTime = signal(false);
  get rateLimitText(): string {
    if (this.googleWait.active()) return rateLimitSentence(this.googleWait.remainingSeconds(), true);
    if (this.googleRateLimitedNoTime()) return RATE_LIMIT_MESSAGE;
    const w = this.loginWait();
    return w.active() ? rateLimitSentence(w.remainingSeconds(), true) : this.loginRateLimitedNoTime() ? RATE_LIMIT_MESSAGE : '';
  }
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
    this.loginForm.get('email')!.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(v => this.loginEmail.set(String(v || '')));
  }

  ngOnInit() {
    // The login form starts empty (the app never stores credentials). The two credential inputs carry a static
    // `readonly` in the template (Chrome does not autofill read-only fields on page load) and ngAfterViewInit lifts it on
    // the first pointer / touch / key / focus, so the saved-account dropdown still opens on the click. No timers, no clearing.

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
        if (this.googleWait.active()) return;
        this.authApi.googleAuth(user.idToken, 'login').subscribe({
          next: (res) => {
            this.isSubmitting = false;
            this.cdr.markForCheck();

            // SMS / phone verification is not supported: never open an SMS step, explain and point to support.
            if (res.data?.phoneOtpRequired) {
              this.showSmsUnavailable();
              return;
            }

            // Google proved the identity but the session still needs the e-mailed login code (never SMS).
            if (res.data && !res.data.token && res.data.loginOtpRequired && res.data.userId) {
              this.goToLoginOtp(res.data);
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
            this.googleRateLimitedNoTime.set(false);
            if (isRateLimitError(err)) {
              const end = startWaitFromError(this.googleWait, err);
              this.googleRateLimitedNoTime.set(end == null || !this.googleWait.active());
              this.errorMessage = '';
              this.cdr.markForCheck();
              return;
            }
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

  onSubmit() {
    if (this.isSubmitting || this.loginWait().active()) return; // one request at a time (double click / Enter); blocked while the server's wait runs
    this.errorMessage = '';
    this.loginRateLimitedNoTime.set(false);
    this.accountNotFoundError = false;
    this.syncAutofilledValues();
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
        } else if (res.data?.loginOtpRequired) {
          // Correct password: the login code was e-mailed (never SMS). The shared OTP screen finishes the login.
          this.goToLoginOtp(res.data);
        } else {
          // Registered but never verified: the backend has just e-mailed a fresh code (and authApi.login
          // stored the pending user id), so continue at the verification step instead of the sign-up page.
          this.goToEmailVerification(res.data);
        }
      },
      error: async (err) => {
        // 429: a wait from the server (Retry-After / retryAt). The typed e-mail and password stay; no stated time = honest sentence, no timer.
        if (isRateLimitError(err)) {
          // header / body time first; else the wait the server wrote in its own message (http-error reads Arabic and English wording)
          const end = startWaitFromError(this.loginWait(), err);
          this.loginRateLimitedNoTime.set(end == null || !this.loginWait().active());
          this.isSubmitting = false;
          this.cdr.markForCheck();
          return;
        }
        // 401 here means wrong credentials, never an expired session (and the interceptor must not log out).
        const mapped = mapHttpError(err, { unauthorizedIs: 'credentials' });
        // 400/422 naming email / password -> under that field; wrong credentials, network, 429, 5xx stay one honest banner.
        const generic = genericBanner(mapped);
        this.errorMessage = generic ?? await backendBannerMessage(this.host.nativeElement, mapped, { resolve: { email: 'identifier' } });
        this.isSubmitting = false;
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * The login answer says when another code may be requested (resendAvailableAt after a send, retryAfterSeconds after a throttled one). Stored under the shared
   * `otp-resend` scope of this user, so the verify screen shows the same end timestamp. No time from the server = nothing stored.
   */
  private handOffResendWait(data?: AuthResponse['data']) {
    const userId = data?.userId;
    if (!userId) return;
    const end = parseRetryAfter({ resendAvailableAt: (data as any)?.resendAvailableAt, retryAfterSeconds: data?.retryAfterSeconds });
    if (end != null) this.waits.setEnd(waitScope('otp-resend', userId), end);
    // and when that code stops being valid (login answers carry expiresAt)
    const valid = parseRetryAfter({ resendAvailableAt: (data as any)?.expiresAt });
    if (valid != null) this.waits.setEnd(waitScope('otp-valid', userId), valid);
  }

  /** Active account (password or Google): the mandatory login code was e-mailed, finish at the shared OTP screen. */
  private goToLoginOtp(data?: AuthResponse['data']) {
    this.handOffResendWait(data);
    const notice = loginOtpNotice(data);
    this.otpHandoff.set(notice);
    this.notify.info(notice.message, { duration: 8000 });
    this.router.navigate(['/auth/verify-otp']);
  }

  /** Unverified account: send the user to the email-OTP step with an explanation. */
  private goToEmailVerification(data?: AuthResponse['data']) {
    this.handOffResendWait(data);
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

  ngAfterViewInit() {
    const root: HTMLElement | undefined = this.host.nativeElement;
    if (!root) return;
    const fields = Array.from(root.querySelectorAll<HTMLInputElement>('#identifier, #password'));
    // The first real interaction (mouse, touch, keyboard incl. Tab focus) makes both fields editable at once, before the
    // browser decides about its saved-account dropdown. Nothing is ever cleared; this only runs once.
    const events = ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'focus'];
    const unlock = () => {
      for (const f of fields) f.removeAttribute('readonly');
      for (const f of fields) for (const ev of events) f.removeEventListener(ev, unlock);
    };
    for (const f of fields) for (const ev of events) f.addEventListener(ev, unlock);
    this.destroyRef.onDestroy(() => { for (const f of fields) for (const ev of events) f.removeEventListener(ev, unlock); });
  }

  /** Browser autofill may paint values without firing input events: pull them into the reactive form before validating. */
  private syncAutofilledValues() {
    const root: HTMLElement | undefined = this.host.nativeElement;
    for (const [id, name] of [['identifier', 'email'], ['password', 'password']] as const) {
      const el = root?.querySelector<HTMLInputElement>('#' + id);
      const c = this.loginForm.get(name);
      if (el && c && el.value && c.value !== el.value) c.setValue(el.value);
    }
  }
}
