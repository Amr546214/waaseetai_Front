import { Component, ElementRef, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, DestroyRef, ViewEncapsulation, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { AuthStore } from '../../../core/store/auth.store';
import { AccountType } from '../../../core/models/auth.model';
import { getWelcomeRoleKey } from '../../../core/guards/auth.guards';
import { PhoneInputComponent } from '../../../sheards/phone-input/phone-input.component';
import { GoogleBtnStateDirective } from '../../../shared/directives/google-btn-state.directive';
import { SocialAuthService, GoogleSigninButtonModule } from '@abacritt/angularx-social-login';
import { AffiliatePicker } from './affiliate-picker/affiliate-picker';
import { AffiliateApiService } from '../../../core/services/affiliate-api.service';
import { mapHttpError } from '../../../core/forms/http-error';
import { WaitTimerService, waitScope } from '../../../core/wait/wait-timer.service';
import { rateLimitSentence } from '../../../core/wait/wait-format';
import { formatClock } from '../../../core/wait/wait-format';
import { RATE_LIMIT_MESSAGE, isRateLimitError, startWaitFromError } from '../../../core/utils/rate-limit.util';
import { OTP_DELIVERY_HINT, REGISTER_CODE_STEP_MESSAGE, REGISTER_RESEND_MESSAGE } from '../../../core/forms/otp-delivery';
import { applyServerFieldErrors, attemptSubmit, InvalidField } from '../../../core/forms/form-helpers';
import { validationMessage } from '../../../core/forms/validation-messages';
import { matchFieldsValidator, strongPasswordValidator } from '../../../core/forms/password.validator';
import { backendPhoneValidator, phoneDigits } from '../../../core/forms/phone.validator';
import { FormSummaryComponent } from '../../../shared/forms/form-summary.component';

const REGISTER_LABELS: Record<string, string> = {
	firstName: 'الاسم الأول',
	lastName: 'اسم العائلة',
	email: 'البريد الإلكتروني',
	phone: 'رقم الجوال',
	password: 'كلمة المرور',
	confirmPassword: 'تأكيد كلمة المرور',
	agreeData: 'الإقرار بصحة البيانات',
	agreeTerms: 'الموافقة على شروط الاستخدام وسياسة الخصوصية',
};

const REGISTER_CONFIRM_REQUIRED = 'تأكيد كلمة المرور مطلوب';

@Component({
	selector: 'app-register',
	standalone: true,
	imports: [CommonModule, ReactiveFormsModule, RouterLink, PhoneInputComponent, GoogleSigninButtonModule, GoogleBtnStateDirective, AffiliatePicker, FormSummaryComponent],
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
	/** Honest delivery status of the activation code (shown on the OTP step). */
	otpNotice = '';
	/** What is missing after a failed submit attempt (shown by <ws-form-summary>). */
	missingFields: InvalidField[] = [];
	private readonly host = inject(ElementRef<HTMLElement>);

	// Set once /auth/google confirms a NEW Google identity (intent: register).
	// submitRegistration() sends it back as googleIdToken so the backend can
	// finish creating the account without a local password.
	private googleIdToken: string | null = null;
	isGoogleFlow = false;
	// Set on a 409 from /auth/google (intent: register) — the email already has
	// an account, so we point the user at the login page instead of retrying.
	accountExistsError = false;
	/** The account was created by a successful register call: going back never creates it (or its OTP request) a second time. */
	accountCreated = false;
	/** Registration data was already in use: honest generic note with links to login / password recovery (no code was sent, no code step). */
	/** The e-mail the registration request was sent for: the code step's key (the register answer carries no account id). */
	registeredEmail = '';
	private submittedSignature = '';
	private formSignature(): string { return JSON.stringify(this.basicInfoForm.getRawValue()); }

	// Optional single-tier referral attribution (P-LG-012), set by the
	// app-affiliate-picker below (manual code entry or name search — both
	// resolve to this one field). Sent as `affiliateIdentifier` on both the
	// email/password and Google registration paths; left undefined (never
	// '' or null) in the payload when nothing was picked.
	affiliateIdentifier: string | null = null;

	/** A marketer (affiliate) account is never attributed to another affiliate: the referral section is hidden and nothing is sent. */
	get isMarketerAccount(): boolean {
		return this.selectedAccountType === 'marketing_broker';
	}

	/** The referral identifier to send, or undefined (always undefined for a marketer account). */
	private get referralToSend(): string | undefined {
		return this.isMarketerAccount ? undefined : (this.affiliateIdentifier || this.linkReferralSlug || undefined);
	}

	// Locked attribution (P-LG-012): populated when GET /affiliates/referral-status
	// confirms a valid `waseet_ref_code` cookie server-side (the frontend cannot
	// and must not read that httpOnly cookie itself). When non-null, the
	// affiliate section renders as a read-only display instead of the
	// interactive app-affiliate-picker, and `affiliateIdentifier` above is
	// deliberately left untouched (never populated from this) — the actual
	// attribution happens entirely server-side at POST /auth/register via the
	// backend's own cookie read, so the frontend never carries or duplicates
	// the value, only displays it for the user's confirmation.
	private affiliateApi = inject(AffiliateApiService);
	private route = inject(ActivatedRoute);
	lockedAffiliate = signal<{ referralSlug: string; displayName: string } | null>(null);
	/** The REAL slug from `/auth/register?ref=<slug>` (a /ref/:slug visit). It is sent in the registration payload; the backend decides whether it attributes. */
	private linkReferralSlug: string | null = null;
	/** `/ref/:slug` of an unknown/expired slug (or a slug the backend could not resolve): said honestly, the signup continues without attribution. */
	referralInvalid = signal(false);

	/** Legacy key of a removed "restore previous data" draft (it could hold a typed password). Only ever purged now. */
	private static readonly LEGACY_DRAFT_KEY = 'waseet_register_draft';

	// The code step has THREE different timers, all from the server and keyed by the e-mail (identical for every address: nothing here depends on the account):
	//  - resend: when another code may be requested (resendAvailableAt of the register / resend answer, or a 429's Retry-After); disables ONLY the resend button,
	//    and the same wait guards a second POST /register for that e-mail (the server's send gate is shared).
	//  - validity: shown only if the server ever returns expiresAt (these answers do not, on purpose: the same shape for every address), so no validity timer here.
	//  - verify: only a 429 WITH a wait on the verification disables the confirm button. A wrong code starts nothing; OTP_ATTEMPTS_LOCKED has no timer.
	private readonly waits = inject(WaitTimerService);
	private readonly typedEmailKey = () => String(this.basicInfoForm?.get('email')?.value ?? '').trim().toLowerCase();
	/** Resend wait for the e-mail of the code step (registeredEmail). */
	readonly resendWait = this.waits.trackKeyed('otp-resend', () => this.registeredEmail, inject(DestroyRef));
	/** The same scope for the e-mail currently typed on step 2 (guards a repeated registration request). */
	readonly registerWait = this.waits.trackKeyed('otp-resend', this.typedEmailKey, inject(DestroyRef));
	readonly verifyWait = this.waits.trackKeyed('otp-verify', () => this.registeredEmail, inject(DestroyRef));
	/** A 429 whose duration the server did not state: an honest sentence without a number. */
	rateLimitedNoTime = false;
	private rateLimitSource: 'register' | 'resend' | 'verify' | 'google' | null = null;

	/** The server's wait after a 429 on Google sign-up (end timestamp, survives a refresh). Gates ONLY the Google button. */
	readonly googleWait = this.waits.track(waitScope('google-auth', 'register'), inject(DestroyRef));

	/** Seconds until another code may be requested (0 = available). */
	get countdown(): number { return this.resendWait().remainingSeconds(); }

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
		private socialAuthService: SocialAuthService,
		private destroyRef: DestroyRef
	) {
		this.basicInfoForm = this.fb.group({
			// Same rules as the backend registerSchema (auth.schema.ts): names 2+ chars, password 8+ with an
			// uppercase letter and a digit, phone digits only and at least 9.
			firstName: ['', [Validators.required, Validators.minLength(2)]],
			lastName: ['', [Validators.required, Validators.minLength(2)]],
			email: ['', [Validators.required, Validators.email]],
			phone: ['', [Validators.required, backendPhoneValidator]],
			password: ['', [Validators.required, strongPasswordValidator]],
			confirmPassword: ['', Validators.required],
			agreeData: [false, Validators.requiredTrue],
			agreeTerms: [false, Validators.requiredTrue]
		}, { validators: matchFieldsValidator('password', 'confirmPassword') });

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
		// Registration never restores earlier input: drop any draft an older version left in the browser.
		try { localStorage.removeItem(Register.LEGACY_DRAFT_KEY); } catch { /* storage unavailable */ }

		// Current-visit attribution. A real referral link (/ref/:slug) lands here with `?ref=1`; the marker stays in the URL,
		// so a refresh keeps the referrer. Only then is the (httpOnly) referral cookie read for the locked box, as before.
		// Opened WITHOUT the marker (typed/bookmarked/navigated, even right after an earlier referral visit): the old cookie
		// is cleared first, so no locked box is shown, the normal optional picker renders, and the signup cannot be
		// attributed from a previous visit. Both calls fail open: they must never block or degrade registration.
		const refParam = (this.route.snapshot.queryParamMap.get('ref') ?? '').trim();
		if (refParam && refParam !== '1') {
			// The real slug of a referral link: keep it for the payload and show the referrer when it resolves.
			this.linkReferralSlug = refParam.slice(0, 100);
			this.affiliateApi.resolve(this.linkReferralSlug).subscribe({
				next: (res) => {
					if (res.success && res.data?.displayName) {
						this.lockedAffiliate.set({ referralSlug: res.data.referralSlug || this.linkReferralSlug!, displayName: res.data.displayName });
						this.cdr.markForCheck();
					}
				},
				error: (err) => {
					// 404 = no such (active) marketer: no attribution, said honestly. Any other failure fails open (the backend still decides).
					if (err?.status === 404) { this.linkReferralSlug = null; this.referralInvalid.set(true); this.cdr.markForCheck(); }
				}
			});
		} else if (refParam === '1') {
			this.affiliateApi.getReferralStatus().subscribe({
				next: (res) => {
					if (res.success && res.data?.active && res.data.referralSlug && res.data.displayName) {
						this.lockedAffiliate.set({ referralSlug: res.data.referralSlug, displayName: res.data.displayName });
						this.cdr.markForCheck();
					}
				},
				error: () => {
					// Fail open — leave lockedAffiliate() null, normal picker renders.
				}
			});
		} else {
			if (this.route.snapshot.queryParamMap.has('ref_invalid')) this.referralInvalid.set(true);
			this.affiliateApi.clearReferralCookie().subscribe({ error: () => { /* fail open: nothing to show or block */ } });
		}

		// Note: pendingUserId (set after a successful registration submit, or by
		// an unverified login) is intentionally NOT used here to auto-jump to
		// step 3. It can survive for days (cookie) or indefinitely (localStorage)
		// after someone abandons an OTP mid-flow, which would otherwise force
		// every later visit to /auth/register straight into OTP entry instead of
		// showing the account-type picker — even when the user's intent is to
		// start a brand new registration. The happy-path jump to step 3 within
		// the same session is handled directly by submitRegistration() instead.

		// CRITICAL (part 1 — stale subscription leak): SocialAuthService.authState
		// is a single app-wide ReplaySubject(1) singleton, and this subscription
		// is set up in ngOnInit (re-created every time this page is visited).
		// Without takeUntilDestroyed(), navigating away never unsubscribes it —
		// the closure leaks and stays alive for the rest of the tab session,
		// permanently frozen at whatever `currentStep`/`selectedAccountType` it
		// had when the page was last left. A later, unrelated Google sign-in
		// event fired from a completely different page (e.g. Login) would then
		// ALSO reach this leaked handler. Real incident: visiting /auth/login
		// earlier in the same tab left ITS leaked subscription alive, so a
		// subsequent Sign Up + Google for an EXISTING account was silently
		// logged in by that stale handler (intent:'login' always succeeds for
		// an existing account) racing against this page's own correct 409
		// handling.
		//
		// CRITICAL (part 2 — replay-on-subscribe): takeUntilDestroyed() alone
		// is NOT sufficient. Being a ReplaySubject(1), EVERY brand-new
		// subscription (e.g. arriving back at THIS page) immediately,
		// synchronously receives whatever Google credential was last emitted
		// anywhere in the app, even if the user never touched this page's
		// Google button this visit. Google's real sign-in flow is always
		// asynchronous, so a value delivered SYNCHRONOUSLY during
		// .subscribe() itself can only be a replayed leftover, never a
		// genuine action on this instance — `allowProcessing` starts false
		// and is flipped true only after .subscribe() returns.
		let allowProcessing = false;
		this.socialAuthService.authState.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((user) => {
			if (!allowProcessing) return;
			if (user && user.idToken && this.currentStep === 2) {
				if (!this.selectedAccountType) {
					this.errorMessage = 'الرجاء اختيار نوع الحساب أولاً';
					return;
				}
				if (this.googleWait.active()) return;
				this.rateLimitedNoTime = false;
				this.isSubmitting = true;
				this.errorMessage = '';
				this.accountExistsError = false;
				this.cdr.markForCheck();

				this.authApi.googleAuth(user.idToken, 'register', this.accountTypeMap[this.selectedAccountType], this.referralToSend).subscribe({
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
						if (isRateLimitError(err)) {
							this.rateLimitSource = 'google';
							const end = startWaitFromError(this.googleWait, err);
							this.rateLimitedNoTime = end == null || !this.googleWait.active();
							this.errorMessage = '';
							this.cdr.markForCheck();
							return;
						}
						const mapped = mapHttpError(err, { unauthorizedIs: 'credentials', fallback: 'حدث خطأ أثناء التسجيل بجوجل' });
						if (err.status === 409) {
							this.accountExistsError = true;
							this.errorMessage = /[\u0600-\u06FF]/.test(err.error?.message || '') ? err.error.message : 'هذا الحساب موجود بالفعل، يرجى تسجيل الدخول';
						} else {
							this.errorMessage = mapped.message;
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

	ngAfterViewInit() {
		this.cdr.markForCheck();
	}

	ngOnDestroy() {
		// Handles release their share of the central clock with the component's DestroyRef; the stored end timestamps stay for a return visit.
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

	selectAccountType(id: string) {
		const target = this.accountTypes.find(t => t.id === id);
		if (target?.disabled || this.accountCreated) return; // the type of an account that already exists cannot change here
		this.selectedAccountType = id;
	}

	selectAndProceed(id: string) {
		const target = this.accountTypes.find(t => t.id === id);
		if (target?.disabled) return;
		if (!this.accountCreated) this.selectedAccountType = id;
		this.nextStep();
	}

	nextStep() {
		if (this.currentStep === 1 && !this.selectedAccountType) return;

		// Validate Step 2 and Submit Registration
		if (this.currentStep === 2) {
			// Back from the OTP step shows the saved data again; continuing with the SAME data only returns to the OTP step (no second request).
			// Edited data (e.g. a mistyped e-mail) is a new registration request.
			if (this.accountCreated && this.formSignature() === this.submittedSignature) { this.currentStep = 3; this.errorMessage = ''; this.cdr.markForCheck(); return; }
			// a second tap / Enter while the first request is still running must not send a second registration
			if (this.isSubmitting) return;
			// the server's send wait for this e-mail is still running: no request, the remaining time is said (the server still has the last word afterwards)
			if (this.registerWait().active()) { this.rateLimitSource = 'register'; this.errorMessage = ''; this.cdr.markForCheck(); return; }
			this.errorMessage = '';
			this.accountExistsError = false;
			const attempt = attemptSubmit(this.basicInfoForm, { root: this.host.nativeElement, labels: REGISTER_LABELS });
			this.missingFields = attempt.missing;
			if (attempt.valid) {
				this.submitRegistration();
			} else {
				this.cdr.markForCheck();
			}
			return;
		}

		if (this.currentStep < 3) {
			this.currentStep++;
		}
	}

	private submitRegistration() {
		if (this.isSubmitting) return;
		this.isSubmitting = true;
		this.errorMessage = '';

		const val = this.basicInfoForm.value;
		const payload = {
			accountType: this.accountTypeMap[this.selectedAccountType],
			firstName: val.firstName,
			lastName: val.lastName,
			email: val.email,
			phoneCountryCode: val.phone?.dialCode || '+966',
			phoneNumber: phoneDigits(val.phone?.number),
			password: this.isGoogleFlow ? undefined : val.password,
			googleIdToken: this.isGoogleFlow ? this.googleIdToken || undefined : undefined,
			agreedToTerms: !!(val.agreeData && val.agreeTerms),
			affiliateIdentifier: this.referralToSend
		};

		this.rateLimitedNoTime = false;
		this.rateLimitSource = null;
		this.authApi.register(payload).subscribe({
			next: (res) => {
				this.isSubmitting = false;
				// One answer for every outcome: the page cannot tell a new address from one already in use, so the code step always opens, keyed by the
				// typed e-mail, with neutral wording (the links on the step lead existing accounts to login / password recovery). The data is kept and
				// shown (and editable: a mistyped e-mail is corrected by submitting again); Back + Continue with unchanged data returns here without a second request.
				this.registeredEmail = String(val.email ?? '').trim().toLowerCase();
				this.accountCreated = true;
				this.submittedSignature = this.formSignature();
				this.currentStep = 3;
				this.otpNotice = REGISTER_CODE_STEP_MESSAGE;
				// the server applies the same cooldown to every address and says when the next send is allowed
				this.resendWait().startFromResponse(res);
				this.cdr.markForCheck();
			},
			error: (err) => {
				this.isSubmitting = false;
				if (isRateLimitError(err)) {
					// a wait from the server for this e-mail; the typed data stays, no generic error is added
					this.rateLimitSource = 'register';
					const end = startWaitFromError(this.registerWait(), err);
					this.rateLimitedNoTime = end == null || !this.registerWait().active();
					this.errorMessage = '';
					this.cdr.markForCheck();
					return;
				}
				const mapped = mapHttpError(err, { unauthorizedIs: 'credentials', fallback: 'حدث خطأ في التسجيل' });
				// Server field messages (zod) land on the matching inputs; the rest go to the banner.
				const unmatched = applyServerFieldErrors(this.basicInfoForm, mapped.fieldErrors);
				this.accountExistsError = mapped.kind === 'conflict';
				this.errorMessage = unmatched.length || !Object.keys(mapped.fieldErrors).length
					? mapped.message
					: 'يرجى تصحيح الحقول المحددة أدناه';
				if (Object.keys(mapped.fieldErrors).length) {
					this.missingFields = [];
					setTimeout(() => attemptSubmit(this.basicInfoForm, { root: this.host.nativeElement, labels: REGISTER_LABELS }));
				}
				this.cdr.markForCheck();
			}
		});
	}

	prevStep() {
		if (this.currentStep > 1) {
			this.currentStep--;
		}
	}

	togglePassword() {
		this.showPassword = !this.showPassword;
	}

	toggleConfirmPassword() {
		this.showConfirmPassword = !this.showConfirmPassword;
	}

	onVerificationSubmit() {
		if (this.verificationForm.invalid) {
			// Never a silent no-op: say what is needed and put the cursor on the first empty box.
			this.verificationForm.markAllAsTouched();
			this.errorMessage = 'أدخل رمز التحقق المكوّن من 6 أرقام';
			this.focusOtpInput(this.otpIndexes.find(i => !this.otpDigit(i)) ?? 0);
			this.cdr.markForCheck();
			return;
		}
		{
			if (!this.registeredEmail) {
				this.errorMessage = 'فقدت جلسة التفعيل. يرجى التسجيل مرة أخرى.';
				this.cdr.markForCheck();
				return;
			}

			if (this.verifyWait().active()) return;
			this.isSubmitting = true;
			this.errorMessage = '';
			this.rateLimitedNoTime = false;
			this.cdr.markForCheck();

			const val = this.verificationForm.value;
			const code = `${val.code1}${val.code2}${val.code3}${val.code4}${val.code5}${val.code6}`;

			this.authApi.verifyOtp({ email: this.registeredEmail, code }).subscribe({
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
					if (err?.error?.code === 'OTP_ATTEMPTS_LOCKED') {
						// too many wrong codes: the message asks for a NEW code; no timer
						this.errorMessage = err.error.message || 'تم تجاوز عدد المحاولات المسموح به، يرجى طلب رمز جديد';
					} else if (isRateLimitError(err)) {
						this.rateLimitSource = 'verify';
						const end = startWaitFromError(this.verifyWait(), err);
						this.rateLimitedNoTime = end == null || !this.verifyWait().active();
					} else {
						// a wrong / expired code: a message only, never a UI wait
						this.errorMessage = mapHttpError(err, { unauthorizedIs: 'credentials', fallback: 'رمز التحقق غير صحيح' }).message;
					}
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

	get formattedCountdown() { return formatClock(this.countdown); }

	/** «طلبات كثيرة، يمكنك إعادة المحاولة بعد 1:23» (ticking) while a server wait for the active action runs; the honest no-time sentence after a 429 without one; '' otherwise. */
	get rateLimitText(): string {
		if (this.rateLimitSource === 'google' && this.googleWait.active()) return rateLimitSentence(this.googleWait.remainingSeconds(), true);
		const w = this.rateLimitSource === 'verify' ? this.verifyWait() : this.rateLimitSource === 'register' ? this.registerWait() : this.rateLimitSource === 'resend' ? this.resendWait() : null;
		if (w?.active()) return rateLimitSentence(w.remainingSeconds(), true);
		return this.rateLimitedNoTime ? RATE_LIMIT_MESSAGE : '';
	}

	resendOtp() {
		if (this.resendWait().active() || this.isSubmitting) return;

		if (!this.registeredEmail) {
			this.errorMessage = 'فقدت جلسة التفعيل. يرجى التسجيل مرة أخرى.';
			this.cdr.markForCheck();
			return;
		}

		this.isSubmitting = true;
		this.errorMessage = '';

		this.otpNotice = '';
		this.rateLimitedNoTime = false;
		this.rateLimitSource = null;
		this.authApi.resendOtpByEmail(this.registeredEmail).subscribe({
			next: (res) => {
				this.isSubmitting = false;
				// generic always-200: the page claims only the condition, and the cooldown (from the server's resendAvailableAt) is the same for every address
				this.otpNotice = REGISTER_RESEND_MESSAGE;
				this.resendWait().startFromResponse(res);
				this.cdr.markForCheck();
			},
			error: (err) => {
				this.isSubmitting = false;
				if (isRateLimitError(err)) {
					// keep resend locked until the end the server gave; no stated time = honest sentence, button stays usable
					this.rateLimitSource = 'resend';
					const end = startWaitFromError(this.resendWait(), err);
					this.rateLimitedNoTime = end == null || !this.resendWait().active();
				} else {
					this.errorMessage = mapHttpError(err, { unauthorizedIs: 'credentials', fallback: 'حدث خطأ أثناء الإرسال' }).message;
				}
				this.cdr.markForCheck();
			}
		});
	}

	/** Masked email for the verification step, same format as the design (P-AU-009 maskEmail). */
	readonly deliveryHint = OTP_DELIVERY_HINT;

	get maskedEmail(): string {
		const e: string = this.basicInfoForm.get('email')?.value || '';
		if (!e || e.indexOf('@') < 0) return '';
		const [name, domain] = e.split('@');
		const mn = name.length > 2 ? name[0] + '***' + name.slice(-1) : name[0] + '*';
		const dp = domain.split('.');
		const md = dp[0].length > 2 ? dp[0].slice(0, 2) + '***' : dp[0][0] + '*';
		return mn + '@' + md + (dp.length > 1 ? '.' + dp.slice(1).join('.') : '');
	}

	/** Arabic message for a field of the sign-up form (shown once touched, or after a submit attempt). */
	fieldError(name: string): string | null {
		const c = this.basicInfoForm.get(name);
		if (!c || !(c.touched || c.dirty) || c.valid) return null;
		if ((name === 'agreeData' || name === 'agreeTerms') && c.errors?.['required']) {
			return name === 'agreeTerms'
				? 'يجب الموافقة على شروط الاستخدام وسياسة الخصوصية للمتابعة'
				: 'يجب الإقرار بصحة البيانات للمتابعة';
		}
		return validationMessage(c.errors, REGISTER_LABELS[name]);
	}

	/** Cross-field message (password confirmation). */
	get confirmMismatchError(): string | null {
		const control = this.basicInfoForm.get('confirmPassword');
		const touched = control?.touched || this.basicInfoForm.touched;
		if (!touched) return null;
		// an empty confirmation has its own message under the field (it used to show nothing: only a mismatch was worded)
		if (control?.enabled && !control.value) return REGISTER_CONFIRM_REQUIRED;
		return this.basicInfoForm.hasError('mismatch') ? 'كلمة المرور وتأكيدها غير متطابقتين' : null;
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
