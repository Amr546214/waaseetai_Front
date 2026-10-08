import { Component, DestroyRef, ElementRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { PhoneChange } from '../../../../../sheards/phone-change/phone-change';
import { PhoneInputComponent } from '../../../../../sheards/phone-input/phone-input.component';
import { AuthStore } from '../../../../../core/store/auth.store';
import { ExperienceLevel } from '../../../../../core/models/profile.model';
import { COUNTRY_NAMES, citiesOf, cityPlaceholder, normalizeCountry } from '../../../../../shared/data/countries-cities';
import { linkCountryCity } from '../../../../../shared/data/country-city-form';
import type { CompletionMissingItem } from '../../../../../core/services/profile-api.service';
import { paypalEmailError, paypalEmailOptionalValidators } from '../../../../../core/validators/paypal-email.validator';
import { AccountType, UserRole } from '../../../../../core/models/auth.model';
import { BioFieldDirective } from '../../../../../shared/directives/bio-field.directive';
import { applyServerFieldErrors, attemptSubmit, InvalidField } from '../../../../../core/forms/form-helpers';
import { mapHttpError } from '../../../../../core/forms/http-error';
import { httpUrlValidator } from '../../../../../core/forms/url.validator';
import { IMAGE_MIMES, MB, validateFile } from '../../../../../core/forms/file-validation';
import { FieldErrorComponent } from '../../../../../shared/forms/field-error.component';
import { FormSummaryComponent } from '../../../../../shared/forms/form-summary.component';

const PROFILE_LABELS: Record<string, string> = {
	firstName: 'الاسم الأول',
	lastName: 'الاسم الأخير',
	website: 'موقع الشركة',
	bio: 'النبذة التعريفية',
	alternativePhone: 'رقم WhatsApp',
	city: 'مدينة الإقامة',
	country: 'الدولة',
};

type Tab = 'profile' | 'basics' | 'identity' | 'contact' | 'banking' | 'security';

@Component({
	selector: 'app-profile-edit',
	standalone: true,
	imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, PhoneInputComponent, PhoneChange, BioFieldDirective, FieldErrorComponent, FormSummaryComponent],
	templateUrl: './profile-edit.html',
	styleUrl: './profile-edit.css',
})
export class ProfileEdit {
	// Shared country -> cities data (src/app/shared/data); the city list always follows the chosen country.
	readonly countryNames = COUNTRY_NAMES;
	readonly citiesOf = citiesOf;
	readonly cityPlaceholder = cityPlaceholder;
	private destroyRef = inject(DestroyRef);
	authStore = inject(AuthStore);
	profileApi = inject(ProfileApiService);
	fb = inject(FormBuilder);
	private readonly host = inject(ElementRef<HTMLElement>);
	private readonly router = inject(Router);
	/** What is missing after a failed save attempt (shown by <ws-form-summary>). */
	missing = signal<InvalidField[]>([]);

	activeTab = signal<Tab>('profile');
	/** PayPal is the only supported receiving method ('wallet' = PayPal); 'bank' is shown disabled. */
	paymentMethod = signal<'bank' | 'wallet'>('wallet');
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

	/** What the backend still needs for 100% (GET /profiles/me -> missingItems). Same source as the percentage above. */
	missingItems = signal<CompletionMissingItem[]>([]);

	private applyCompletion(profile: any) {
		this.completionPercentage.set(Number(profile?.profileCompletionPercent ?? profile?.completionPercentage) || 0);
		this.missingItems.set(Array.isArray(profile?.missingItems) ? profile.missingItems : []);
	}

	/** Re-reads only the completion after a save (the forms keep what the user typed). */
	private refreshCompletion() {
		this.profileApi.getMyProfile().subscribe({
			next: (res) => this.applyCompletion(res?.data?.currentProfileData || res?.data),
			error: () => { /* keeps the last value */ },
		});
	}

	/**
	 * "Complete your profile" item: edit-page tabs open here; items only the setup wizard collects (occupation, ID number)
	 * go to the wizard. Nothing links to a disabled form.
	 */
	openMissingItem(item: CompletionMissingItem) {
		if (item.tab === 'setup') { this.router.navigate(['/client-overview/profile-setup']); return; }
		if (item.tab === 'profile' || item.tab === 'basics' || item.tab === 'banking' || item.tab === 'contact') {
			this.switchTab(item.tab as Tab);
			setTimeout(() => this.host.nativeElement.querySelector('form')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), 30);
		}
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
		// accountType is fixed at signup and never changes even after a user
		// adds another role and switches dashboards (see the backend's own
		// profile.controller.ts comment: "target role is the caller's
		// CURRENTLY ACTIVE role, not original signup accountType"). This page
		// is reachable only from the client dashboard (client.routes.ts), so
		// a provider who later added a CLIENT role and switched activeRole
		// to CLIENT would previously still match accountType.includes
		// ('PROVIDER') and silently render the provider form here — with
		// hourlyRate/experienceLevel fields that don't belong on a client
		// profile. Key off activeRole instead; fall back to accountType only
		// when activeRole isn't populated (single-role legacy accounts).
		const activeRole = currentUser?.activeRole;
		if (activeRole) {
			this.isClient = activeRole === UserRole.CLIENT;
			this.isProvider = activeRole === UserRole.PROVIDER;
		} else {
			this.isClient = this.accountType.includes('CLIENT');
			this.isProvider = this.accountType.includes('PROVIDER');
		}
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
			// Backend updateProfileSchema: website must be a URL, bio max 1000 (names min 2, above).
			website: ['', [httpUrlValidator]],
			bio: ['', [Validators.maxLength(1000)]],
			// The fields below are shown but NOT persisted for a client (see CLIENT_UNSAVED_FIELDS).
			portfolioUrl: ['', [httpUrlValidator]],
			linkedinUrl: ['', [httpUrlValidator]],
			personalWebsiteUrl: ['', [httpUrlValidator]],
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

		// Only the name is saved by PUT /profiles/update/basics (the backend ignores email/phone: the verification flow
		// for them does not exist yet), so those two are read-only and never sent.
		this.basicsForm = this.fb.group({
			firstName: ['', [Validators.minLength(2)]],
			lastName: ['', [Validators.minLength(2)]],
			email: [{ value: '', disabled: true }],
			phoneNumber: [{ value: '', disabled: true }]
		});

		this.identityForm = this.fb.group({
			idNumber: [''],
			// not stored anywhere yet (no database column): read-only, never sent
			idExpiryDate: [{ value: '', disabled: true }],
			nationality: [{ value: '', disabled: true }],
			country: [''],
			city: ['']
		});

		// PUT /profiles/update/contact saves only alternativePhone (and city); email, phone and country are ignored.
		this.contactForm = this.fb.group({
			email: [{ value: '', disabled: true }],
			phoneNumber: [{ value: '', disabled: true }],
			alternativePhone: [''],
			country: [''],
			city: ['']
		});

		linkCountryCity(this.identityForm, this.destroyRef);
		linkCountryCity(this.contactForm, this.destroyRef);

		this.bankingForm = this.fb.group({
			paymentMethod: ['wallet'],
			// Optional here: empty on save removes the saved address ({ paypalPayoutEmail: null }). The setup wizard keeps it required.
			paypalEmail: ['', paypalEmailOptionalValidators],
			// Legacy saved values: kept in the form model so nothing stored is dropped, but never shown or sent.
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

					this.applyCompletion(profile);
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
					// GET returns the saved address as paypalPayoutEmail; the form control is paypalEmail.
					this.bankingForm.patchValue({ paypalEmail: (profile as any).paypalPayoutEmail || '' });

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
		this.missing.set([]);
		this.errorMsg.set('');
		this.successMsg.set('');
		this.activeTab.set(tab);
	}

	/** Only PayPal ('wallet') can be chosen; 'bank' is unavailable for now. */
	setPaymentMethod(method: 'bank' | 'wallet') {
		if (method !== 'wallet') return;
		this.paymentMethod.set('wallet');
	}

	paypalEmailMsg(): string | null {
		const c = this.bankingForm?.get('paypalEmail');
		return c && (c.touched || c.dirty) ? paypalEmailError(c.errors) : null;
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
			const problem = validateFile(file, { maxBytes: 5 * MB, mimeTypes: IMAGE_MIMES, typesLabel: 'JPG أو PNG أو WEBP' });
			if (problem) {
				this.errorMsg.set(`الصورة الشخصية: ${problem}`);
				(event.target as HTMLInputElement).value = '';
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

	/**
	 * Fields of the client form that PUT /profiles/update does not persist for a CLIENT (the zod schema drops them) or
	 * cannot store (linkedinUrl is a provider column: the CLIENT upsert would hit an unknown column). They are shown
	 * disabled with a notice and never sent.
	 */
	static readonly CLIENT_UNSAVED_FIELDS = ['portfolioUrl', 'linkedinUrl', 'personalWebsiteUrl', 'interfaceLanguage', 'timezone'];

	private root(): HTMLElement {
		return this.host.nativeElement as HTMLElement;
	}

	/** Server rejection -> Arabic message; zod-style field errors go on the matching inputs. */
	private showSaveError(form: FormGroup, err: unknown, fallback: string) {
		const mapped = mapHttpError(err, { fallback });
		const unmatched = applyServerFieldErrors(form, mapped.fieldErrors);
		this.errorMsg.set(Object.keys(mapped.fieldErrors).length && !unmatched.length ? 'يرجى تصحيح الحقول المحددة أدناه' : mapped.message);
		if (Object.keys(mapped.fieldErrors).length) {
			setTimeout(() => this.missing.set(attemptSubmit(form, { root: this.root(), labels: PROFILE_LABELS }).missing), 30);
		}
	}

	saveProfile() {
		this.errorMsg.set('');
		this.successMsg.set('');

		let payload: any = {};
		const form = this.isClient ? this.clientForm : this.providerForm;
		const attempt = attemptSubmit(form, { root: this.root(), labels: PROFILE_LABELS });
		this.missing.set(attempt.missing);
		if (!attempt.valid) return;

		if (this.isClient) {
			// Only what the backend stores for a client (see CLIENT_UNSAVED_FIELDS).
			const { portfolioUrl, linkedinUrl, personalWebsiteUrl, interfaceLanguage, timezone, ...saved } = this.clientForm.value;
			payload = saved;
		} else {
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
					this.refreshCompletion();
				} else {
					this.errorMsg.set(res.message || 'حدث خطأ أثناء الحفظ');
				}
			},
			error: (err) => {
				this.isSaving.set(false);
				this.showSaveError(form, err, 'فشل الحفظ، يرجى المحاولة مرة أخرى');
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

		if (tabName === 'identity') {
			// country / city save at once; the national id becomes a modification request for an admin (the server decides which).
			form.markAllAsTouched();
			const raw = this.identityForm.getRawValue();
			const idNumber = String(raw.idNumber || '').trim();
			if (idNumber && !/^[12]\d{9}$/.test(idNumber)) {
				this.errorMsg.set('رقم الهوية يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2');
				return;
			}
			this.errorMsg.set('');
			this.isSaving.set(true);
			this.profileApi.updateTab('identity', { idNumber: idNumber || undefined, country: raw.country || undefined, city: raw.city || undefined }).subscribe({
				next: (res) => {
					this.isSaving.set(false);
					if (res.success) {
						this.successMsg.set(res.message || 'تم الحفظ');
						setTimeout(() => this.successMsg.set(''), 6000);
						this.refreshCompletion();
					} else {
						this.errorMsg.set(res.message || 'تعذر الحفظ');
					}
				},
				error: (err) => {
					this.isSaving.set(false);
					this.showSaveError(this.identityForm, err, 'تعذر الحفظ، حاول مرة أخرى');
				}
			});
			return;
		}

		let clearingPaypal = false;
		if (tabName === 'banking') {
			// PayPal email only; legacy bank/wallet values are never sent (no empty overwrite).
			form.markAllAsTouched();
			if (this.bankingForm.get('paypalEmail')?.invalid) {
				this.errorMsg.set(paypalEmailError(this.bankingForm.get('paypalEmail')?.errors) || 'تحقق من بريد PayPal');
				return;
			}
			const email = String(this.bankingForm.value.paypalEmail || '').trim();
			// Empty = remove the saved address (exactly { paypalPayoutEmail: null }); otherwise the validated address.
			payload = { paypalPayoutEmail: email || null };
			clearingPaypal = !email;
		} else {
			const attempt = attemptSubmit(form, { root: this.root(), labels: PROFILE_LABELS });
			this.missing.set(attempt.missing);
			if (!attempt.valid) return;
			// Send only what the backend stores for the tab (everything else is ignored there).
			if (tabName === 'basics') payload = { firstName: form.getRawValue().firstName, lastName: form.getRawValue().lastName };
			else if (tabName === 'contact') payload = { alternativePhone: form.getRawValue().alternativePhone, city: form.getRawValue().city };
			else payload = form.value;
		}

		const doneMessage: Record<string, string> = {
			basics: 'تم حفظ الاسم بنجاح',
			contact: 'تم حفظ رقم WhatsApp والمدينة بنجاح',
			banking: 'تم حفظ بريد PayPal بنجاح',
		};
		this.isSaving.set(true);
		this.profileApi.updateTab(tabName, payload).subscribe({
			next: (res) => {
				this.isSaving.set(false);
				if (res.success) {
					this.successMsg.set(tabName === 'banking' && clearingPaypal ? 'تم إزالة بريد PayPal' : (doneMessage[tabName] || res.message || 'تم إرسال الطلب بنجاح'));
					setTimeout(() => this.successMsg.set(''), 5000);
					this.refreshCompletion();
				} else {
					this.errorMsg.set(res.message || 'حدث خطأ أثناء الحفظ');
				}
			},
			error: (err) => {
				this.isSaving.set(false);
				this.showSaveError(form!, err, 'فشل الإرسال، يرجى المحاولة مرة أخرى');
			}
		});
	}
}
