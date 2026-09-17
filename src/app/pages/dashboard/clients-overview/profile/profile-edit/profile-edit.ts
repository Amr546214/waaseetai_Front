import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { PhoneInputComponent } from '../../../../../sheards/phone-input/phone-input.component';
import { AuthStore } from '../../../../../core/store/auth.store';
import { ExperienceLevel } from '../../../../../core/models/profile.model';
import { AccountType } from '../../../../../core/models/auth.model';

type Tab = 'profile' | 'basics' | 'identity' | 'contact' | 'banking' | 'security';

@Component({
	selector: 'app-profile-edit',
	standalone: true,
	imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, PhoneInputComponent],
	templateUrl: './profile-edit.html',
	styleUrl: './profile-edit.css',
})
export class ProfileEdit {
	authStore = inject(AuthStore);
	profileApi = inject(ProfileApiService);
	fb = inject(FormBuilder);

	activeTab = signal<Tab>('profile');
	paymentMethod = signal<'bank' | 'wallet'>('bank');
	isChangingPassword = signal(false);

	completionPercentage = signal<number>(0);
	skills = signal<string[]>([]);
	interests = signal<string[]>([]);

	// Notification channel toggles
	notifEmail = signal(true);
	notifSms = signal(false);
	notifInApp = signal(true);
	notifTelegram = signal(false);
	notifWhatsapp = signal(false);

	getCompletionHint(): string {
		const p = this.completionPercentage();
		if (p >= 100) return 'ملفك الشخصي مكتمل بنسبة 100%! شكراً لك.';

		if (!this.clientForm?.value?.avatarUrl && !this.providerForm?.value?.avatarUrl) {
			return 'أضف صورة شخصية لرفع نسبة الاكتمال';
		}
		if (!this.basicsForm?.value?.firstName) {
			return 'أكمل البيانات الأساسية لرفع نسبة الاكتمال';
		}
		if (!this.identityForm?.value?.idNumber) {
			return 'أكمل بيانات الهوية الرسمية (KYC) لرفع نسبة الاكتمال';
		}
		if (!this.bankingForm?.value?.ibanNumber) {
			return 'أضف بياناتك البنكية لتتمكن من استقبال المدفوعات';
		}
		if (!this.clientForm?.value?.bio && !this.providerForm?.value?.bio) {
			return 'أضف نبذة تعريفية (Bio) عن نفسك أو شركتك';
		}
		return 'أكمل الحقول المتبقية للوصول إلى 100%';
	}

	frontIdFileName = signal('');
	backIdFileName = signal('');

	// Status states
	isLoading = signal(true);
	isSaving = signal(false);
	successMsg = signal('');
	errorMsg = signal('');

	// Forms
	clientForm!: FormGroup;
	providerForm!: FormGroup;
	basicsForm!: FormGroup;
	identityForm!: FormGroup;
	contactForm!: FormGroup;
	bankingForm!: FormGroup;

	isClient = false;
	isProvider = false;
	accountType = '';

	// Reactive company-mode flag — true only for COMPANY account types (CLIENT_COMPANY / PROVIDER_COMPANY)
	isCompanyMode = computed(() => {
		const type = this.authStore.currentUser()?.accountType;
		return type === AccountType.CLIENT_COMPANY || type === AccountType.PROVIDER_COMPANY;
	});

	experienceLevels = Object.values(ExperienceLevel);

	changeRequests = signal<any[]>([]);
	showRequestsModal = signal(false);

	constructor() {
		this.initForms();
		const currentUser = this.authStore.currentUser();
		this.accountType = currentUser?.accountType || '';
		this.isClient = this.accountType.includes('CLIENT');
		this.isProvider = this.accountType.includes('PROVIDER');
	}

	loadChangeRequests() {
		this.profileApi.getMyChangeRequests().subscribe({
			next: (res) => {
				if (res.success) {
					this.changeRequests.set(res.data);
					this.showRequestsModal.set(true);
				}
			},
			error: (err) => console.error('Failed to load requests:', err)
		});
	}

	closeRequestsModal() {
		this.showRequestsModal.set(false);
	}

	getTabName(tab: string): string {
		const names: Record<string, string> = {
			'CONTACT_UPDATE': 'بيانات التواصل',
			'IDENTITY_UPDATE': 'بيانات الهوية',
			'BANKING_UPDATE': 'البيانات البنكية',
			'BASICS_UPDATE': 'البيانات الأساسية'
		};
		return names[tab] || tab;
	}

	isTabPending(tabDbName: string): boolean {
		const requests = this.changeRequests();
		if (!requests || requests.length === 0) return false;
		return requests.some(r => r.tabName === tabDbName && r.status === 'PENDING');
	}

	getRejectionReason(tabDbName: string): string | null {
		const requests = this.changeRequests();
		if (!requests || requests.length === 0) return null;

		// Find the most recent request for this tab
		const tabRequest = requests.find(r => r.tabName === tabDbName);

		if (tabRequest && tabRequest.status === 'REJECTED') {
			return tabRequest.rejectionReason || 'تم رفض التعديل الأخير';
		}
		return null;
	}

	private initForms() {
		this.clientForm = this.fb.group({
			firstName: ['', [Validators.minLength(2)]],
			lastName: ['', [Validators.minLength(2)]],
			phoneNumber: [''],
			avatarUrl: [''],
			companyName: [''],
			companySize: [''],
			industry: [''],
			website: ['', [Validators.pattern('https?://.+')]],
			bio: ['', [Validators.maxLength(1000)]],
			portfolioUrl: ['', [Validators.pattern('https?://.+')]],
			linkedinUrl: [''],
			personalWebsiteUrl: ['', [Validators.pattern('https?://.+')]],
			interfaceLanguage: ['العربية'],
			timezone: ['(GMT+3) توقيت الرياض']
		});

		this.providerForm = this.fb.group({
			firstName: ['', [Validators.minLength(2)]],
			lastName: ['', [Validators.minLength(2)]],
			phoneNumber: [''],
			avatarUrl: [''],
			companyName: [''],
			bio: ['', [Validators.maxLength(1000)]],
			hourlyRate: [null, [Validators.min(0)]],
			experienceLevel: [null],
			portfolioUrl: ['', [Validators.pattern('https?://.+')]],
			linkedinUrl: [''],
			personalWebsiteUrl: ['', [Validators.pattern('https?://.+')]],
			interfaceLanguage: ['العربية'],
			timezone: ['(GMT+3) توقيت الرياض']
			// skills and portfolioLinks handled separately or explicitly mapped
		});

		this.basicsForm = this.fb.group({
			firstName: [''],
			lastName: [''],
			email: [''],
			phoneNumber: ['']
		});

		this.identityForm = this.fb.group({
			idNumber: [''],
			idExpiryDate: [''],
			nationality: [''],
			country: ['السعودية'],
			city: ['']
		});

		this.contactForm = this.fb.group({
			email: [''],
			phoneNumber: [''],
			alternativePhone: [''],
			country: ['السعودية'],
			city: ['']
		});

		this.bankingForm = this.fb.group({
			paymentMethod: ['bank'],
			accountHolderName: [''],
			bankName: [''],
			ibanNumber: [''],
			walletProvider: [''],
			walletPhone: [''],
			walletId: ['']
		});
	}

	ngOnInit() {
		this.loadProfile();
	}

	loadProfile() {
		this.isLoading.set(true);
		this.profileApi.getMyProfile().subscribe({
			next: (res) => {
				this.isLoading.set(false);
				if (res.success && res.data) {
					const profile = res.data.currentProfileData || res.data;

					this.completionPercentage.set(profile.profileCompletionPercent || 0);
					const currentUser = this.authStore.currentUser();
					if (currentUser) {
						this.authStore.authenticate(this.authStore.token()!, {
							...currentUser,
							profileCompletionPercent: profile.profileCompletionPercent
						});
					}

					if (res.data.latestHistory) {
						// Update change requests silently from main payload if available
						this.changeRequests.set(res.data.latestHistory);
					}

					if (this.isClient) {
						this.clientForm.patchValue(profile);
						const pAny = profile as any;
						if (pAny.interests) this.interests.set(pAny.interests);
					} else {
						this.providerForm.patchValue(profile);
						if (profile.skills) this.skills.set(profile.skills);
						const pAny = profile as any;
						if (pAny.interests) this.interests.set(pAny.interests);
					}

					this.basicsForm.patchValue(profile);
					this.identityForm.patchValue(profile);
					this.contactForm.patchValue(profile);
					this.bankingForm.patchValue(profile);

					// Map pending changes over the verified forms to reflect what the user submitted
					const requests = this.changeRequests();
					if (requests && requests.length > 0) {
						requests.filter(r => r.status === 'PENDING').forEach(req => {
							if (req.tabName === 'BASICS_UPDATE') {
								this.basicsForm.patchValue(req.requestedChanges);
								this.basicsForm.disable();
							}
							else if (req.tabName === 'IDENTITY_UPDATE') {
								this.identityForm.patchValue(req.requestedChanges);
								this.identityForm.disable();
							}
							else if (req.tabName === 'CONTACT_UPDATE') {
								this.contactForm.patchValue(req.requestedChanges);
								this.contactForm.disable();
							}
							else if (req.tabName === 'BANKING_UPDATE') {
								this.bankingForm.patchValue(req.requestedChanges);
								this.bankingForm.disable();
							}
						});
					}
				}
			},
			error: (err) => {
				this.isLoading.set(false);
				this.errorMsg.set('فشل في تحميل بيانات الملف الشخصي');
			}
		});
	}

	switchTab(tab: Tab) {
		this.activeTab.set(tab);
	}

	setPaymentMethod(method: 'bank' | 'wallet') {
		this.paymentMethod.set(method);
	}

	togglePasswordChange() {
		this.isChangingPassword.update(v => !v);
	}

	getCurrentAvatarUrl(): string | null {
		if (this.isClient) return this.clientForm.get('avatarUrl')?.value;
		if (this.isProvider) return this.providerForm.get('avatarUrl')?.value;
		return null;
	}

	onAvatarUpload(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (file) {
			if (file.size > 5 * 1024 * 1024) {
				this.errorMsg.set('حجم الصورة يجب أن لا يتجاوز 5MB');
				return;
			}
			const reader = new FileReader();
			reader.onload = () => {
				const base64 = reader.result as string;
				if (this.isClient) this.clientForm.patchValue({ avatarUrl: base64 });
				if (this.isProvider) this.providerForm.patchValue({ avatarUrl: base64 });

				// Auto-save the new avatar
				this.saveProfile();
			};
			reader.readAsDataURL(file);
		}
	}

	removeAvatar() {
		if (this.isClient) this.clientForm.patchValue({ avatarUrl: '' });
		if (this.isProvider) this.providerForm.patchValue({ avatarUrl: '' });

		// Auto-save the removal
		this.saveProfile();
	}

	onIdUpload(event: Event, side: 'front' | 'back') {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (file) {
			if (side === 'front') {
				this.frontIdFileName.set(file.name);
			} else {
				this.backIdFileName.set(file.name);
			}
		}
	}

	removeSkill(skill: string) {
		this.skills.update(s => s.filter(x => x !== skill));
	}

	addSkill(input: HTMLInputElement) {
		const val = input.value.trim();
		if (val && !this.skills().includes(val)) {
			this.skills.update(s => [...s, val]);
			input.value = '';
		}
	}

	removeInterest(tag: string) {
		this.interests.update(s => s.filter(x => x !== tag));
	}

	addInterest(input: HTMLInputElement) {
		const val = input.value.trim();
		if (val && !this.interests().includes(val)) {
			this.interests.update(s => [...s, val]);
			input.value = '';
		}
	}

	saveProfile() {
		this.errorMsg.set('');
		this.successMsg.set('');

		let payload: any = {};
		if (this.isClient) {
			if (this.clientForm.invalid) {
				this.errorMsg.set('يرجى التأكد من صحة البيانات المدخلة (مثال: رابط الموقع يجب أن يبدأ بـ http)');
				return;
			}
			payload = { ...this.clientForm.value, interests: this.interests() };
		} else {
			if (this.providerForm.invalid) {
				this.errorMsg.set('يرجى التأكد من صحة البيانات المدخلة');
				return;
			}
			payload = { ...this.providerForm.value, skills: this.skills(), interests: this.interests() };
			// Ensure numeric rate
			if (payload.hourlyRate) payload.hourlyRate = Number(payload.hourlyRate);
		}

		this.isSaving.set(true);
		this.profileApi.updateProfile(payload).subscribe({
			next: (res) => {
				this.isSaving.set(false);
				if (res.success) {
					this.successMsg.set('تم تحديث بيانات البروفايل بنجاح!');
					setTimeout(() => this.successMsg.set(''), 3000);
				} else {
					this.errorMsg.set(res.message || 'حدث خطأ أثناء الحفظ');
				}
			},
			error: (err) => {
				this.isSaving.set(false);
				this.errorMsg.set(err.error?.message || 'فشل الحفظ، يرجى المحاولة مرة أخرى');
			}
		});
	}

	saveTab(tabName: string) {
		this.errorMsg.set('');
		this.successMsg.set('');

		let payload: any = {};
		let form: FormGroup | undefined;

		switch (tabName) {
			case 'basics': form = this.basicsForm; break;
			case 'identity': form = this.identityForm; break;
			case 'contact': form = this.contactForm; break;
			case 'banking': form = this.bankingForm; break;
		}

		if (!form) return;

		if (form.invalid) {
			this.errorMsg.set('يرجى التأكد من صحة البيانات المدخلة');
			return;
		}

		payload = form.value;

		this.isSaving.set(true);
		this.profileApi.updateTab(tabName, payload).subscribe({
			next: (res) => {
				this.isSaving.set(false);
				if (res.success) {
					this.successMsg.set(res.message || 'تم إرسال الطلب بنجاح');
					setTimeout(() => this.successMsg.set(''), 5000);
				} else {
					this.errorMsg.set(res.message || 'حدث خطأ أثناء الحفظ');
				}
			},
			error: (err) => {
				this.isSaving.set(false);
				this.errorMsg.set(err.error?.message || 'فشل الإرسال، يرجى المحاولة مرة أخرى');
			}
		});
	}
}
