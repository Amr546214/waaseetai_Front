import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { MarketerOverviewService, MarketerSummary, ChannelPerformance, CommissionLog } from '../../../../../core/services/marketer-overview.service';
import { MarketerProfileService, MarketerProfile, AffiliateChannelHandle } from '../../../../../core/services/marketer-profile.service';
import { NotificationPreferencesService } from '../../../../../core/services/notification-preferences.service';
import { ibanValidator } from '../../../../../core/validators/iban.validator';
import { buildReferralUrl } from '../../../../../core/utils/referral-link.util';

const DEFAULT_ALERT_PREFERENCES = {
	marketer_new_referral: true,
	marketer_new_commission: true,
	marketer_tier_upgrade: true,
	marketer_ai_tips: false,
};

@Component({
	selector: 'app-data',
	standalone: true,
	imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
	templateUrl: './data.html',
	styleUrl: './data.css',
})
export class Data implements OnInit {
	private fb = inject(FormBuilder);
	private router = inject(Router);
	private overviewService = inject(MarketerOverviewService);
	private profileService = inject(MarketerProfileService);
	private notificationPreferencesService = inject(NotificationPreferencesService);

	summary = signal<MarketerSummary | null>(null);
	profile = signal<MarketerProfile | null>(null);
	channels = signal<AffiliateChannelHandle[]>([]);

	activeTab = signal<string>('profile');
	isGovModalOpen = signal<boolean>(false);
	governedEditField = signal<string>('');
	copiedField = signal<string>('');

	toastMessage = signal<{ text: string; type: 'success' | 'error' } | null>(null);
	private toastTimer: ReturnType<typeof setTimeout> | null = null;

	savingProfile = signal<boolean>(false);
	savingBank = signal<boolean>(false);
	addingChannel = signal<boolean>(false);
	removingChannelId = signal<string | null>(null);
	submittingBasics = signal<boolean>(false);
	loadingProfile = signal<boolean>(false);
	profileLoadError = signal<boolean>(false);
	passwordFormVisible = signal<boolean>(false);
	isChangingPassword = signal<boolean>(false);
	alertPreferences = { ...DEFAULT_ALERT_PREFERENCES };
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
	bankForm!: FormGroup;
	channelForm!: FormGroup;
	basicsForm!: FormGroup;
	passwordForm!: FormGroup;

	ngOnInit() {
		this.marketingForm = this.fb.group({
			avatarUrl: [''],
			bio: ['', [Validators.maxLength(500)]],
		});

		this.bankForm = this.fb.group({
			accountHolderName: [''],
			iban: ['', [ibanValidator]],
			bankName: [''],
			swiftCode: ['']
		});

		// EMAIL is deliberately NOT part of this form — governed email changes
		// are disabled for now (see profile-requests.dto.ts on the backend for
		// why: no email-ownership verification exists yet, and Google OAuth's
		// existing-user lookup matches by email, so a silent email swap here
		// could lock out a Google-authenticated affiliate with no password).
		// The email input on this tab stays read-only, bound directly to
		// profile()?.user?.email, never to this form.
		this.basicsForm = this.fb.group({
			firstName: [''],
			lastName: [''],
			nationalId: [''],
			phoneNumber: ['']
		});

		this.channelForm = this.fb.group({
			platform: ['', Validators.required],
			handle: ['', Validators.required]
		});

		this.passwordForm = this.fb.group({
			currentPassword: ['', Validators.required],
			newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
			confirmPassword: ['', Validators.required]
		});

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
				this.showToast('تعذر تحميل بيانات ملخص الأداء', 'error');
			}
		});

		this.loadProfile();

		this.notificationPreferencesService.getPreferences().subscribe({
			next: (res) => {
				if (res.success) {
					const saved = res.data?.settings || {};
					this.alertPreferences = { ...DEFAULT_ALERT_PREFERENCES, ...saved } as typeof DEFAULT_ALERT_PREFERENCES;
				}
			},
			error: () => {}
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

					this.bankForm.patchValue({
						accountHolderName: res.data.accountHolderName || '',
						iban: res.data.iban || '',
						bankName: res.data.bankName || '',
						swiftCode: res.data.swiftCode || ''
					});

					this.basicsForm.patchValue({
						firstName: res.data.user?.firstName || '',
						lastName: res.data.user?.lastName || '',
						nationalId: res.data.user?.idNumber || '',
						phoneNumber: res.data.user?.phoneNumber || ''
					});
				} else {
					// A well-formed but unsuccessful response (res.success===false) —
					// never overwrite already-loaded profile/form data with this;
					// only surface the load-error state if nothing real is loaded yet.
					this.profileLoadError.set(!this.profile());
					this.showToast(res.message || 'تعذر تحميل بيانات الملف الشخصي', 'error');
				}
			},
			// This is the fix for the real incident: GET /marketer/profile
			// returning a non-2xx (e.g. 429 from the rate limiter) used to be
			// silently swallowed here — profile/basicsForm never populated, so
			// the page rendered as if the account had no name/email/phone/
			// completion at all, even though the real data was untouched in the
			// database. Never clear/blank already-loaded data on a failure;
			// only show the explicit error state when no profile has loaded yet.
			error: (err) => {
				this.profileLoadError.set(!this.profile());
				this.showToast(err?.error?.message || 'تعذر تحميل بيانات الملف الشخصي، يرجى المحاولة مرة أخرى', 'error');
			}
		});
	}

	setActiveTab(tab: string) {
		this.activeTab.set(tab);
	}

	openGovernedEdit(field: string) {
		this.governedEditField.set(field);
		this.isGovModalOpen.set(true);
	}

	closeGovernedEdit() {
		if (this.savingBank()) return;
		this.isGovModalOpen.set(false);
	}

	confirmGovernedEdit() {
		if (this.governedEditField() !== 'البيانات البنكية والمستندات') {
			this.closeGovernedEdit();
			return;
		}
		if (this.savingBank()) return;
		if (this.bankForm.get('iban')?.invalid) {
			this.bankForm.get('iban')?.markAsTouched();
			this.showToast('أدخل رقم IBAN صالحًا قبل الإرسال', 'error');
			return;
		}

		this.savingBank.set(true);
		this.profileService.updateBankInfo(this.bankForm.value).pipe(
			finalize(() => this.savingBank.set(false))
		).subscribe({
			next: (res) => {
				if (res.success) {
					this.loadProfile();
					this.showToast('تم إرسال بيانات الحساب البنكي بنجاح', 'success');
					this.isGovModalOpen.set(false);
				} else {
					this.showToast(res.message || 'تعذر إرسال بيانات الحساب البنكي', 'error');
				}
			},
			error: (err) => {
				this.showToast(err?.error?.message || 'تعذر إرسال بيانات الحساب البنكي، حاول مرة أخرى', 'error');
			}
		});
	}

	submitBasicsChangeRequest() {
		if (this.submittingBasics() || this.basicsForm.invalid) return;

		const value = this.basicsForm.value;
		const payload: { firstName?: string; lastName?: string; nationalId?: string; phoneNumber?: string } = {};
		if (value.firstName) payload.firstName = value.firstName;
		if (value.lastName) payload.lastName = value.lastName;
		if (value.nationalId) payload.nationalId = value.nationalId;
		if (value.phoneNumber) payload.phoneNumber = value.phoneNumber;

		if (!payload.firstName && !payload.lastName && !payload.nationalId && !payload.phoneNumber) {
			this.showToast('يرجى إدخال قيمة جديدة لحقل واحد على الأقل', 'error');
			return;
		}

		this.submittingBasics.set(true);
		this.profileService.createIdentityRequest(payload).pipe(
			finalize(() => this.submittingBasics.set(false))
		).subscribe({
			next: (res) => {
				if (res.success) {
					this.showToast('تم إرسال طلب التعديل للمراجعة بنجاح', 'success');
				} else {
					this.showToast(res.message || 'تعذر إرسال طلب التعديل', 'error');
				}
			},
			error: (err) => {
				this.showToast(err?.error?.message || 'تعذر إرسال طلب التعديل، حاول مرة أخرى', 'error');
			}
		});
	}

	saveMarketingProfile(successMessage: string = 'تم حفظ الملف التسويقي بنجاح', revertAvatarUrlOnError?: string) {
		if (this.savingProfile()) return;

		this.savingProfile.set(true);
		this.profileService.updateMarketingInfo(this.marketingForm.value).pipe(
			finalize(() => this.savingProfile.set(false))
		).subscribe({
			next: (res) => {
				if (res.success) {
					this.loadProfile();
					this.showToast(successMessage, 'success');
				} else {
					if (revertAvatarUrlOnError !== undefined) this.marketingForm.patchValue({ avatarUrl: revertAvatarUrlOnError });
					this.showToast(res.message || 'تعذر حفظ التغييرات', 'error');
				}
			},
			error: (err) => {
				if (revertAvatarUrlOnError !== undefined) this.marketingForm.patchValue({ avatarUrl: revertAvatarUrlOnError });
				this.showToast(err?.error?.message || 'تعذر حفظ التغييرات، حاول مرة أخرى', 'error');
			}
		});
	}

	onAvatarChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			const file = input.files[0];

			// Basic validation
			if (file.size > 5 * 1024 * 1024) {
				this.showToast('حجم الصورة يجب أن لا يتجاوز 5 ميجابايت', 'error');
				input.value = '';
				return;
			}

			const previousAvatarUrl = this.marketingForm.value.avatarUrl || '';
			const reader = new FileReader();
			reader.onload = (e: any) => {
				const base64Str = e.target.result;
				this.marketingForm.patchValue({ avatarUrl: base64Str });
				this.saveMarketingProfile('تم تحديث الصورة الشخصية بنجاح', previousAvatarUrl);
			};
			reader.onerror = () => {
				this.showToast('تعذرت قراءة ملف الصورة، حاول مرة أخرى', 'error');
			};
			reader.readAsDataURL(file);
		}
	}

	removeAvatar() {
		const previousAvatarUrl = this.marketingForm.value.avatarUrl || '';
		this.marketingForm.patchValue({ avatarUrl: '' });
		this.saveMarketingProfile('تم حذف الصورة الشخصية بنجاح', previousAvatarUrl);
	}

	addChannel() {
		if (!this.channelForm.valid || this.addingChannel()) return;

		this.addingChannel.set(true);
		this.profileService.addChannel(this.channelForm.value).pipe(
			finalize(() => this.addingChannel.set(false))
		).subscribe({
			next: (res) => {
				if (res.success) {
					this.loadProfile();
					this.channelForm.reset();
					this.showToast('تمت إضافة القناة بنجاح', 'success');
				} else {
					this.showToast(res.message || 'تعذر إضافة القناة', 'error');
				}
			},
			error: (err) => {
				this.showToast(err?.error?.message || 'تعذر إضافة القناة، حاول مرة أخرى', 'error');
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
					this.showToast('تم حذف القناة بنجاح', 'success');
				} else {
					this.showToast(res.message || 'تعذر حذف القناة', 'error');
				}
			},
			error: (err) => {
				this.showToast(err?.error?.message || 'تعذر حذف القناة، حاول مرة أخرى', 'error');
			}
		});
	}

	passwordStrength() {
		const value = String(this.passwordForm?.get('newPassword')?.value || '');
		if (!value) return { percent: 0, label: 'قوة كلمة المرور', color: 'transparent' };
		const groups = [/[a-z]/.test(value), /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length;
		const score = Math.min(4, (value.length >= 8 ? 1 : 0) + (value.length >= 12 ? 1 : 0) + Math.min(2, groups - 1));
		return score <= 1 ? { percent: 25, label: 'ضعيفة', color: '#FF6B6B' }
			: score === 2 ? { percent: 50, label: 'متوسطة', color: '#FFB400' }
			: score === 3 ? { percent: 75, label: 'جيدة', color: '#2B7FFF' }
			: { percent: 100, label: 'قوية', color: '#2BD4C7' };
	}

	changePassword() {
		if (this.isChangingPassword()) return;
		const { currentPassword, newPassword, confirmPassword } = this.passwordForm.value;
		if (this.passwordForm.invalid) { this.passwordForm.markAllAsTouched(); this.showToast('كلمة المرور الجديدة يجب أن تتكون من 8 أحرف على الأقل', 'error'); return; }
		if (newPassword !== confirmPassword) { this.passwordForm.get('confirmPassword')?.setErrors({ mismatch: true }); this.showToast('تأكيد كلمة المرور غير مطابق', 'error'); return; }
		const groups = [/[a-z]/.test(newPassword), /[A-Z]/.test(newPassword), /\d/.test(newPassword), /[^A-Za-z0-9]/.test(newPassword)].filter(Boolean).length;
		if (groups < 3) { this.showToast('استخدم ثلاثة أنواع على الأقل: أحرف صغيرة وكبيرة وأرقام ورموز', 'error'); return; }
		this.isChangingPassword.set(true);
		this.profileService.changePassword(currentPassword, newPassword).subscribe({
			next: () => {
				this.isChangingPassword.set(false);
				this.passwordForm.reset();
				this.passwordFormVisible.set(false);
				this.showToast('تم تغيير كلمة المرور بنجاح', 'success');
			},
			error: (err: any) => {
				this.isChangingPassword.set(false);
				const reason = err?.error?.message;
				this.showToast(reason === 'CURRENT_PASSWORD_INCORRECT' ? 'كلمة المرور الحالية غير صحيحة'
					: reason === 'PASSWORD_UNCHANGED' ? 'كلمة المرور الجديدة مطابقة للحالية'
					: reason === 'WEAK_PASSWORD' ? 'كلمة المرور الجديدة لا تحقق متطلبات الأمان'
					: 'تعذر تغيير كلمة المرور، حاول مجددًا', 'error');
			}
		});
	}

	saveAlertPreferences() {
		if (this.isSavingAlerts()) return;
		this.isSavingAlerts.set(true);
		this.notificationPreferencesService.updatePreferences(this.alertPreferences).subscribe({
			next: (res) => {
				this.isSavingAlerts.set(false);
				this.showToast(res.success ? 'تم حفظ إعدادات التنبيهات بنجاح' : (res.message || 'تعذر حفظ الإعدادات'), res.success ? 'success' : 'error');
			},
			error: () => {
				this.isSavingAlerts.set(false);
				this.showToast('تعذر حفظ الإعدادات، حاول مرة أخرى', 'error');
			}
		});
	}

	private showToast(text: string, type: 'success' | 'error' = 'success') {
		this.toastMessage.set({ text, type });
		if (this.toastTimer) clearTimeout(this.toastTimer);
		this.toastTimer = setTimeout(() => this.toastMessage.set(null), type === 'error' ? 5000 : 3000);
	}

	useAiChannelSuggestion() {
		this.setActiveTab('profile');
		this.channelForm.patchValue({ platform: 'LINKEDIN' });
	}

	copyToClipboard(text: string, field: string) {
		if (!text) return;
		navigator.clipboard.writeText(text).then(() => {
			this.copiedField.set(field);
			setTimeout(() => this.copiedField.set(''), 2000);
		});
	}

	cancelAndReturn() {
		this.loadProfile();
		this.router.navigate(['/marketer-overview']);
	}
}
