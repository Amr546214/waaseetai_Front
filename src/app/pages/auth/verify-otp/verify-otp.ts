import { Component, inject, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStore } from '../../../core/store/auth.store';
import { AuthApiService } from '../../../core/services/auth-api.service';

@Component({
  selector: 'app-verify-otp',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './verify-otp.html',
  styleUrls: ['./verify-otp.css'],
  encapsulation: ViewEncapsulation.None,
})
export class VerifyOtp implements OnInit, OnDestroy {
  private authStore = inject(AuthStore);
  private authApi = inject(AuthApiService);
  private router = inject(Router);

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
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMsg = err.error?.message || 'فشل التحقق، يرجى المحاولة مرة أخرى';
      }
    });
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
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMsg = err.error?.message || 'فشل إعادة الإرسال، يرجى المحاولة مرة أخرى';
      }
    });
  }
}
