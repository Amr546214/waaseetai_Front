import { Component, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { AuthStore } from '../../../core/store/auth.store';
import { SocialAuthService, GoogleSigninButtonModule } from '@abacritt/angularx-social-login';
import { getDefaultDashboard } from '../../../core/guards/auth.guards';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, GoogleSigninButtonModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
  encapsulation: ViewEncapsulation.None,
})
export class Login {
  loginForm: FormGroup;
  showPassword = false;

  errorMessage = '';
  appleNotice = '';
  isSubmitting = false;

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
            const authedUser = res.data?.user || this.authStore.currentUser();
            
            this.router.navigate([getDefaultDashboard(authedUser?.accountType, authedUser?.activeRole)]);
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
            
            this.router.navigate([getDefaultDashboard(user?.accountType, user?.activeRole)]);
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
}
