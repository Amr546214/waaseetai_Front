import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { AuthStore } from '../../../core/store/auth.store';
import { AccountType } from '../../../core/models/auth.model';
import { PhoneInputComponent } from '../../../sheards/phone-input/phone-input.component';
import { SocialAuthService, GoogleSigninButtonModule } from '@abacritt/angularx-social-login';

@Component({
	selector: 'app-register',
	standalone: true,
	imports: [CommonModule, ReactiveFormsModule, RouterLink, PhoneInputComponent, GoogleSigninButtonModule],
	templateUrl: './register.html',
	styleUrl: './register.css',
	encapsulation: ViewEncapsulation.None,
})
export class Register implements OnInit, OnDestroy, AfterViewInit {
	currentStep = 1;
	selectedAccountType = '';

	get selectedAccountObject() {
		return this.accountTypes.find(t => t.id === this.selectedAccountType) || this.accountTypes[1];
	}

	basicInfoForm: FormGroup;
	verificationForm: FormGroup;
	showPassword = false;
	showConfirmPassword = false;

	isSubmitting = false;
	errorMessage = '';
	appleNotice = '';

	// Draft restoration
	showDraftBanner = false;
	private draftKey = 'waseet_register_draft';

	countdown = 60;
	countdownTimer: any = null;

	// Maps frontend ID to backend AccountType Enum
	accountTypeMap: Record<string, AccountType> = {
		'service_requester_comp': AccountType.CLIENT_COMPANY,
		'service_requester_ind': AccountType.CLIENT_INDIVIDUAL,
		'service_provider_comp': AccountType.PROVIDER_COMPANY,
		'service_provider_ind': AccountType.PROVIDER_INDIVIDUAL,
		'marketing_broker': AccountType.MARKETING_BROKER
	};

	accountTypes = [
		{
			id: 'service_requester_comp',
			title: 'طالب الخدمة (شركة)',
			desc: 'للشركات والمنشآت التي تحتاج خدمات مهنية موثقة عبر عقود رسمية',
			badge: 'يحتاج توثيق KYC',
			badgeType: 'warning',
			aiSuggest: false,
			icon: '#ws-role-client-company',
			disabled: true
		},
		{
			id: 'service_requester_ind',
			title: 'طالب الخدمة (فرد)',
			desc: 'للافراد الذين يطلبون خدمات من مقدمين موثقين بضمان مالي',
			badge: 'دخول مباشر',
			badgeType: 'success',
			aiSuggest: true,
			icon: '#ws-role-client-person',
			disabled: false
		},
		{
			id: 'service_provider_comp',
			title: 'مقدم الخدمة (شركة)',
			desc: 'للشركات التي تقدم خدمات احترافية وتريد العمل بعقود رسمية محمية',
			badge: 'يحتاج توثيق KYC',
			badgeType: 'warning',
			aiSuggest: false,
			icon: '#ws-role-provider-company',
			disabled: true
		},
		{
			id: 'service_provider_ind',
			title: 'مقدم الخدمة (فرد)',
			desc: 'للمستقلين والمهنيين الذين يقدمون خدماتهم للشركات والافراد',
			badge: 'يحتاج توثيق KYC',
			badgeType: 'warning',
			aiSuggest: false,
			icon: '#ws-role-provider-person',
			disabled: false
		},
		{
			id: 'marketing_broker',
			title: 'الوسيط التسويقي',
			desc: 'اكسب عمولة تلقائية عند كل صفقة ناجحة بتقديم عملاء لمقدمي الخدمات',
			badge: 'دخول مباشر',
			badgeType: 'success',
			aiSuggest: false,
			icon: '#ws-role-broker',
			disabled: false
		}
	];

	constructor(
		private fb: FormBuilder,
		private authApi: AuthApiService,
		private authStore: AuthStore,
		private router: Router,
		private cdr: ChangeDetectorRef,
		private socialAuthService: SocialAuthService
	) {
		this.basicInfoForm = this.fb.group({
			firstName: ['', Validators.required],
			lastName: ['', Validators.required],
			email: ['', [Validators.required, Validators.email]],
			phone: ['', Validators.required],
			password: ['', [Validators.required, Validators.minLength(8)]],
			confirmPassword: ['', Validators.required],
			agreeData: [false, Validators.requiredTrue],
			agreeTerms: [false, Validators.requiredTrue]
		}, { validators: this.passwordMatchValidator.bind(this) });

		this.verificationForm = this.fb.group({
			code1: ['', Validators.required],
			code2: ['', Validators.required],
			code3: ['', Validators.required],
			code4: ['', Validators.required],
			code5: ['', Validators.required],
			code6: ['', Validators.required]
		});
	}

	ngOnInit() {
		// Check for saved draft
		this.checkDraft();

		if (this.authStore.isPendingVerification()) {
			this.currentStep = 3;
			this.startCountdown();
		}

		this.socialAuthService.authState.subscribe((user) => {
			if (user && user.idToken && this.currentStep === 2) {
				if (!this.selectedAccountType) {
					this.errorMessage = 'الرجاء اختيار نوع الحساب أولاً';
					return;
				}
				this.isSubmitting = true;
				this.errorMessage = '';
				this.cdr.detectChanges();

				this.authApi.googleAuth(user.idToken, this.accountTypeMap[this.selectedAccountType]).subscribe({
					next: (res) => {
						this.isSubmitting = false;
						this.cdr.detectChanges();
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
						this.errorMessage = err.error?.message || err.message || 'حدث خطأ أثناء التسجيل بجوجل';
						this.cdr.detectChanges();
					}
				});
			}
		});
	}

	ngAfterViewInit() {
		this.cdr.detectChanges();
	}

	ngOnDestroy() {
		if (this.countdownTimer) clearInterval(this.countdownTimer);
	}

	private checkDraft() {
		try {
			const draft = localStorage.getItem(this.draftKey);
			if (draft) {
				const data = JSON.parse(draft);
				if (data && (data.firstName || data.email || data.phone)) {
					this.showDraftBanner = true;
					this.cdr.detectChanges();
				}
			}
		} catch {}
	}

	restoreDraft() {
		try {
			const draft = localStorage.getItem(this.draftKey);
			if (draft) {
				const data = JSON.parse(draft);
				if (data.accountType) {
					this.selectedAccountType = data.accountType;
				}
				if (data.basicInfo) {
					this.basicInfoForm.patchValue(data.basicInfo);
				}
				this.currentStep = 2;
			}
		} catch {}
		this.showDraftBanner = false;
		this.cdr.detectChanges();
	}

	dismissDraft() {
		this.showDraftBanner = false;
		try { localStorage.removeItem(this.draftKey); } catch {}
		this.cdr.detectChanges();
	}

	selectAccountType(id: string) {
		const target = this.accountTypes.find(t => t.id === id);
		if (target?.disabled) return;
		this.selectedAccountType = id;
	}

	selectAndProceed(id: string) {
		const target = this.accountTypes.find(t => t.id === id);
		if (target?.disabled) return;
		this.selectedAccountType = id;
		this.nextStep();
	}

	nextStep() {
		if (this.currentStep === 1 && !this.selectedAccountType) return;

		// Validate Step 2 and Submit Registration
		if (this.currentStep === 2) {
			if (this.basicInfoForm.valid) {
				this.submitRegistration();
			} else {
				this.basicInfoForm.markAllAsTouched();
			}
			return;
		}

		if (this.currentStep < 3) {
			this.currentStep++;
		}
	}

	private submitRegistration() {
		this.isSubmitting = true;
		this.errorMessage = '';

		const val = this.basicInfoForm.value;
		const payload = {
			accountType: this.accountTypeMap[this.selectedAccountType],
			firstName: val.firstName,
			lastName: val.lastName,
			email: val.email,
			phoneCountryCode: val.phone?.dialCode || '+966',
			phoneNumber: val.phone?.number || '',
			password: val.password,
			agreedToTerms: !!(val.agreeData && val.agreeTerms)
		};

		this.authApi.register(payload).subscribe({
			next: () => {
				this.isSubmitting = false;
				this.currentStep = 3; // Move to OTP
				this.startCountdown();
				this.cdr.detectChanges();
			},
			error: (err) => {
				this.isSubmitting = false;
				this.errorMessage = err.error?.message || err.message || 'حدث خطأ في التسجيل';
				this.cdr.detectChanges();
			}
		});
	}

	prevStep() {
		if (this.currentStep > 1) {
			this.currentStep--;
		}
	}

	appleSignIn() {
		// Apple Sign-In is not wired to a backend endpoint yet — tell the user
		// instead of failing silently.
		this.appleNotice = 'التسجيل عبر آبل سيكون متاحاً قريباً، يمكنك المتابعة بجوجل أو بالبريد';
		this.cdr.detectChanges();
	}

	togglePassword() {
		this.showPassword = !this.showPassword;
	}

	toggleConfirmPassword() {
		this.showConfirmPassword = !this.showConfirmPassword;
	}

	onVerificationSubmit() {
		if (this.verificationForm.valid) {
			const pendingUserId = this.authStore.pendingUserId();
			if (!pendingUserId) {
				this.errorMessage = 'فقدت جلسة التفعيل. يرجى التسجيل مرة أخرى.';
				return;
			}

			this.isSubmitting = true;
			this.errorMessage = '';

			const val = this.verificationForm.value;
			const code = `${val.code1}${val.code2}${val.code3}${val.code4}${val.code5}${val.code6}`;

			this.authApi.verifyOtp({ userId: pendingUserId, code }).subscribe({
				next: () => {
					this.isSubmitting = false;
					this.cdr.detectChanges();
					this.router.navigate(['/client-overview']);
				},
				error: (err) => {
					this.isSubmitting = false;
					this.errorMessage = err.error?.message || err.message || 'رمز التحقق غير صحيح';
					this.cdr.detectChanges();
				}
			});
		}
	}

	autoFocusNext(event: any, nextElementId: string) {
		if (event.target.value.length === 1 && nextElementId) {
			const nextElement = document.getElementById(nextElementId);
			if (nextElement) {
				nextElement.focus();
			}
		}
	}

	startCountdown() {
		this.countdown = 60;
		if (this.countdownTimer) clearInterval(this.countdownTimer);
		this.countdownTimer = setInterval(() => {
			if (this.countdown > 0) {
				this.countdown--;
				this.cdr.detectChanges();
			} else {
				clearInterval(this.countdownTimer);
			}
		}, 1000);
	}

	resendOtp() {
		if (this.countdown > 0 || this.isSubmitting) return;

		const pendingUserId = this.authStore.pendingUserId();
		if (!pendingUserId) return;

		this.isSubmitting = true;
		this.errorMessage = '';

		this.authApi.resendOtp(pendingUserId).subscribe({
			next: () => {
				this.isSubmitting = false;
				this.startCountdown();
				this.cdr.detectChanges();
			},
			error: (err) => {
				this.isSubmitting = false;
				this.errorMessage = err.error?.message || err.message || 'حدث خطأ أثناء الإرسال';
				this.cdr.detectChanges();
			}
		});
	}

	passwordMatchValidator(g: FormGroup) {
		const password = g.get('password')?.value;
		const confirmPassword = g.get('confirmPassword')?.value;
		if (!confirmPassword) return null;
		return password === confirmPassword ? null : { mismatch: true };
	}

	get passwordStrength() {
		const pwd = this.basicInfoForm.get('password')?.value || '';
		if (!pwd) return { score: 0, label: '', bgClass: '', textClass: '' };

		let score = 0;
		if (pwd.length >= 8) score += 1;
		if (/[A-Za-zا-ي]/.test(pwd)) score += 1;
		if (/[0-9]/.test(pwd)) score += 1;
		if (/[^A-Za-z0-9ا-ي\s]/.test(pwd)) score += 1;

		if (pwd.length < 8) score = Math.min(score, 1);

		switch (score) {
			case 1: return { score: 1, label: 'ضعيفة', bgClass: 'bg-red-500', textClass: 'text-red-500' };
			case 2: return { score: 2, label: 'متوسطة', bgClass: 'bg-orange-500', textClass: 'text-orange-500' };
			case 3: return { score: 3, label: 'مقبولة', bgClass: 'bg-[#2B7FFF]', textClass: 'text-[#2B7FFF]' };
			case 4: return { score: 4, label: 'قوية', bgClass: 'bg-[var(--teal)]', textClass: 'text-[var(--teal)]' };
			default: return { score: 0, label: '', bgClass: '', textClass: '' };
		}
	}
}
