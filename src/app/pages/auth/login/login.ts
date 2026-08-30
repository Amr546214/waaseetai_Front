import { Component, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { AuthStore } from '../../../core/store/auth.store';
import { AccountType } from '../../../core/models/auth.model';
import { SocialAuthService, GoogleSigninButtonModule } from '@abacritt/angularx-social-login';

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
            
            if (authedUser) {
              if (authedUser.accountType === AccountType.CLIENT_INDIVIDUAL || authedUser.accountType === AccountType.CLIENT_COMPANY) {
                this.router.navigate(['/client-overview']);
              } else if (authedUser.accountType === AccountType.PROVIDER_INDIVIDUAL || authedUser.accountType === AccountType.PROVIDER_COMPANY || authedUser.accountType === AccountType.MARKETING_BROKER) {
                this.router.navigate(['/provider-overview']);
              } else {
                this.router.navigate(['/client-overview']);
              }
            } else {
              this.router.navigate(['/client-overview']);
            }
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
            
            if (user) {
              if (user.accountType === AccountType.CLIENT_INDIVIDUAL || user.accountType === AccountType.CLIENT_COMPANY) {
                this.router.navigate(['/client-overview']);
              } else if (user.accountType === AccountType.PROVIDER_INDIVIDUAL || user.accountType === AccountType.PROVIDER_COMPANY || user.accountType === AccountType.MARKETING_BROKER) {
                this.router.navigate(['/provider-overview']);
              } else {
                this.router.navigate(['/client-overview']);
              }
            } else {
              this.router.navigate(['/client-overview']);
            }
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
