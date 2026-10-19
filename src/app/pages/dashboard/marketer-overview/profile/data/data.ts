import { Component, ElementRef, inject, OnInit, signal, computed } from '@angular/core';
import { MarketerLevelTagComponent } from '../../../../../shared/levels/marketer-level-tag.component';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { MarketerOverviewService, MarketerSummary, ChannelPerformance, CommissionLog, MarketerSettings } from '../../../../../core/services/marketer-overview.service';
import { MarketerProfileService, MarketerProfile, AffiliateChannelHandle } from '../../../../../core/services/marketer-profile.service';
import { MarketerPrefsStore } from '../../../../../core/services/marketer-prefs.store';
import { PROVIDER_TIMEZONES } from '../../../../../core/services/provider-prefs.store';
import { canonicalStoredPhone, parseStoredPhone, phoneCountryView, phoneToE164 } from '../../../../../core/forms/phone-countries';
import { paypalEmailOptionalValidators } from '../../../../../core/validators/paypal-email.validator';
import { buildReferralUrl } from '../../../../../core/utils/referral-link.util';
import { BioFieldDirective } from '../../../../../shared/directives/bio-field.directive';
import { applyServerFieldErrors, attemptSubmit, collectInvalidFields, focusFirstInvalid, InvalidField } from '../../../../../core/forms/form-helpers';
import { validateFile, MB } from '../../../../../core/forms/file-validation';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { FieldErrorComponent } from '../../../../../shared/forms/field-error.component';
import { FormSummaryComponent } from '../../../../../shared/forms/form-summary.component';
import { PhoneInputComponent } from '../../../../../sheards/phone-input/phone-input.component';
import type { CountryCode } from 'libphonenumber-js/mobile';
import { MarketerKycCard } from '../kyc-document/marketer-kyc-card';
import { CompletionBoxComponent, CompletionBoxItem } from '../../../../../shared/forms/completion-box.component';

const LABELS: Record<string, string> = {
	bio: 'الوصف التسويقي',
	platform: 'نوع القناة',
	handle: 'معرّف القناة أو رابطها',
	paypalPayoutEmail: 'بريد PayPal',
	alternativePhone: 'رقم WhatsApp',
	firstName: 'الاسم الأول',
	lastName: 'اسم العائلة',
	nationalId: 'رقم الهوية الوطنية',
	currentPassword: 'كلمة المرور الحالية',
	newPassword: 'كلمة المرور الجديدة',
	confirmPassword: 'تأكيد كلمة المرور الجديدة',
};

const PASSWORD_RULE_MESSAGE = 'كلمة المرور الجديدة يجب أن تتكون من 8 إلى 72 حرفًا وتحتوي على ثلاثة أنواع على الأقل: أحرف صغيرة، أحرف كبيرة، أرقام، رموز';

/** Backend rule (provider-profile.service changePassword): at least 3 of 4 character groups. */
function characterGroups(value: string): number {
	return [/[a-z]/.test(value), /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length;
}

const passwordGroupsValidator = (control: AbstractControl): ValidationErrors | null => {
	const v = String(control.value ?? '');
	return v && characterGroups(v) < 3 ? { groups: true } : null;
};

/** Whitespace-only counts as empty (the backend trims and would see nothing). */
const notBlank = (control: AbstractControl): ValidationErrors | null =>
	typeof control.value === 'string' && control.value.length > 0 && control.value.trim() === '' ? { required: true } : null;

const confirmMatchesValidator = (control: AbstractControl): ValidationErrors | null => {
	const other = control.parent?.get('newPassword')?.value;
	return control.value && control.value !== other ? { mismatch: true } : null;
};



const hasArabic = (s: unknown): s is string => typeof s === 'string' && /[؀-ۿ]/.test(s);

/** Shown while nothing is saved (the same defaults the server applies): in-app on, e-mail off, both event alerts on, Arabic, the browser's own timezone. */
const DEFAULT_MARKETER_SETTINGS: MarketerSettings = { inApp: true, email: false, newReferral: true, newCommission: true, communicationLanguage: 'ar', timezone: null };

/** The zones the marketer can pick (the same list the server accepts). */
export const MARKETER_TIMEZONE_OPTIONS: { value: string; label: string }[] = PROVIDER_TIMEZONES.map(z => ({ value: z, label: ({ 'Asia/Riyadh': 'توقيت الرياض (GMT+3)', 'Asia/Dubai': 'توقيت دبي (GMT+4)', 'Asia/Kuwait': 'توقيت الكويت (GMT+3)', 'Africa/Cairo': 'توقيت القاهرة', 'Asia/Amman': 'توقيت عمّان', GMT: 'توقيت غرينتش (GMT)' } as Record<string, string>)[z] ?? z }));

@Component({
	selector: 'app-data',
	standalone: true,
	imports: [MarketerLevelTagComponent, CommonModule, ReactiveFormsModule, FormsModule, RouterLink, BioFieldDirective, FieldErrorComponent, FormSummaryComponent, CompletionBoxComponent, MarketerKycCard, PhoneInputComponent],
	templateUrl: './data.html',
	styleUrl: './data.css',
})
export class Data implements OnInit {
	private fb = inject(FormBuilder);
	private router = inject(Router);
	private overviewService = inject(MarketerOverviewService);
	private profileService = inject(MarketerProfileService);
	private prefsStore = inject(MarketerPrefsStore);
	private readonly host = inject(ElementRef<HTMLElement>);
	private readonly notify = inject(UiNotificationService);

	/** What is missing after a failed save attempt (shown by <ws-form-summary> next to the tab's main button). */
	missing = signal<InvalidField[]>([]);
	/** Same, for the "add channel" mini-form on the profile tab. */
	channelMissing = signal<InvalidField[]>([]);
	/** The WhatsApp card's own error summary (rendered inside that card, not in the identity card). */
	whatsappMissing = signal<InvalidField[]>([]);
	/** Inline Arabic message near the active tab's button (nothing changed / pending request exists / server answer). */
	tabNotice = signal<string | null>(null);
	/** Avatar file rejected on the client (type/size/read), shown under the picture. */
	avatarError = signal<string | null>(null);
	/** UI-only: the backend filed the request and it waits for review (a toast alone is easy to miss). */
	/** set right after a request is sent; after a refresh the same state comes from the profile read (reviewStatus.basicInfo) */
	private identitySentNow = signal(false);
	identityPending = computed(() => this.identitySentNow() || this.profile()?.reviewStatus?.basicInfo?.status === 'PENDING_REVIEW');
	/** the admin's reason when the last request was rejected (and no new one is waiting): the form stays open for a new request */
	identityRejection = computed(() => {
		const e = this.profile()?.reviewStatus?.basicInfo;
		return e?.status === 'REJECTED' && !this.identityPending() ? (e.rejectionReason || 'لم يستوفِ الطلب متطلبات التحقق') : null;
	});
	alertsLoadFailed = signal(false);

	summary = signal<MarketerSummary | null>(null);
	profile = signal<MarketerProfile | null>(null);
	/** The account phone is display-only (flag + country + code + local number): immutable from the interface. */
	phoneView = computed(() => { const u = this.profile()?.user as { phoneCountryCode?: string | null; phoneNumber?: string | null } | undefined; return phoneCountryView(canonicalStoredPhone(u?.phoneCountryCode, u?.phoneNumber)); });
	channels = signal<AffiliateChannelHandle[]>([]);

	activeTab = signal<string>('profile');
	copiedField = signal<string>('');


	savingProfile = signal<boolean>(false);
	savingPaypal = signal<boolean>(false);
	savingWhatsapp = signal<boolean>(false);
	/** Region of the account phone: the default country of an empty WhatsApp box. */
	accountPhoneIso = signal<CountryCode | null>(null);
	addingChannel = signal<boolean>(false);
	removingChannelId = signal<string | null>(null);
	submittingBasics = signal<boolean>(false);
	loadingProfile = signal<boolean>(false);
	profileLoadError = signal<boolean>(false);
	passwordFormVisible = signal<boolean>(false);
	isChangingPassword = signal<boolean>(false);
	/** The marketer's saved settings: channels, per-event alerts, communication language, timezone. */
	alertPreferences: MarketerSettings = { ...DEFAULT_MARKETER_SETTINGS };
	readonly timezoneOptions = MARKETER_TIMEZONE_OPTIONS;
	exportingData = signal<boolean>(false);
	isSavingAlerts = signal<boolean>(false);

	referralLink = computed(() => buildReferralUrl(this.profile()?.referralSlug));

	// روابط الإحالة الاجتماعية — real per-platform tracking links derived from
	// the affiliate's own real referralSlug (same base link as referralLink()
	// above), each tagged with a platform-specific `src` query param so clicks
	// can later be attributed per channel. Not fabricated data: it's the same
	// real referral link, just parameterized per platform, matching the design.
	private readonly socialPlatforms: { name: string; src: string }[] = [
		{ name: 'إكس (تويتر)', src: 'x' },
		{ name: 'إنستقرام', src: 'ig' },
		{ name: 'سناب شات', src: 'snap' },
		{ name: 'تيك توك', src: 'tiktok' },
		{ name: 'لينكدإن', src: 'linkedin' },
		{ name: 'واتساب', src: 'wa' },
	];
	referralSocialLinks = computed(() => {
		const base = this.referralLink();
		return this.socialPlatforms.map(p => ({
			...p,
			link: base ? `${base}?src=${p.src}` : ''
		}));
	});

	// تقرير أداء القنوات — real per-channel performance from the backend.
	// Note: the backend's ChannelPerformance shape has no "registrations"
	// (التسجيلات) field, only visitors/clients/conversionPercentage — that
	// column is rendered as "—" rather than a fabricated number.
	channelPerformance = signal<ChannelPerformance[]>([]);
	loadingChannelPerformance = signal<boolean>(false);

	// آخر العمولات — reuses the same real commissions endpoint the dedicated
	// commissions page (`commissions.ts`) is built on.
	recentCommissions = signal<CommissionLog[]>([]);
	loadingRecentCommissions = signal<boolean>(false);

	marketingForm!: FormGroup;
	paypalForm!: FormGroup;
	channelForm!: FormGroup;
	basicsForm!: FormGroup;
	contactForm!: FormGroup;
	passwordForm!: FormGroup;

	ngOnInit() {
		this.marketingForm = this.fb.group({
			avatarUrl: [''],
			bio: ['', [Validators.maxLength(500)]],
		});

		// PayPal is the only payout destination (backend updatePaypalPayoutSchema). Empty = remove the saved email.
		this.paypalForm = this.fb.group({
			paypalPayoutEmail: ['', paypalEmailOptionalValidators],
		});

		// EMAIL is deliberately NOT part of this form — governed email changes
		// are disabled for now (see profile-requests.dto.ts on the backend for
		// why: no email-ownership verification exists yet, and Google OAuth's
		// existing-user lookup matches by email, so a silent email swap here
		// could lock out a Google-authenticated affiliate with no password).
		// The email input on this tab stays read-only, bound directly to
		// profile()?.user?.email, never to this form.
		// Backend CreateIdentityRequestSchema (strict): firstName/lastName max 50, nationalId max 20 (the account phone is immutable from the interface: it is shown, never sent).
		// Every field is optional, only the non-empty ones are sent.
		this.basicsForm = this.fb.group({
			firstName: ['', [Validators.maxLength(50)]],
			lastName: ['', [Validators.maxLength(50)]],
			nationalId: ['', [Validators.maxLength(20)]]
		});

		// WhatsApp (optional): the only contact number a marketer edits, a direct save through PUT /profiles/update/contact. The account phone stays read-only.
		this.contactForm = this.fb.group({ alternativePhone: [''] });

		this.channelForm = this.fb.group({
			platform: ['', Validators.required],
			handle: ['', [Validators.required, notBlank]]
		});

		this.passwordForm = this.fb.group({
			currentPassword: ['', Validators.required],
			newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72), passwordGroupsValidator]],
			confirmPassword: ['', [Validators.required, confirmMatchesValidator]]
		});
		this.passwordForm.get('newPassword')!.valueChanges.subscribe(() => this.passwordForm.get('confirmPassword')!.updateValueAndValidity({ emitEvent: false }));

		this.overviewService.getSummary().subscribe({
			next: (res) => {
				if (res.success) {
					this.summary.set(res.data);
				}
			},
			// Non-critical for this page (only feeds the tier/summary banner) —
			// fails quietly with a toast rather than blocking the page, unlike
			// loadProfile() below which gates the whole basics-tab form.
			error: () => {
				this.notify.error('تعذر تحميل بيانات ملخص الأداء');
			}
		});

		this.loadProfile();

		this.overviewService.getSettings().subscribe({
			next: (res) => {
				if (res.success && res.data) {
					this.alertPreferences = { ...DEFAULT_MARKETER_SETTINGS, ...res.data };
					this.prefsStore.apply(res.data);
					this.alertsLoadFailed.set(false);
				}
			},
			error: () => { this.alertsLoadFailed.set(true); }
		});

		this.loadingChannelPerformance.set(true);
		this.overviewService.getChannelPerformance().pipe(
			finalize(() => this.loadingChannelPerformance.set(false))
		).subscribe({
			next: (res) => {
				if (res.success) {
					this.channelPerformance.set(res.data);
				}
			},
			error: () => {}
		});

		this.loadingRecentCommissions.set(true);
		this.overviewService.getRecentCommissions(5).pipe(
			finalize(() => this.loadingRecentCommissions.set(false))
		).subscribe({
			next: (res) => {
				if (res.success) {
					this.recentCommissions.set(res.data);
				}
			},
			error: () => {}
		});
	}

	loadProfile() {
		if (this.loadingProfile()) return;

		this.loadingProfile.set(true);
		this.profileService.getProfile().pipe(
			finalize(() => this.loadingProfile.set(false))
		).subscribe({
			next: (res) => {
				if (res.success && res.data) {
					this.profileLoadError.set(false);
					this.profile.set(res.data);
					this.channels.set(res.data.marketingChannels || []);

					this.marketingForm.patchValue({
						avatarUrl: res.data.avatarUrl || '',
						bio: res.data.bio || ''
					});

					this.paypalForm.patchValue({ paypalPayoutEmail: res.data.paypalPayoutEmail || '' });

					const u = res.data.user;
					this.accountPhoneIso.set(parseStoredPhone(u?.phoneNumber, u?.phoneCountryCode).iso);
					// a refresh keeps what the user is typing in the WhatsApp box; only an untouched box follows the stored value
					if (!this.contactForm.get('alternativePhone')!.dirty) this.contactForm.patchValue({ alternativePhone: u?.alternativePhone || '' });

					this.basicsForm.patchValue({
						firstName: res.data.user?.firstName || '',
						lastName: res.data.user?.lastName || '',
						nationalId: res.data.user?.idNumber || ''
					});
				} else {
					// A well-formed but unsuccessful response (res.success===false) —
					// never overwrite already-loaded profile/form data with this;
					// only surface the load-error state if nothing real is loaded yet.
					this.profileLoadError.set(!this.profile());
					this.notify.error(this.arabicOr(res.message, 'تعذر تحميل بيانات الملف الشخصي'));
				}
			},
			// GET /marketer/profile returning a non-2xx (e.g. 429) must never blank
			// already-loaded data; only show the explicit error state when nothing
			// has loaded yet.
			error: (err) => {
				this.profileLoadError.set(!this.profile());
				this.notify.httpError(err, { fallback: 'تعذر تحميل بيانات الملف الشخصي، يرجى المحاولة مرة أخرى' });
			}
		});
	}

	/** Backend `missingItems` (same source as the percentage). */
	missingItems = computed<CompletionBoxItem[]>(() => (this.profile()?.missingItems ?? []) as CompletionBoxItem[]);

	/** "Complete your profile" item: opens the tab that fixes it (the PayPal item opens the PayPal tab). */
	openMissingItem(item: CompletionBoxItem) {
		this.setActiveTab(item.tab === 'bank' ? 'banking' : 'profile');
		setTimeout(() => (this.host.nativeElement as HTMLElement).querySelector('.prof-tab-panel')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), 30);
	}

	setActiveTab(tab: string) {
		this.activeTab.set(tab);
		this.missing.set([]);
		this.channelMissing.set([]);
		this.whatsappMissing.set([]);
		this.tabNotice.set(null);
	}

	// ---------- shared helpers ----------

	private arabicOr(message: unknown, fallback: string): string {
		return hasArabic(message) ? message : fallback;
	}

	/** The active tab panel (hidden panels are not in the DOM, but scope focus to the visible container anyway). */
	private panel(): HTMLElement {
		return (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.prof-tab-panel') ?? this.host.nativeElement;
	}

	private scoped(selector: string): HTMLElement {
		return (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(selector) ?? this.panel();
	}

	/** Server field messages are shown only in Arabic: English zod text is replaced by a fixed Arabic sentence. */
	private arabicFieldErrors(fieldErrors: Record<string, string>): Record<string, string> {
		const out: Record<string, string> = {};
		for (const [name, message] of Object.entries(fieldErrors)) {
			if (hasArabic(message)) { out[name] = message; continue; }
			const label = LABELS[name] || 'القيمة';
			const max = /at most (\d+)/i.exec(message || '');
			out[name] = max ? `${label} يجب ألا يزيد على ${max[1]} حرفًا` : `${label} غير صالح`;
		}
		return out;
	}

	/**
	 * Server answer -> Arabic toast + (zod `errors[]`) messages on the right inputs + focus. 400/409 without a
	 * field also stay visible next to the button (a toast alone disappears).
	 */
	private fail(err: unknown, form: FormGroup | null, fallback: string, setMissing: (items: InvalidField[]) => void, rootSelector?: string) {
		const mapped = this.notify.httpError(err, { fallback });
		const fieldErrors = this.arabicFieldErrors(mapped.fieldErrors);
		const names = Object.keys(fieldErrors);
		if (form && names.length) {
			const unmatched = applyServerFieldErrors(form, fieldErrors);
			if (fieldErrors['avatarUrl']) this.avatarError.set(fieldErrors['avatarUrl']);
			setMissing(collectInvalidFields(form, LABELS));
			if (unmatched.length && !fieldErrors['avatarUrl']) this.tabNotice.set(mapped.message);
			// Focus once the new error classes are rendered.
			setTimeout(() => focusFirstInvalid(rootSelector ? this.scoped(rootSelector) : this.panel()), 60);
		} else if (mapped.kind === 'backend-validation' || mapped.kind === 'conflict') {
			this.tabNotice.set(mapped.message);
		}
		return mapped;
	}

	// ---------- PayPal (the only payout destination; saved at once, an empty email removes it) ----------

	savePaypal() {
		if (this.savingPaypal()) return;
		this.tabNotice.set(null);
		const attempt = attemptSubmit(this.paypalForm, { root: this.panel(), labels: LABELS });
		this.missing.set(attempt.missing);
		if (!attempt.valid) return;
		const email = String(this.paypalForm.value.paypalPayoutEmail || '').trim();
		this.savingPaypal.set(true);
		this.profileService.updatePaypalPayout(email).pipe(
			finalize(() => this.savingPaypal.set(false))
		).subscribe({
			next: (res) => {
				if (res.success) {
					this.loadProfile();
					this.missing.set([]);
					this.notify.success(email ? 'تم حفظ بريد PayPal' : 'تم إزالة بريد PayPal');
				} else {
					this.tabNotice.set(this.arabicOr(res.message, 'تعذر حفظ بريد PayPal'));
					this.notify.error(this.arabicOr(res.message, 'تعذر حفظ بريد PayPal'));
				}
			},
			error: (err) => this.fail(err, this.paypalForm, 'تعذر حفظ بريد PayPal، حاول مرة أخرى', items => this.missing.set(items))
		});
	}

	// ---------- WhatsApp (optional contact number, saved at once) ----------

	saveWhatsapp() {
		if (this.savingWhatsapp()) return;
		this.tabNotice.set(null);
		const attempt = attemptSubmit(this.contactForm, { root: this.scoped('[data-form="whatsapp"]'), labels: LABELS });
		this.whatsappMissing.set(attempt.missing);
		if (!attempt.valid) return;

		const value = phoneToE164(this.contactForm.get('alternativePhone')!.value);
		this.savingWhatsapp.set(true);
		this.profileService.updateContact({ alternativePhone: value }).pipe(
			finalize(() => this.savingWhatsapp.set(false))
		).subscribe({
			next: (res) => {
				if (res.success === false) { this.notify.error(this.arabicOr(res.message, 'تعذر حفظ رقم WhatsApp')); return; }
				this.whatsappMissing.set([]);
				this.contactForm.get('alternativePhone')!.markAsPristine();
				// keep the page in step with what is stored, without reloading (a reload would reset the other forms)
				const current = this.profile();
				if (current) this.profile.set({ ...current, user: { ...current.user, alternativePhone: value } });
				this.notify.success(value ? 'تم حفظ رقم WhatsApp' : 'تم حذف رقم WhatsApp');
			},
			error: (err) => this.fail(err, this.contactForm, 'تعذر حفظ رقم WhatsApp، حاول مرة أخرى', items => this.whatsappMissing.set(items), '[data-form="whatsapp"]')
		});
	}

	// ---------- identity change request ----------

	submitBasicsChangeRequest() {
		if (this.submittingBasics() || this.identityPending()) return;
		this.tabNotice.set(null);
		const attempt = attemptSubmit(this.basicsForm, { root: this.panel(), labels: LABELS });
		this.missing.set(attempt.missing);
		if (!attempt.valid) return;

		const value = this.basicsForm.value;
		const payload: { firstName?: string; lastName?: string; nationalId?: string } = {};
		const fields = ['firstName', 'lastName', 'nationalId'] as const;
		for (const f of fields) {
			const v = String(value[f] ?? '').trim();
			if (v) payload[f] = v;
		}

		// The backend files a request only for fields that differ from the saved ones and answers 400
		// "no change" otherwise: say so before sending (what is sent stays the same).
		const u = this.profile()?.user;
		const current: Record<string, string> = {
			firstName: u?.firstName ?? '', lastName: u?.lastName ?? '', nationalId: u?.idNumber ?? '',
		};
		const changed = fields.filter(f => payload[f] !== undefined && payload[f] !== current[f].trim());
		if (!changed.length) {
			this.tabNotice.set(Object.keys(payload).length
				? 'لم تغيّر أي بيانات. عدّل الاسم أو رقم الهوية ثم أرسل الطلب.'
				: 'أدخل قيمة جديدة لحقل واحد على الأقل (الاسم الأول، اسم العائلة أو رقم الهوية).');
			this.scoped('#af-fname').focus?.();
			return;
		}

		this.submittingBasics.set(true);
		this.profileService.createIdentityRequest(payload).pipe(
			finalize(() => this.submittingBasics.set(false))
		).subscribe({
			next: (res) => {
				if (res.success) {
					// 201 + the created governed requests: they wait for AI review then human approval.
					this.identitySentNow.set(true);
					this.missing.set([]);
					this.loadProfile();
					this.notify.success('تم إرسال طلب التعديل للمراجعة بنجاح');
				} else {
					this.tabNotice.set(this.arabicOr(res.message, 'تعذر إرسال طلب التعديل'));
					this.notify.error(this.arabicOr(res.message, 'تعذر إرسال طلب التعديل'));
				}
			},
			error: (err) => {
				this.fail(err, this.basicsForm, 'تعذر إرسال طلب التعديل، حاول مرة أخرى', items => this.missing.set(items));
			}
		});
	}

	// ---------- marketing profile (bio + avatar) ----------

	submitMarketingProfile() {
		if (this.savingProfile()) return;
		const attempt = attemptSubmit(this.marketingForm, { root: this.scoped('[data-form="marketing"]'), labels: LABELS });
		this.missing.set(attempt.missing);
		if (!attempt.valid) return;
		this.saveMarketingProfile();
	}

	/** `onlyAvatar`: an avatar pick/remove sends ONLY avatarUrl, so an empty or unsaved bio in the form never overwrites the stored one. */
	saveMarketingProfile(successMessage: string = 'تم حفظ الملف التسويقي بنجاح', revertAvatarUrlOnError?: string, onlyAvatar = false) {
		if (this.savingProfile()) return;

		this.savingProfile.set(true);
		this.profileService.updateMarketingInfo(onlyAvatar ? { avatarUrl: this.marketingForm.value.avatarUrl } : this.marketingForm.value).pipe(
			finalize(() => this.savingProfile.set(false))
		).subscribe({
			next: (res) => {
				if (res.success) {
					this.loadProfile();
					this.missing.set([]);
					this.notify.success(successMessage);
				} else {
					if (revertAvatarUrlOnError !== undefined) this.marketingForm.patchValue({ avatarUrl: revertAvatarUrlOnError });
					this.notify.error(this.arabicOr(res.message, 'تعذر حفظ التغييرات'));
				}
			},
			error: (err) => {
				if (revertAvatarUrlOnError !== undefined) this.marketingForm.patchValue({ avatarUrl: revertAvatarUrlOnError });
				this.fail(err, this.marketingForm, 'تعذر حفظ التغييرات، حاول مرة أخرى', items => this.missing.set(items), '[data-form="marketing"]');
			}
		});
	}

	onAvatarChange(event: Event) {
		const input = event.target as HTMLInputElement;
		this.avatarError.set(null);
		if (input.files && input.files[0]) {
			const file = input.files[0];

			// The picture hint promises JPG/PNG up to 5MB: enforce exactly that.
			const problem = validateFile(file, { maxBytes: 5 * MB, mimeTypes: ['image/jpeg', 'image/png'], extensions: ['.jpg', '.jpeg', '.png'], typesLabel: 'JPG أو PNG' });
			if (problem) {
				this.avatarError.set(problem);
				input.value = '';
				return;
			}

			const previousAvatarUrl = this.marketingForm.value.avatarUrl || '';
			const reader = new FileReader();
			reader.onload = (e: any) => {
				const base64Str = e.target.result;
				this.marketingForm.patchValue({ avatarUrl: base64Str });
				this.saveMarketingProfile('تم تحديث الصورة الشخصية بنجاح', previousAvatarUrl, true);
			};
			reader.onerror = () => {
				this.avatarError.set('تعذرت قراءة ملف الصورة، حاول مرة أخرى');
			};
			reader.readAsDataURL(file);
			input.value = '';
		}
	}

	removeAvatar() {
		this.avatarError.set(null);
		const previousAvatarUrl = this.marketingForm.value.avatarUrl || '';
		// Nothing to delete: do not claim a deletion that did not happen.
		if (!previousAvatarUrl) {
			this.avatarError.set('لا توجد صورة شخصية لحذفها');
			return;
		}
		this.marketingForm.patchValue({ avatarUrl: '' });
		this.saveMarketingProfile('تم حذف الصورة الشخصية بنجاح', previousAvatarUrl, true);
	}

	// ---------- channels ----------

	addChannel() {
		if (this.addingChannel()) return;
		const attempt = attemptSubmit(this.channelForm, { root: this.scoped('[data-form="channel"]'), labels: LABELS });
		this.channelMissing.set(attempt.missing);
		if (!attempt.valid) return;

		this.addingChannel.set(true);
		this.profileService.addChannel(this.channelForm.value).pipe(
			finalize(() => this.addingChannel.set(false))
		).subscribe({
			next: (res) => {
				if (res.success) {
					this.loadProfile();
					this.channelForm.reset({ platform: '', handle: '' });
					this.channelMissing.set([]);
					this.notify.success('تمت إضافة القناة بنجاح');
				} else {
					this.notify.error(this.arabicOr(res.message, 'تعذر إضافة القناة'));
				}
			},
			error: (err) => {
				this.fail(err, this.channelForm, 'تعذر إضافة القناة، حاول مرة أخرى', items => this.channelMissing.set(items), '[data-form="channel"]');
			}
		});
	}

	removeChannel(id: string) {
		if (this.removingChannelId()) return;

		this.removingChannelId.set(id);
		this.profileService.removeChannel(id).pipe(
			finalize(() => this.removingChannelId.set(null))
		).subscribe({
			next: (res) => {
				if (res.success) {
					this.loadProfile();
					this.notify.success('تم حذف القناة بنجاح');
				} else {
					this.notify.error(this.arabicOr(res.message, 'تعذر حذف القناة'));
				}
			},
			error: (err) => {
				this.notify.httpError(err, { fallback: 'تعذر حذف القناة، حاول مرة أخرى' });
			}
		});
	}

	// ---------- password ----------

	passwordStrength() {
		const value = String(this.passwordForm?.get('newPassword')?.value || '');
		if (!value) return { percent: 0, label: 'قوة كلمة المرور', color: 'transparent' };
		const groups = characterGroups(value);
		const score = Math.min(4, (value.length >= 8 ? 1 : 0) + (value.length >= 12 ? 1 : 0) + Math.min(2, groups - 1));
		return score <= 1 ? { percent: 25, label: 'ضعيفة', color: '#FF6B6B' }
			: score === 2 ? { percent: 50, label: 'متوسطة', color: '#FFB400' }
			: score === 3 ? { percent: 75, label: 'جيدة', color: '#2B7FFF' }
			: { percent: 100, label: 'قوية', color: '#2BD4C7' };
	}

	changePassword() {
		if (this.isChangingPassword()) return;
		const attempt = attemptSubmit(this.passwordForm, { root: this.scoped('[data-form="password"]'), labels: LABELS });
		this.missing.set(attempt.missing);
		if (!attempt.valid) return;

		const { currentPassword, newPassword } = this.passwordForm.value;
		this.isChangingPassword.set(true);
		this.profileService.changePassword(currentPassword, newPassword).subscribe({
			next: () => {
				this.isChangingPassword.set(false);
				this.passwordForm.reset();
				this.missing.set([]);
				this.passwordFormVisible.set(false);
				this.notify.success('تم تغيير كلمة المرور بنجاح');
			},
			error: (err: any) => {
				this.isChangingPassword.set(false);
				// The backend answers with a bare code (401 CURRENT_PASSWORD_INCORRECT, 400 PASSWORD_UNCHANGED / WEAK_PASSWORD).
				const code = String(err?.error?.message ?? '').split(':')[0].trim();
				const byCode: Record<string, [string, string]> = {
					CURRENT_PASSWORD_INCORRECT: ['currentPassword', 'كلمة المرور الحالية غير صحيحة'],
					PASSWORD_UNCHANGED: ['newPassword', 'كلمة المرور الجديدة يجب أن تختلف عن الحالية'],
					WEAK_PASSWORD: ['newPassword', PASSWORD_RULE_MESSAGE],
				};
				const hit = byCode[code];
				if (hit) {
					applyServerFieldErrors(this.passwordForm, { [hit[0]]: hit[1] });
					this.missing.set(collectInvalidFields(this.passwordForm, LABELS));
					setTimeout(() => focusFirstInvalid(this.scoped('[data-form="password"]')), 60);
					return;
				}
				this.notify.httpError(err, { unauthorizedIs: 'credentials', fallback: 'تعذر تغيير كلمة المرور، حاول مجددًا' });
			}
		});
	}

	// ---------- alerts ----------

	saveAlertPreferences() {
		if (this.isSavingAlerts()) return;
		this.isSavingAlerts.set(true);
		this.overviewService.updateMarketerSettings(this.alertPreferences).subscribe({
			next: (res) => {
				this.isSavingAlerts.set(false);
				if (res.success) {
					if (res.data) { this.alertPreferences = { ...DEFAULT_MARKETER_SETTINGS, ...res.data }; this.prefsStore.apply(res.data); }
					this.alertsLoadFailed.set(false);
					this.notify.success('تم حفظ الإعدادات بنجاح');
				} else {
					this.notify.error(this.arabicOr(res.message, 'تعذر حفظ الإعدادات'));
				}
			},
			error: (err) => {
				this.isSavingAlerts.set(false);
				this.notify.httpError(err, { fallback: 'تعذر حفظ الإعدادات، حاول مرة أخرى' });
			}
		});
	}

	/** Downloads the marketer's own data as a real JSON file produced by the server. */
	downloadMyData() {
		if (this.exportingData()) return;
		this.exportingData.set(true);
		this.overviewService.exportData().subscribe({
			next: (blob) => {
				this.exportingData.set(false);
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url; a.download = 'waseet-marketer-data.json';
				document.body.appendChild(a); a.click(); a.remove();
				setTimeout(() => URL.revokeObjectURL(url), 1000);
			},
			error: (err) => { this.exportingData.set(false); this.notify.httpError(err, { fallback: 'تعذر تنزيل بياناتك، حاول مرة أخرى' }); }
		});
	}

	copyToClipboard(text: string, field: string) {
		if (!text) return;
		navigator.clipboard.writeText(text).then(() => {
			this.copiedField.set(field);
			setTimeout(() => this.copiedField.set(''), 2000);
		}).catch(() => this.notify.error('تعذّر النسخ تلقائيًا، حدّد النص وانسخه يدويًا'));
	}

	cancelAndReturn() {
		this.loadProfile();
		this.router.navigate(['/marketer-overview']);
	}
}
