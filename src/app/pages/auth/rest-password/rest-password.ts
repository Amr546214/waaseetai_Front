import { Component, OnDestroy, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PhoneInputComponent } from '../../../sheards/phone-input/phone-input.component';

@Component({
  selector: 'app-rest-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PhoneInputComponent],
  templateUrl: './rest-password.html',
  styleUrl: './rest-password.css',
  encapsulation: ViewEncapsulation.None,
})
export class RestPassword implements OnDestroy {
  currentStep = 1;
  channel: 'email' | 'phone' = 'email';
  
  recoveryForm: FormGroup;
  verificationForm: FormGroup;
  passwordForm: FormGroup;

  showNewPassword = false;
  showConfirmPassword = false;

  otpSeconds = 300;
  otpTimerInterval: any;
  showOtpError = false;

  bannerError = '';
  bannerLock = false;

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
    this.channel = ch;
    this.bannerError = '';
    this.cdr.detectChanges();
  }

  sendOtp() {
    if (this.channel === 'email' && (!this.recoveryForm.value.email || this.recoveryForm.get('email')?.invalid)) {
      this.bannerError = 'ادخل بريدا إلكترونيا صحيحا';
      this.cdr.detectChanges();
      return;
    }
    if (this.channel === 'phone' && (!this.recoveryForm.value.phone || this.recoveryForm.get('phone')?.invalid)) {
      this.bannerError = 'ادخل رقم جوال سعودي صحيح';
      this.cdr.detectChanges();
      return;
    }
    
    this.bannerError = '';
    this.cdr.detectChanges();
    this.currentStep = 2;
    this.startTimer();
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

  autoFocusNext(event: any, nextElementId?: string, prevElementId?: string) {
    const input = event.target;
    const value = input.value;
    const key = event.key;

    if (key === 'Backspace') {
      if (!value && prevElementId) {
        const prevEl = document.getElementById(prevElementId);
        if (prevEl) prevEl.focus();
      }
      return;
    }

    if (value && nextElementId) {
      const nextEl = document.getElementById(nextElementId);
      if (nextEl) nextEl.focus();
    }
  }

  startTimer() {
    this.clearTimer();
    this.otpSeconds = 300;
    this.otpTimerInterval = setInterval(() => {
      this.otpSeconds--;
      if (this.otpSeconds <= 0) {
        this.clearTimer();
      }
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
    this.verificationForm.reset();
    this.startTimer();
  }

  verifyOtp() {
    if (this.verificationForm.valid) {
      this.currentStep = 3;
      this.clearTimer();
    }
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
    if (this.passwordForm.valid) {
      this.currentStep = 4;
    } else if (this.passwordForm.hasError('mismatch')) {
      this.bannerError = 'كلمة المرور غير متطابقة';
      this.cdr.detectChanges();
    }
  }
}
