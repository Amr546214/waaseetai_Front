import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { AuthStore } from '../../../core/store/auth.store';
import { AccountType } from '../../../core/models/auth.model';
import { getWelcomeRoleKey } from '../../../core/guards/auth.guards';
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

	// Set once /auth/google confirms a NEW Google identity (intent: register).
	// submitRegistration() sends it back as googleIdToken so the backend can
	// finish creating the account without a local password.
	private googleIdToken: string | null = null;
	isGoogleFlow = false;
	// Set on a 409 from /auth/google (intent: register) — the email already has
	// an account, so we point the user at the login page instead of retrying.
	accountExistsError = false;

	// Draft restoration
	showDraftBanner = false;
	private draftKey = 'waseet_register_draft';

	countdown = 90;
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

		// Note: pendingUserId (set after a successful registration submit, or by
		// an unverified login) is intentionally NOT used here to auto-jump to
		// step 3. It can survive for days (cookie) or indefinitely (localStorage)
		// after someone abandons an OTP mid-flow, which would otherwise force
		// every later visit to /auth/register straight into OTP entry instead of
		// showing the account-type picker — even when the user's intent is to
		// start a brand new registration. The happy-path jump to step 3 within
		// the same session is handled directly by submitRegistration() instead.

		this.socialAuthService.authState.subscribe((user) => {
			if (user && user.idToken && this.currentStep === 2) {
				if (!this.selectedAccountType) {
					this.errorMessage = 'الرجاء اختيار نوع الحساب أولاً';
					return;
				}
				this.isSubmitting = true;
				this.errorMessage = '';
				this.accountExistsError = false;
				this.cdr.markForCheck();

				this.authApi.googleAuth(user.idToken, this.accountTypeMap[this.selectedAccountType]).subscribe({
					next: (res) => {
						this.isSubmitting = false;
						this.cdr.markForCheck();

						if (res.data?.registrationRequired && res.data.googleProfile) {
							// New Google identity: no account was created yet. Store the
							// idToken to forward on submit and switch the form into
							// "complete your profile" mode instead of routing to /welcome
							// as if signup already succeeded.
							this.googleIdToken = user.idToken ?? null;
							this.applyGoogleProfile(res.data.googleProfile);
							return;
						}

						// Defensive fallback: the backend never returns a token/user for
						// intent 'register', but if that ever changes, still route home
						// correctly instead of silently doing nothing.
						const authedUser = res.data?.user || this.authStore.currentUser();
						if (authedUser) {
							this.router.navigate(['/auth/welcome'], {
								queryParams: {
									role: getWelcomeRoleKey(authedUser.accountType),
									accountType: authedUser.accountType,
									activeRole: authedUser.activeRole
								}
							});
						}
					},
					error: (err) => {
						this.isSubmitting = false;
						if (err.status === 409) {
							this.accountExistsError = true;
							this.errorMessage = err.error?.message || 'هذا الحساب موجود بالفعل، يرجى تسجيل الدخول';
						} else {
							this.errorMessage = err.error?.message || err.message || 'حدث خطأ أثناء التسجيل بجوجل';
						}
						this.cdr.markForCheck();
					}
				});
			}
		});
	}

	ngAfterViewInit() {
		this.cdr.markForCheck();
	}

	ngOnDestroy() {
		if (this.countdownTimer) clearInterval(this.countdownTimer);
	}

	/** Switches step 2 into "complete your Google signup" mode: pre-fills the
	 * verified identity fields and drops the password requirement, since the
	 * account will be created with googleIdToken instead of a local password. */
	private applyGoogleProfile(profile: { email: string; firstName: string; lastName: string }) {
		this.isGoogleFlow = true;
		this.errorMessage = '';
		this.basicInfoForm.patchValue({
			firstName: profile.firstName,
			lastName: profile.lastName,
			email: profile.email
		});
		const password = this.basicInfoForm.get('password');
		const confirmPassword = this.basicInfoForm.get('confirmPassword');
		password?.setValue('');
		password?.clearValidators();
		password?.updateValueAndValidity();
		confirmPassword?.setValue('');
		confirmPassword?.clearValidators();
		confirmPassword?.updateValueAndValidity();
		this.cdr.markForCheck();
	}

	private checkDraft() {
		try {
			const draft = localStorage.getItem(this.draftKey);
			if (draft) {
				const data = JSON.parse(draft);
				if (data && (data.firstName || data.email || data.phone)) {
					this.showDraftBanner = true;
					this.cdr.markForCheck();
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
		this.cdr.markForCheck();
	}

	dismissDraft() {
		this.showDraftBanner = false;
		try { localStorage.removeItem(this.draftKey); } catch {}
		this.cdr.markForCheck();
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
			password: this.isGoogleFlow ? undefined : val.password,
			googleIdToken: this.isGoogleFlow ? this.googleIdToken || undefined : undefined,
			agreedToTerms: !!(val.agreeData && val.agreeTerms)
		};

		this.authApi.register(payload).subscribe({
			next: () => {
				this.isSubmitting = false;
				this.currentStep = 3; // Move to OTP
				this.startCountdown();
				this.cdr.markForCheck();
			},
			error: (err) => {
				this.isSubmitting = false;
				this.errorMessage = err.error?.message || err.message || 'حدث خطأ في التسجيل';
				this.cdr.markForCheck();
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
		this.cdr.markForCheck();
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
				this.cdr.markForCheck();
				return;
			}

			this.isSubmitting = true;
			this.errorMessage = '';
			this.cdr.markForCheck();

			const val = this.verificationForm.value;
			const code = `${val.code1}${val.code2}${val.code3}${val.code4}${val.code5}${val.code6}`;

			this.authApi.verifyOtp({ userId: pendingUserId, code }).subscribe({
				next: (res) => {
					this.isSubmitting = false;
					this.cdr.markForCheck();
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
					this.errorMessage = err.error?.message || err.message || 'رمز التحقق غير صحيح';
					this.cdr.markForCheck();
				}
			});
		}
	}

	// OTP boxes behave like the reset-password and checkout confirm pages:
	// digits only, Arabic/Persian digits normalized to English, full-code paste
	// from any box, Backspace walks back, Enter submits.
	readonly otpIndexes = [0, 1, 2, 3, 4, 5];

	otpDigit(index: number): string {
		return this.verificationForm.get(`code${index + 1}`)?.value ?? '';
	}

	onOtpInput(index: number, event: Event) {
		const input = event.target as HTMLInputElement;
		const raw = this.normalizeDigits(input.value);

		if (raw.length > 1) {
			this.fillOtpFrom(raw);
			return;
		}

		this.verificationForm.get(`code${index + 1}`)?.setValue(raw);
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
				this.verificationForm.get(`code${index + 1}`)?.setValue('');
			} else if (index > 0) {
				this.verificationForm.get(`code${index}`)?.setValue('');
				this.focusOtpInput(index - 1);
			}
			this.cdr.markForCheck();
		} else if (event.key === 'Enter') {
			event.preventDefault();
			this.onVerificationSubmit();
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
		this.otpIndexes.forEach(i => this.verificationForm.get(`code${i + 1}`)?.setValue(digits[i] ?? ''));
		this.errorMessage = '';
		this.cdr.markForCheck();
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

	get formattedCountdown() {
		const m = Math.floor(this.countdown / 60);
		const s = this.countdown % 60;
		return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
	}

	startCountdown() {
		this.countdown = 90;
		if (this.countdownTimer) clearInterval(this.countdownTimer);
		this.countdownTimer = setInterval(() => {
			if (this.countdown > 0) {
				this.countdown--;
			} else {
				clearInterval(this.countdownTimer);
			}
			this.cdr.markForCheck();
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
				this.cdr.markForCheck();
			},
			error: (err) => {
				this.isSubmitting = false;
				this.errorMessage = err.error?.message || err.message || 'حدث خطأ أثناء الإرسال';
				this.cdr.markForCheck();
			}
		});
	}

	/** Masked email for the verification step, same format as the design (P-AU-009 maskEmail). */
	get maskedEmail(): string {
		const e: string = this.basicInfoForm.get('email')?.value || '';
		if (!e || e.indexOf('@') < 0) return '';
		const [name, domain] = e.split('@');
		const mn = name.length > 2 ? name[0] + '***' + name.slice(-1) : name[0] + '*';
		const dp = domain.split('.');
		const md = dp[0].length > 2 ? dp[0].slice(0, 2) + '***' : dp[0][0] + '*';
		return mn + '@' + md + (dp.length > 1 ? '.' + dp.slice(1).join('.') : '');
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
			case 2: return { score: 2, label: 'مقبولة', bgClass: 'bg-orange-500', textClass: 'text-orange-500' };
			case 3: return { score: 3, label: 'جيدة', bgClass: 'bg-[#2B7FFF]', textClass: 'text-[#2B7FFF]' };
			case 4: return { score: 4, label: 'قوية', bgClass: 'bg-[var(--teal)]', textClass: 'text-[var(--teal)]' };
			default: return { score: 0, label: '', bgClass: '', textClass: '' };
		}
	}
}
