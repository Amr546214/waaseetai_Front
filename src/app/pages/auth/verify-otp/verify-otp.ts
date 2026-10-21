import { consumeReturnUrl } from '../../../core/routing/return-url';
import { Component, inject, OnInit, ViewEncapsulation, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../../core/store/auth.store';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { getDefaultDashboard } from '../../../core/guards/auth.guards';
import { mapHttpError } from '../../../core/forms/http-error';
import { OTP_DELIVERY_HINT, resendNotice } from '../../../core/forms/otp-delivery';
import { OtpHandoffService } from '../../../core/services/otp-handoff.service';
import { WaitTimerService } from '../../../core/wait/wait-timer.service';
import { parseRetryAfter } from '../../../core/wait/retry-after.util';
import { formatClock, rateLimitSentence } from '../../../core/wait/wait-format';
import { RATE_LIMIT_MESSAGE, isRateLimitError, startWaitFromError } from '../../../core/utils/rate-limit.util';

/** The server's "too many wrong codes" lock (429 without a duration): the answer is a NEW code, not a timer. */
const ATTEMPTS_LOCKED_CODE = 'OTP_ATTEMPTS_LOCKED';

@Component({
  selector: 'app-verify-otp',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './verify-otp.html',
  styleUrls: ['./verify-otp.css'],
  encapsulation: ViewEncapsulation.None,
})
export class VerifyOtp implements OnInit {
  private authStore = inject(AuthStore);
  private authApi = inject(AuthApiService);
  private router = inject(Router);
  private otpHandoff = inject(OtpHandoffService);
  // Zoneless app: timer ticks and HTTP callbacks must request a render explicitly.
  private cdr = inject(ChangeDetectorRef);

  otpCtrl = new FormControl('', [Validators.required, Validators.minLength(6), Validators.maxLength(6), Validators.pattern('^[0-9]*$')]);
  
  isLoading = false;
  /** The code was accepted and the dashboard is opening: its lazy chunk can take seconds on a cold start, and until then the form stays locked (never shown ready for a second, useless submit). */
  isEntering = false;
  /** Set when the code was ACCEPTED but the navigation failed: the form is replaced by a single «إعادة فتح لوحتي» button that only retries the navigation (a second submit would re-send a consumed code). */
  entryFailedUrl: string | null = null;
  errorMsg = '';
  /** True only when the message is about the CODE itself (wrong / expired / not six digits / locked): only then are the code boxes marked invalid. A server, network or limit failure never marks a code that may be right. */
  errorIsAboutCode = false;
  successMsg = '';

  // Three different timers, all from the server and keyed by the pending user (the login page stores the same scopes before navigating here):
  //  - resend: when another code may be requested (resendAvailableAt / Retry-After / retryAfterSeconds); disables ONLY the resend button.
  //  - validity: when the code stops being valid (expiresAt); informational.
  //  - verify: only when the server answered the verification with a 429 AND a wait; disables ONLY the confirm button.
  // End timestamps live in WaitTimerService (survive a refresh / background tab). A wrong code starts nothing; the attempts lock has no timer.
  private readonly waits = inject(WaitTimerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingKey = () => this.authStore.pendingUserId() ?? '';
  readonly resendWait = this.waits.trackKeyed('otp-resend', this.pendingKey, this.destroyRef);
  readonly validWait = this.waits.trackKeyed('otp-valid', this.pendingKey, this.destroyRef);
  readonly verifyWait = this.waits.trackKeyed('otp-verify', this.pendingKey, this.destroyRef);
  /** True once the server told us when the current code expires (so "expired" can be said honestly). */
  codeExpiryKnown = false;
  /** A 429 whose duration the server did not state: an honest sentence without a number. */
  private rateLimitedNoTime = false;
  /** The last 429 came from the resend (not the verification). */
  private resendLimited = false;

  /** Seconds until another code may be requested (0 = available). */
  get countdown(): number { return this.resendWait().remainingSeconds(); }

  /** Read once on entry (the flag is cleared when the login succeeds): true = mandatory LOGIN code, false = account activation. */
  loginMode = false;
  /** The masked address the last code was addressed to (known only when we arrive from the login page). */
  targetEmail = '';
  readonly deliveryHint = OTP_DELIVERY_HINT;

  ngOnInit() {
    this.loginMode = this.authApi.isLoginOtpPending();
    if (!this.authStore.isPendingVerification()) {
      // If no pending user, redirect to login
      this.router.navigate(['/auth/login']);
      return;
    }
    
    // If they arrived with an active token, they were redirected from a 403 and need a fresh OTP. A refresh / back-forward visit must not fire a
    // new code each time: the server's resend wait (stored end timestamp) decides, so send only when no wait is running.
    if (this.authStore.token()) {
      if (this.resendWait().active()) {
        this.successMsg = 'أرسلنا لك رمز تحقق قبل قليل، استخدمه أو انتظر قبل طلب رمز جديد.';
      } else {
        this.resendOtp();
      }
    } else {
      // Arrived from an unverified login: show what really happened. The resend wait was stored by the login page from the server's answer
      // (nothing is started here, and a reload keeps the stored end).
      const notice = this.otpHandoff.consume();
      this.targetEmail = notice?.to ?? '';
      if (notice?.sent) {
        this.successMsg = notice.message;
      } else if (notice) {
        this.errorMsg = notice.message; this.errorIsAboutCode = false;
      }
    }
    this.codeExpiryKnown = this.validWait().active();
  }

  async verify() {
    if (this.entryFailedUrl) return; // the code is already used: only «إعادة فتح لوحتي» is possible
    if (this.isLoading || this.verifyWait().active()) return; // one request at a time; blocked while the server's wait runs
    if (this.otpCtrl.invalid) {
      // Never a silent no-op: say what is needed and put the cursor on the first empty box.
      this.otpCtrl.markAsTouched();
      this.errorMsg = 'الرجاء إدخال رمز التحقق المكون من 6 أرقام';
      this.errorIsAboutCode = true;
      this.focusOtpInput(this.otpIndexes.find(i => !this.otpDigit(i)) ?? 0);
      this.cdr.markForCheck();
      return;
    }

    const userId = this.authStore.pendingUserId();
    if (!userId) {
      this.errorMsg = 'انتهت جلسة التفعيل. سجّل الدخول مرة أخرى لإكمال تفعيل حسابك.'; this.errorIsAboutCode = false;
      this.cdr.markForCheck();
      return;
    }

    this.isLoading = true;
    this.errorMsg = '';
    this.errorIsAboutCode = false;

    this.authApi.verifyOtp({ userId, code: this.otpCtrl.value! }).subscribe({
      next: (res) => {
        if (res.success) {
          // AuthStore takes care of authentication and state updates via its API service tap().
          // Continue to the user's own dashboard; the form stays locked (isLoading stays true) until that navigation ends.
          const user = res.data?.user || this.authStore.currentUser();
          this.isEntering = true;
          this.errorMsg = '';
          this.errorIsAboutCode = false;
    this.errorIsAboutCode = false;
          this.successMsg = 'تم التحقق من الرمز. جارٍ فتح لوحتك...';
          this.cdr.markForCheck();
          this.openDashboard(consumeReturnUrl(user) ?? getDefaultDashboard(user?.accountType, user?.activeRole));
        } else {
          this.isLoading = false;
          this.errorMsg = res.message || 'لم يتم قبول الرمز. تحقق منه وحاول مرة أخرى، أو اطلب رمزًا جديدًا.';
          this.errorIsAboutCode = true;
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.rateLimitedNoTime = false;
        if (err?.error?.code === ATTEMPTS_LOCKED_CODE) {
          // Too many wrong codes: the server's own message already asks for a NEW code; there is no timer to show.
          this.errorMsg = err.error.message || 'تم تجاوز عدد المحاولات المسموح به، يرجى طلب رمز جديد';
          this.errorIsAboutCode = true;
        } else if (isRateLimitError(err)) {
          // A wait from the server (Retry-After / retryAt): only confirm waits, the typed code stays. No stated time = honest sentence, no timer.
          this.resendLimited = false;
          this.errorMsg = '';
          this.errorIsAboutCode = false;
    this.errorIsAboutCode = false;
          const end = startWaitFromError(this.verifyWait(), err);
          this.rateLimitedNoTime = end == null || !this.verifyWait().active();
        } else {
          // Wrong / expired code (400): a message only, never a UI wait.
          const mapped = mapHttpError(err, { unauthorizedIs: 'credentials', fallback: 'فشل التحقق، يرجى المحاولة مرة أخرى' });
          this.errorMsg = mapped.message;
          // a wrong / expired code is a problem OF the code; a server, network, gateway or limit failure is not
          this.errorIsAboutCode = mapped.kind === 'backend-validation' || mapped.kind === 'credentials';
        }
        this.cdr.markForCheck();
      }
    });
  }

  /** Navigate to the dashboard; the form stays locked until it ends. If it does not happen the code is already used: offer a navigation-only retry. */
  private openDashboard(url: string) {
    const failed = () => {
      this.entryFailedUrl = url;
      this.isEntering = false;
      this.isLoading = false;
      this.successMsg = '';
      this.errorMsg = 'تم التحقق من الرمز لكن تعذر فتح لوحتك. اضغط «إعادة فتح لوحتي» (لا حاجة إلى رمز جديد).'; this.errorIsAboutCode = false;
      this.cdr.markForCheck();
    };
    this.router.navigateByUrl(url).then((ok) => { if (!ok) failed(); }, failed);
  }

  /** Retries ONLY the navigation: no code is sent or verified. */
  reopenDashboard() {
    const url = this.entryFailedUrl;
    if (!url || this.isEntering) return;
    this.errorMsg = '';
    this.errorIsAboutCode = false;
    this.isEntering = true;
    this.cdr.markForCheck();
    this.openDashboard(url);
  }

  /** «طلبات كثيرة، يمكنك إعادة المحاولة بعد 1:23» (ticking) while the server's wait runs; the honest no-time sentence after a 429 without one; '' otherwise. */
  get rateLimitText(): string {
    const w = this.verifyWait().active() ? this.verifyWait() : this.resendLimited && this.resendWait().active() ? this.resendWait() : null;
    return w ? rateLimitSentence(w.remainingSeconds(), true) : this.rateLimitedNoTime ? RATE_LIMIT_MESSAGE : '';
  }

  /** The code just sent ran out (only said when the server stated an expiry). */
  get codeExpired(): boolean { return this.codeExpiryKnown && !this.validWait().active(); }

  // Six design OTP boxes (P-AU-009) feeding the single otpCtrl: digits only,
  // Arabic/Persian digits normalized, full-code paste, Backspace walks back, Enter submits.
  readonly otpIndexes = [0, 1, 2, 3, 4, 5];

  get formattedCountdown(): string { return formatClock(this.countdown); }

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
    this.errorIsAboutCode = false;
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
    this.errorIsAboutCode = false;
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
    if (this.entryFailedUrl) return;
    if (this.resendWait().active()) return;

    const userId = this.authStore.pendingUserId();
    if (!userId) {
      this.errorMsg = 'انتهت جلسة التفعيل. سجّل الدخول مرة أخرى لإكمال تفعيل حسابك.'; this.errorIsAboutCode = false;
      this.cdr.markForCheck();
      return;
    }

    this.errorMsg = '';
    this.errorIsAboutCode = false;
    this.successMsg = '';
    this.rateLimitedNoTime = false;
    this.isLoading = true;

    this.authApi.resendOtp(userId).subscribe({
      next: (res) => {
        this.isLoading = false;
        const notice = resendNotice(res);
        // The answer says when the next send is allowed (resendAvailableAt after a send, retryAfterSeconds after a throttled one) and when the new code expires.
        this.resendWait().startFromResponse(res);
        const exp = parseRetryAfter({ resendAvailableAt: (res as any)?.expiresAt ?? res?.data?.expiresAt });
        if (notice.sent && exp != null) { this.codeExpiryKnown = true; this.validWait().start(exp); }
        if (notice.sent) {
          this.successMsg = notice.message;
        } else {
          // Nothing went out: say so; the button stays usable unless the server stated a wait.
          this.errorMsg = notice.message; this.errorIsAboutCode = false;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        if (isRateLimitError(err)) {
          // Keep resend locked until the end the server gave; no stated time = honest sentence, button stays usable.
          this.resendLimited = true;
          this.errorMsg = '';
          this.errorIsAboutCode = false;
    this.errorIsAboutCode = false;
          const end = startWaitFromError(this.resendWait(), err);
          this.rateLimitedNoTime = end == null || !this.resendWait().active();
        } else {
          this.errorMsg = mapHttpError(err, { unauthorizedIs: 'credentials', fallback: 'فشل إعادة الإرسال، يرجى المحاولة مرة أخرى' }).message;
          this.errorIsAboutCode = false;
        }
        this.cdr.markForCheck();
      }
    });
  }
}
