import { Component, OnDestroy, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { AuthStore } from '../../../core/store/auth.store';
import { SocialAuthService, GoogleSigninButtonModule } from '@abacritt/angularx-social-login';
import { getWelcomeRoleKey } from '../../../core/guards/auth.guards';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, GoogleSigninButtonModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
  encapsulation: ViewEncapsulation.None,
})
export class Login implements OnDestroy {
  loginForm: FormGroup;
  otpForm: FormGroup;
  showPassword = false;

  errorMessage = '';
  appleNotice = '';
  isSubmitting = false;

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
    private socialAuthService: SocialAuthService
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
    this.socialAuthService.authState.subscribe((user) => {
      if (user && user.idToken) {
        this.isSubmitting = true;
        this.cdr.markForCheck();
        this.authApi.googleAuth(user.idToken).subscribe({
          next: (res) => {
            this.isSubmitting = false;
            this.cdr.markForCheck();

            if (res.data?.phoneOtpRequired && res.data?.userId) {
              this.openOtpModal(res.data.userId);
              return;
            }

            const authedUser = res.data?.user || this.authStore.currentUser();

            this.router.navigate(['/auth/welcome'], {
              queryParams: {
                role: getWelcomeRoleKey(authedUser?.accountType),
                accountType: authedUser?.accountType,
                activeRole: authedUser?.activeRole
              }
            });
          },
          error: (err) => {
            this.isSubmitting = false;
            this.errorMessage = err.error?.message || err.message || 'حدث خطأ أثناء تسجيل الدخول بجوجل';
            this.cdr.markForCheck();
          }
        });
      }
    });
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
    if (this.loginForm.valid) {
      this.isSubmitting = true;
      this.errorMessage = '';
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

            this.router.navigate(['/auth/welcome'], {
              queryParams: {
                role: getWelcomeRoleKey(user?.accountType),
                accountType: user?.accountType,
                activeRole: user?.activeRole
              }
            });
          } else if (res.data?.phoneOtpRequired && res.data?.userId) {
            this.openOtpModal(res.data.userId);
          } else {
            this.router.navigate(['/auth/register']);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          // Sometimes the backend response is inside err.error.message or just err.message
          this.errorMessage = err.error?.message || err.message || 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
          this.cdr.markForCheck();
        }
      });
    } else {
      this.loginForm.markAllAsTouched();
    }
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
        this.errorMessage = err.error?.message || err.message || 'حدث خطأ أثناء إعادة الإرسال';
        this.cdr.markForCheck();
      }
    });
  }

  submitLoginOtp() {
    if (!this.otpForm.valid || !this.pendingLoginUserId) return;

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
        this.router.navigate(['/auth/welcome'], {
          queryParams: {
            role: getWelcomeRoleKey(user?.accountType),
            accountType: user?.accountType,
            activeRole: user?.activeRole
          }
        });
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.message || err.message || 'رمز التحقق غير صحيح';
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
