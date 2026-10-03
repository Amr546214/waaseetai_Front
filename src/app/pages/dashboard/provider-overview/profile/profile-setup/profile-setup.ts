import { Component, inject, signal, computed, OnInit, OnDestroy, effect, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { CommonModule } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { AuthStore } from '../../../../../core/store/auth.store';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { SpecialtyService } from '../../../../../core/services/specialty.service';
import { SetupTestService } from '../../../../../core/services/setup-test.service';
import { COUNTRY_NAMES, citiesOf, cityPlaceholder, normalizeCountry } from '../../../../../shared/data/countries-cities';
import { linkCountryCity } from '../../../../../shared/data/country-city-form';
import { BioFieldDirective } from '../../../../../shared/directives/bio-field.directive';

export interface SetupAlertModal {
  type: 'warning' | 'error' | 'banned' | 'info';
  title: string;
  message: string;
  confirmText?: string;
  onConfirm?: () => void;
}

@Component({
	selector: 'app-profile-setup-dashboard',
	standalone: true,
	imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule, BioFieldDirective],
	templateUrl: './profile-setup.html',
	styleUrls: ['./profile-setup.css']
})
export class ProfileSetupDashboard implements OnInit, OnDestroy {
	private fb = inject(FormBuilder);
	private destroyRef = inject(DestroyRef);
	private router = inject(Router);
	private authStore = inject(AuthStore);
	private profileApi = inject(ProfileApiService);
	private providerProfileService = inject(ProviderProfileService);
	private specialtyService = inject(SpecialtyService);
	public setupTestService = inject(SetupTestService);

	// Shared country -> cities data (src/app/shared/data); the city list always follows the chosen country.
	readonly countryNames = COUNTRY_NAMES;
	readonly citiesOf = citiesOf;
	readonly cityPlaceholder = cityPlaceholder;

	isSubmitting = signal<boolean>(false);
	currentStep = signal<number>(1);

	particles: { style: string }[] = [];

	steps = [
		{ id: 1, label: 'البيانات المهنية' },
		{ id: 2, label: 'التخصصات والمهارات' },
		{ id: 3, label: 'البيانات البنكية' },
		{ id: 4, label: 'المستندات الرسمية' },
		{ id: 5, label: 'نماذج الأعمال' },
		{ id: 6, label: 'المراجعة والإرسال' },
		{ id: 7, label: 'اختبار التصنيف الأولي' }
	];

	setupForm: FormGroup = this.fb.group({
		profData: this.fb.group({
			jobTitle: ['', Validators.required],
			expYears: ['', Validators.required],
			country: ['', Validators.required],
			city: ['', Validators.required],
			languages: [[]],
			bio: ['', [Validators.required, Validators.maxLength(500)]],
			portfolioUrl: [''],
			linkedinUrl: [''],
			websiteUrl: [''],
			timezone: ['Asia/Riyadh']
		}),
		specialties: this.fb.group({
			mainSpec: ['', Validators.required],
			subSpecs: [[]]
		}),
		bank: this.fb.group({
			bankName: ['', Validators.required],
			accountOwner: ['', Validators.required],
			iban: ['', Validators.required]
		}),
		docs: this.fb.group({
			frontId: [''],
			backId: [''],
			selfie: [''],
			certs: [[]]
		}),
		agreements: this.fb.group({
			ackFinal: [false, Validators.requiredTrue]
		}),
		uiLanguage: ['ar']
	});

	availableLanguages = ['العربية', 'الإنجليزية', 'الفرنسية', 'الأردية', 'الهندية'];
	selectedLanguages = signal<string[]>(['العربية']);

	categories = signal<any[]>([]);
	subSpecialtiesList = signal<any[]>([]);
	selectedSpecs = signal<string[]>([]);

	uploadedFrontId = signal<string>('');
	uploadedFrontIdName = signal<string>('');
	uploadedBackIdName = signal<string>('');
	uploadedSelfieName = signal<string>('');
	uploadedCerts = signal<string[]>([]);
	uploadedCertsNames = signal<string[]>([]);
	isNafathVerified = signal<boolean>(false);
	isNafathVerifying = signal<boolean>(false);

	// Profile completion extras (P-AU-011)
	avatarPreview = signal<string>('');
	avatarUrl = signal<string>('');
	skillsList = signal<string[]>([]);
	skillInput = '';
	isSuggestingSkills = signal<boolean>(false);
	notifChannels = signal<string[]>(['email']);
	aiSuggestedSkills = signal<string[]>([]);
	skillsSuggestionError = signal('');
	skillsSuggestionReady = signal(false);

	// Upload progress states keyed by field identifier
	uploadStates = signal<Record<string, { status: 'uploading' | 'uploaded' | 'error'; progress: number; name: string }>>({});
	isUploading = computed(() => Object.values(this.uploadStates()).some(s => s.status === 'uploading'));

	// Portfolio — review/proofs store URLs; reviewDisplayName/proofDisplayNames store original filenames for UI
	portfolioItems = signal<Record<string, { review: string; reviewDisplayName: string; proofs: string[]; proofDisplayNames: string[] }[]>>({});

	// Test
	isTestStarted = signal<boolean>(false);
	testTotalTime = 0;
	testTimeLeft = signal<number>(0);
	testTimer: any;
	answeredCount = signal<number>(0);

	alertModal = signal<SetupAlertModal | null>(null);

	constructor() {
		linkCountryCity(this.setupForm.get('profData'), this.destroyRef);
		effect(() => {
			const w = this.setupTestService.warningMsg();
			if (w) {
				this.alertModal.set({
					type: 'warning',
					title: 'تنبيه من نظام مكافحة الغش',
					message: w,
					confirmText: 'فهمت، استكمال الاختبار',
					onConfirm: () => this.closeAlertModal()
				});
			}
		});
		effect(() => {
			const e = this.setupTestService.errorMsg();
			if (e) {
				this.alertModal.set({
					type: 'error',
					title: 'تنبيه في خادم الاختبار',
					message: e,
					confirmText: 'إغلاق',
					onConfirm: () => {
						this.closeAlertModal();
						this.isTestStarted.set(false);
					}
				});
			}
		});
		effect(() => {
			// Banned message listener disabled for testing
			const b = this.setupTestService.bannedMsg();
			if (b) {
				console.log('[SetupTest] Banned message suppressed for testing:', b);
			}
		});
		effect(() => {
			if (this.setupTestService.result()) {
				if (this.testTimer) clearInterval(this.testTimer);
			}
		});
	}

	closeAlertModal() {
		this.alertModal.set(null);
	}

	onConfirmAlertModal() {
		const modal = this.alertModal();
		if (modal && modal.onConfirm) {
			modal.onConfirm();
		} else {
			this.closeAlertModal();
		}
	}

	// (Removed static QBANK and DEFAULT_Q for AI implementation)

	ngOnInit() {
		this.generateParticles();
		this.setupForm.get('profData.languages')?.setValue(['العربية']);

		this.specialtyService.getCategories().subscribe(res => {
			if (res.success) {
				this.categories.set(res.data);
			}
		});

		this.setupForm.get('specialties.mainSpec')?.valueChanges.subscribe(val => {
			if (val) {
				const cat = this.categories().find(c => c.slug === val || c.id === val);
				const catId = cat ? cat.id : val;
				this.specialtyService.getPublicSpecialties(catId).subscribe(res => {
					if (res.success) {
						this.subSpecialtiesList.set(res.data.map((s: any) => s.nameAr));
					}
				});
			} else {
				this.subSpecialtiesList.set([]);
			}
			this.selectedSpecs.set([]);
			this.setupForm.get('specialties.subSpecs')?.setValue([]);
		});

		// Load saved data
		this.profileApi.getProviderProfileSetup().subscribe({
			next: (res: any) => {
				if (res && res.data) {
					const d = res.data;
					this.skillsList.set((d.skills || []).map((s: { name: string }) => s.name));
					this.setupForm.patchValue({
						profData: {
							jobTitle: d.industry || '',
							country: normalizeCountry(d.country),
							city: d.city || '',
							bio: d.bio || '',
							languages: d.languages && d.languages.length ? d.languages : ['العربية'],
							expYears: d.yearsOfExperience ? 
								(d.yearsOfExperience <= 1 ? 'أقل من سنة' : 
								 d.yearsOfExperience <= 3 ? '1 الى 3 سنوات' : 
								 d.yearsOfExperience <= 5 ? '3 الى 5 سنوات' : 
								 d.yearsOfExperience <= 9 ? '5 الى 10 سنوات' : 'أكثر من 10 سنوات') : ''
						},
						specialties: {
							mainSpec: d.mainSpecialty || '',
							subSpecs: d.subSpecialties || []
						},
						bank: {
							bankName: d.bankName || '',
							accountOwner: d.accountHolder || '',
							iban: d.iban || ''
						},
						docs: {
							frontId: d.frontIdUrl || '',
							backId: d.backIdUrl || ''
						},
						agreements: {
							ackFinal: d.accurateAgreed || false
						}
					});
					if (d.frontIdUrl) this.uploadedFrontId.set(d.frontIdUrl);
					if (d.certUrls && d.certUrls.length) this.uploadedCerts.set(d.certUrls);
					if (d.languages && d.languages.length) this.selectedLanguages.set(d.languages);
					if (d.subSpecialties && d.subSpecialties.length) this.selectedSpecs.set(d.subSpecialties);
					if (d.kycStatus === 'VERIFIED' || d.isNafathVerified) this.isNafathVerified.set(true);
				}
			}
		});
	}

	ngOnDestroy() {
		if (this.testTimer) clearInterval(this.testTimer);
		if (typeof document !== 'undefined') {
			document.removeEventListener('visibilitychange', this.onVisibilityChange);
		}
		this.setupTestService.disconnect();
	}

	generateParticles() {
		const isMob = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
		const cnt = isMob ? 11 : 25;
		const ps = [];
		for (let i = 0; i < cnt; i++) {
			const sz = (Math.random() * 2.5 + 2).toFixed(1) + 'px';
			ps.push({
				style: `left:${Math.random() * 100}%;width:${sz};height:${sz};animation-duration:${(Math.random() * 9 + 5).toFixed(1)}s;animation-delay:-${(Math.random() * 12).toFixed(1)}s;opacity:${(Math.random() * 0.5 + 0.1).toFixed(2)}`
			});
		}
		this.particles = ps;
	}

	goToStep(step: number) {
		if (step < 1 || step > 7) return;

		// Validation to prevent skipping
		if (step > this.currentStep()) {
			if (this.currentStep() === 1 && this.setupForm.get('profData')?.invalid) {
				this.setupForm.get('profData')?.markAllAsTouched();
				return;
			}
			if (this.currentStep() === 2 && this.setupForm.get('specialties')?.invalid) {
				this.setupForm.get('specialties')?.markAllAsTouched();
				return;
			}
			if (this.currentStep() === 3 && this.setupForm.get('bank')?.invalid) {
				this.setupForm.get('bank')?.markAllAsTouched();
				return;
			}
			if (this.currentStep() === 4 && (!this.uploadedFrontId())) {
				this.alertModal.set({
					type: 'warning', title: 'مستندات ناقصة', message: 'يرجى رفع صورة الهوية (الوجه الأمامي) للمتابعة.',
					confirmText: 'حسناً', onConfirm: () => this.closeAlertModal()
				});
				return;
			}
			if (this.currentStep() === 5) {
				let hasMissingProofs = false;
				this.selectedSpecs().forEach(s => {
					const items = this.portfolioItems()[s] || [];
					items.forEach(item => {
						if (!item.review) hasMissingProofs = true;
					});
				});
				if (hasMissingProofs || this.selectedSpecs().length === 0) {
					this.alertModal.set({
						type: 'warning', title: 'نماذج ناقصة', message: 'يرجى التأكد من رفع نموذج عمل لكل تخصص فرعي.',
						confirmText: 'حسناً', onConfirm: () => this.closeAlertModal()
					});
					return;
				}
			}
		}

		// Auto-init portfolio when reaching step 5
		if (step === 5) {
			const current = { ...this.portfolioItems() };
			let changed = false;
			this.selectedSpecs().forEach(s => {
				if (!current[s] || current[s].length === 0) {
					current[s] = [{ review: '', reviewDisplayName: '', proofs: [], proofDisplayNames: [] }];
					changed = true;
				}
			});
			if (changed) this.portfolioItems.set(current);
		}

		this.currentStep.set(step);
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	toggleLanguage(lang: string) {
		const current = [...this.selectedLanguages()];
		const idx = current.indexOf(lang);
		if (idx > -1) current.splice(idx, 1);
		else current.push(lang);
		this.selectedLanguages.set(current);
		this.setupForm.get('profData.languages')?.setValue(current);
	}

	toggleSpec(spec: string) {
		const current = [...this.selectedSpecs()];
		const idx = current.indexOf(spec);
		if (idx > -1) current.splice(idx, 1);
		else current.push(spec);
		this.selectedSpecs.set(current);
		this.setupForm.get('specialties.subSpecs')?.setValue(current);
	}

	onFileSelected(event: any, type: string) {
		const files = event.target.files;
		if (!files || files.length === 0) return;

		const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
		const maxSize = 10 * 1024 * 1024;

		if (type === 'frontId' || type === 'backId' || type === 'selfie') {
			const file = files[0] as File;
			if (file.size > maxSize) {
				this.alertModal.set({
					type: 'warning', title: 'حجم ملف كبير', message: 'حجم المستند يجب أن لا يتجاوز 10 ميجابايت.',
					confirmText: 'حسناً', onConfirm: () => this.closeAlertModal()
				});
				return;
			}
			if (!allowedTypes.includes(file.type)) {
				this.alertModal.set({
					type: 'warning', title: 'نوع ملف غير مدعوم', message: 'الملفات المسموحة PDF أو JPG أو PNG فقط.',
					confirmText: 'حسناً', onConfirm: () => this.closeAlertModal()
				});
				return;
			}
			this.uploadSingleDoc(file, type);
		} else if (type === 'certs') {
			const validFiles: File[] = [];
			for (const f of Array.from(files) as File[]) {
				if (f.size > maxSize) {
					this.alertModal.set({
						type: 'warning', title: 'حجم ملف كبير', message: `الملف ${f.name} يتجاوز 10 ميجابايت.`,
						confirmText: 'حسناً', onConfirm: () => this.closeAlertModal()
					});
					return;
				}
				if (!allowedTypes.includes(f.type)) {
					this.alertModal.set({
						type: 'warning', title: 'نوع ملف غير مدعوم', message: `الملف ${f.name} ليس PDF أو JPG أو PNG.`,
						confirmText: 'حسناً', onConfirm: () => this.closeAlertModal()
					});
					return;
				}
				validFiles.push(f);
			}
			this.uploadCerts(validFiles);
		}
	}

	// === Profile completion extras (P-AU-011) ===
	onAvatarSelected(event: any) {
		const file = event.target.files?.[0];
		if (!file) return;
		if (file.size > 5 * 1024 * 1024) {
			this.alertModal.set({
				type: 'warning', title: 'حجم ملف كبير', message: 'حجم الصورة يجب أن لا يتجاوز 5 ميجابايت.',
				confirmText: 'حسناً', onConfirm: () => this.closeAlertModal()
			});
			return;
		}
		if (!['image/jpeg', 'image/png'].includes(file.type)) {
			this.alertModal.set({
				type: 'warning', title: 'نوع ملف غير مدعوم', message: 'الصور المسموحة JPG أو PNG فقط.',
				confirmText: 'حسناً', onConfirm: () => this.closeAlertModal()
			});
			return;
		}
		const reader = new FileReader();
		reader.onload = () => this.avatarPreview.set(reader.result as string);
		reader.readAsDataURL(file);

		this.setUploadState('avatar', { status: 'uploading', progress: 0, name: file.name });
		this.providerProfileService.uploadDocument(file).subscribe({
			next: (event: any) => {
				if (event.type === HttpEventType.UploadProgress) {
					const progress = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
					this.setUploadState('avatar', { status: 'uploading', progress, name: file.name });
				}
				if (event.type === HttpEventType.Response) {
					const url = event.body?.data?.url || '';
					this.avatarUrl.set(url);
					this.setUploadState('avatar', { status: 'uploaded', progress: 100, name: file.name });
				}
			},
			error: () => this.setUploadState('avatar', { status: 'error', progress: 0, name: file.name })
		});
	}

	addSkill(event: Event) {
		event.preventDefault();
		const v = (this.skillInput || '').trim();
		if (!v) return;
		if (v.length <= 40 && this.skillsList().length < 30 && !this.skillsList().some(s => s.trim().toLowerCase() === v.toLowerCase())) {
			this.skillsList.update(list => [...list, v]);
		}
		this.skillInput = '';
	}

	removeSkill(skill: string) {
		this.skillsList.update(list => list.filter(s => s !== skill));
	}

	private suggestionInput() {
		return {
			jobTitle: this.setupForm.get('profData.jobTitle')?.value || undefined,
			mainSpecialty: this.setupForm.get('specialties.mainSpec')?.value || undefined,
			experienceRange: this.setupForm.get('profData.expYears')?.value || undefined,
			existingSkills: this.skillsList()
		};
	}

	suggestSkills() {
		if (this.isSuggestingSkills()) return;
		this.isSuggestingSkills.set(true);
		this.aiSuggestedSkills.set([]);
		this.skillsSuggestionError.set('');
		this.skillsSuggestionReady.set(false);
		this.providerProfileService.suggestSkills(this.suggestionInput()).pipe(
			takeUntilDestroyed(this.destroyRef), finalize(() => this.isSuggestingSkills.set(false))
		).subscribe({
			next: res => {
				if (!res.success || !Array.isArray(res.data?.suggestedSkills)) {
					this.skillsSuggestionError.set('تعذر إنشاء اقتراح بالذكاء الاصطناعي');
					return;
				}
				const existing = new Set(this.skillsList().map(s => s.trim().normalize('NFKC').toLowerCase()));
				this.aiSuggestedSkills.set(res.data.suggestedSkills.filter(s => {
					const key = s.trim().normalize('NFKC').toLowerCase();
					if (!key || existing.has(key)) return false;
					existing.add(key);
					return true;
				}));
				this.skillsSuggestionReady.set(true);
			},
			error: () => this.skillsSuggestionError.set('تعذر إنشاء اقتراح بالذكاء الاصطناعي. يرجى المحاولة مجدداً.')
		});
	}

	addAiSkill(skill: string) {
		if (!this.aiSuggestedSkills().includes(skill) || this.skillsList().length >= 30) return;
		const key = skill.trim().normalize('NFKC').toLowerCase();
		if (!this.skillsList().some(s => s.trim().normalize('NFKC').toLowerCase() === key)) {
			this.skillsList.update(list => [...list, skill]);
		}
		this.aiSuggestedSkills.update(list => list.filter(s => s !== skill));
	}

	setUiLanguage(lang: string) {
		this.setupForm.get('uiLanguage')?.setValue(lang);
	}

	// Profile completion percentage (P-AU-011 progress ring)
	profileCompletionPct(): number {
		let p = 20;
		if (this.avatarPreview()) p += 30;
		const bio = (this.setupForm.get('profData.bio')?.value || '').trim();
		if (bio.length > 20) p += 20;
		if (this.skillsList().length >= 3) p += 15;
		const links = this.setupForm.get('profData.portfolioUrl')?.value || this.setupForm.get('profData.linkedinUrl')?.value;
		if (links) p += 15;
		return Math.min(100, p);
	}

	profileCompletionDeg(): number {
		return Math.round(this.profileCompletionPct() * 3.6);
	}

	toggleNotifChannel(channel: string) {
		this.notifChannels.update(list =>
			list.includes(channel) ? list.filter(c => c !== channel) : [...list, channel]
		);
	}

	private uploadSingleDoc(file: File, type: string) {
		const key = type;
		this.setUploadState(key, { status: 'uploading', progress: 0, name: file.name });

		if (type === 'frontId') this.uploadedFrontIdName.set(file.name);
		if (type === 'backId') this.uploadedBackIdName.set(file.name);
		if (type === 'selfie') this.uploadedSelfieName.set(file.name);

		this.providerProfileService.uploadDocument(file).subscribe({
			next: (event: any) => {
				if (event.type === HttpEventType.UploadProgress) {
					const progress = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
					this.setUploadState(key, { status: 'uploading', progress, name: file.name });
				}
				if (event.type === HttpEventType.Response) {
					const url = event.body?.data?.url || '';
					const name = event.body?.data?.name || file.name;
					this.setUploadState(key, { status: 'uploaded', progress: 100, name });
					if (type === 'frontId') {
						this.uploadedFrontId.set(url);
						this.uploadedFrontIdName.set(name);
						this.setupForm.get('docs.frontId')?.setValue(url);
					}
					if (type === 'backId') {
						this.setupForm.get('docs.backId')?.setValue(url);
						this.uploadedBackIdName.set(name);
					}
					if (type === 'selfie') {
						this.setupForm.get('docs.selfie')?.setValue(url);
						this.uploadedSelfieName.set(name);
					}
				}
			},
			error: () => {
				this.setUploadState(key, { status: 'error', progress: 0, name: file.name });
			}
		});
	}

	private uploadCerts(files: File[]) {
		const key = 'certs';
		this.setUploadState(key, { status: 'uploading', progress: 0, name: `${files.length} ملفات` });

		const urls: string[] = [];
		const names: string[] = [];
		let completed = 0;
		let hasError = false;

		files.forEach((file, idx) => {
			this.setUploadState(`${key}-${idx}`, { status: 'uploading', progress: 0, name: file.name });

			this.providerProfileService.uploadDocument(file).subscribe({
				next: (event: any) => {
					if (event.type === HttpEventType.UploadProgress) {
						const progress = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
						this.setUploadState(`${key}-${idx}`, { status: 'uploading', progress, name: file.name });
					}
					if (event.type === HttpEventType.Response) {
						const url = event.body?.data?.url || '';
						const name = event.body?.data?.name || file.name;
						urls.push(url);
						names.push(name);
						this.setUploadState(`${key}-${idx}`, { status: 'uploaded', progress: 100, name });
						completed++;
						if (completed === files.length && !hasError) {
							this.uploadedCerts.set(urls);
							this.uploadedCertsNames.set(names);
							this.setupForm.get('docs.certs')?.setValue(urls);
							this.setUploadState(key, { status: 'uploaded', progress: 100, name: `${files.length} ملفات` });
						}
					}
				},
				error: () => {
					hasError = true;
					this.setUploadState(`${key}-${idx}`, { status: 'error', progress: 0, name: file.name });
					this.setUploadState(key, { status: 'error', progress: 0, name: `${files.length} ملفات` });
				}
			});
		});
	}

	private setUploadState(key: string, state: { status: 'uploading' | 'uploaded' | 'error'; progress: number; name: string }) {
		this.uploadStates.update(s => ({ ...s, [key]: state }));
	}

	getUploadState(key: string) {
		return this.uploadStates()[key];
	}

	removeUploadedFile(type: string) {
		const states = { ...this.uploadStates() };
		delete states[type];
		this.uploadStates.set(states);
		if (type === 'frontId') {
			this.uploadedFrontId.set('');
			this.uploadedFrontIdName.set('');
			this.setupForm.get('docs.frontId')?.setValue('');
		} else if (type === 'backId') {
			this.uploadedBackIdName.set('');
			this.setupForm.get('docs.backId')?.setValue('');
		} else if (type === 'selfie') {
			this.uploadedSelfieName.set('');
			this.setupForm.get('docs.selfie')?.setValue('');
		} else if (type === 'certs') {
			this.uploadedCerts.set([]);
			this.uploadedCertsNames.set([]);
			this.setupForm.get('docs.certs')?.setValue([]);
		}
	}

	triggerNafath() {
		// Backend gap: No confirmed NAFATH initiate/verify endpoint.
		// Do NOT set isNafathVerified = true automatically.
		this.alertModal.set({
			type: 'info',
			title: 'نفاذ غير مفعّل',
			message: 'التحقق عبر نفاذ غير مفعّل حاليًا، وسيتم تفعيله بعد اعتماد واجهة التحقق من الخادم.',
			confirmText: 'حسناً',
			onConfirm: () => this.closeAlertModal()
		});
	}

	getPortfolioCount(spec: string) {
		const items = this.portfolioItems()[spec] || [];
		return items.length === 1 ? 'نموذج واحد مرفوع' : items.length + ' نماذج مرفوعة';
	}

	getPortfolioItems(spec: string) {
		return this.portfolioItems()[spec] || [];
	}

	addPortfolioItem(spec: string) {
		const current = { ...this.portfolioItems() };
		if (!current[spec]) current[spec] = [];
		current[spec].push({ review: '', reviewDisplayName: '', proofs: [], proofDisplayNames: [] });
		this.portfolioItems.set(current);
	}

	removePortfolioItem(spec: string, idx: number) {
		const current = { ...this.portfolioItems() };
		if (current[spec]) {
			current[spec].splice(idx, 1);
			if (current[spec].length === 0) current[spec] = [{ review: '', reviewDisplayName: '', proofs: [], proofDisplayNames: [] }];
			this.portfolioItems.set(current);
		}
	}

	onPortfolioReviewChange(event: any, spec: string, idx: number) {
		if (event.target.files && event.target.files[0]) {
			const file = event.target.files[0] as File;
			const maxSize = 10 * 1024 * 1024;
			if (file.size > maxSize) {
				this.alertModal.set({
					type: 'warning', title: 'حجم ملف كبير', message: 'حجم المستند يجب أن لا يتجاوز 10 ميجابايت.',
					confirmText: 'حسناً', onConfirm: () => this.closeAlertModal()
				});
				return;
			}
			const key = `portfolio-review-${spec}-${idx}`;
			this.setUploadState(key, { status: 'uploading', progress: 0, name: file.name });

			const current = { ...this.portfolioItems() };
			current[spec][idx].reviewDisplayName = file.name;
			this.portfolioItems.set(current);

			this.providerProfileService.uploadDocument(file).subscribe({
				next: (event: any) => {
					if (event.type === HttpEventType.UploadProgress) {
						const progress = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
						this.setUploadState(key, { status: 'uploading', progress, name: file.name });
					}
					if (event.type === HttpEventType.Response) {
						const url = event.body?.data?.url || '';
						const name = event.body?.data?.name || file.name;
						const c = { ...this.portfolioItems() };
						c[spec][idx].review = url;
						c[spec][idx].reviewDisplayName = name;
						this.portfolioItems.set(c);
						this.setUploadState(key, { status: 'uploaded', progress: 100, name });
					}
				},
				error: () => {
					this.setUploadState(key, { status: 'error', progress: 0, name: file.name });
				}
			});
		}
	}

	onPortfolioProofsChange(event: any, spec: string, idx: number) {
		if (event.target.files && event.target.files.length > 0) {
			const files = Array.from(event.target.files) as File[];
			const maxSize = 10 * 1024 * 1024;

			for (const f of files) {
				if (f.size > maxSize) {
					this.alertModal.set({
						type: 'warning', title: 'حجم ملف كبير', message: `الملف ${f.name} يتجاوز 10 ميجابايت.`,
						confirmText: 'حسناً', onConfirm: () => this.closeAlertModal()
					});
					return;
				}
			}

			files.forEach((file, proofIdx) => {
				const baseProofIdx = this.portfolioItems()[spec][idx].proofs.length;
			const key = `portfolio-proof-${spec}-${idx}-${baseProofIdx}`;
			this.setUploadState(key, { status: 'uploading', progress: 0, name: file.name });

				const current = { ...this.portfolioItems() };
				current[spec][idx].proofDisplayNames.push(file.name);
				current[spec][idx].proofs.push(''); // placeholder until upload completes
			this.portfolioItems.set(current);

				this.providerProfileService.uploadDocument(file).subscribe({
					next: (ev: any) => {
						if (ev.type === HttpEventType.UploadProgress) {
							const progress = ev.total ? Math.round((ev.loaded / ev.total) * 100) : 0;
							this.setUploadState(key, { status: 'uploading', progress, name: file.name });
						}
						if (ev.type === HttpEventType.Response) {
							const url = ev.body?.data?.url || '';
							const name = ev.body?.data?.name || file.name;
							const c = { ...this.portfolioItems() };
							c[spec][idx].proofs[baseProofIdx] = url;
							c[spec][idx].proofDisplayNames[baseProofIdx] = name;
							this.portfolioItems.set(c);
							this.setUploadState(key, { status: 'uploaded', progress: 100, name });
						}
					},
					error: () => {
						this.setUploadState(key, { status: 'error', progress: 0, name: file.name });
					}
				});
			});
		}
	}

	removePortfolioProof(spec: string, itemIdx: number, proofIdx: number) {
		const current = { ...this.portfolioItems() };
		current[spec][itemIdx].proofs.splice(proofIdx, 1);
		current[spec][itemIdx].proofDisplayNames.splice(proofIdx, 1);
		this.portfolioItems.set(current);
	}

	private sanitizePortfolioForPayload(items: Record<string, { review: string; reviewDisplayName: string; proofs: string[]; proofDisplayNames: string[] }[]>): Record<string, { review: string; proofs: string[] }[]> {
		const sanitized: Record<string, { review: string; proofs: string[] }[]> = {};
		for (const key of Object.keys(items)) {
			sanitized[key] = items[key].map(item => ({
				review: item.review,
				proofs: item.proofs
			}));
		}
		return sanitized;
	}

	saveAndGoToTest() {
		if (this.isUploading()) {
			this.alertModal.set({
				type: 'warning', title: 'جاري رفع الملفات', message: 'يرجى انتظار اكتمال رفع جميع الملفات قبل المتابعة.',
				confirmText: 'حسناً', onConfirm: () => this.closeAlertModal()
			});
			return;
		}
		if (this.setupForm.invalid || !this.uploadedFrontId()) {
			this.setupForm.markAllAsTouched();
			this.alertModal.set({
				type: 'error', title: 'بيانات ناقصة', message: 'يرجى التحقق من إكمال جميع الحقول المطلوبة والموافقة على الشروط.',
				confirmText: 'حسناً', onConfirm: () => this.closeAlertModal()
			});
			return;
		}

		this.isSubmitting.set(true);
		const payload = {
			skills: this.skillsList(),
			details: {
				occupation: this.setupForm.get('profData.jobTitle')?.value,
				country: this.setupForm.get('profData.country')?.value,
				city: this.setupForm.get('profData.city')?.value,
				bio: this.setupForm.get('profData.bio')?.value,
				languages: this.setupForm.get('profData.languages')?.value,
				expYears: this.setupForm.get('profData.expYears')?.value
			},
			specialties: {
				mainSpec: this.setupForm.get('specialties.mainSpec')?.value,
				subSpecs: this.setupForm.get('specialties.subSpecs')?.value
			},
			identity: {
				frontId: this.uploadedFrontId(),
				backId: this.setupForm.get('docs.backId')?.value,
				certs: this.uploadedCerts(),
				isNafathVerified: this.isNafathVerified()
			},
			portfolio: this.sanitizePortfolioForPayload(this.portfolioItems()),

			bank: {
				bankName: this.setupForm.get('bank.bankName')?.value,
				accountHolder: this.setupForm.get('bank.accountOwner')?.value,
				iban: this.setupForm.get('bank.iban')?.value
			},
			agreements: {
				accurate: this.setupForm.get('agreements.ackFinal')?.value,
				terms: this.setupForm.get('agreements.ackFinal')?.value,
				privacy: this.setupForm.get('agreements.ackFinal')?.value
			}
		};

		this.profileApi.saveProviderProfileSetup(payload).subscribe({
			next: () => {
				this.isSubmitting.set(false);
				const user = this.authStore.currentUser();
				if (user) {
					// Use 'any' to cast the status temporarily if UserStatus enum requires import update
					this.authStore.updateUser({ ...user, status: 'ACTIVE' as any, profileCompletionPercent: 100 });
				}
				this.goToStep(7);
			},
			error: (error) => {
				this.isSubmitting.set(false);
				this.alertModal.set({ type: 'error', title: 'تعذر الحفظ', message: error.error?.message || 'تعذر حفظ البيانات. يرجى المحاولة مجدداً.' });
			}
		});
	}

	startTest() {
		this.isTestStarted.set(true);
		this.setupTestService.startTest();

		this.testTotalTime = 30 * 60; // 30 mins
		this.testTimeLeft.set(this.testTotalTime);
		this.testTimer = setInterval(() => {
			const current = this.testTimeLeft() - 1;
			this.testTimeLeft.set(current);
			if (current <= 0) {
				clearInterval(this.testTimer);
				this.alertModal.set({
					type: 'info',
					title: 'انتهى الوقت المحدد',
					message: 'انتهى وقت الاختبار تلقائياً.',
					confirmText: 'العودة للوحة التحكم',
					onConfirm: () => {
						this.closeAlertModal();
						this.router.navigate(['/provider-overview']);
					}
				});
			}
		}, 1000);

		// Anti-cheat visibility listener disabled for testing
		// document.addEventListener('visibilitychange', this.onVisibilityChange);
	}

	submitAnswer(index: number) {
		const q = this.setupTestService.currentQuestion();
		if (!q) return;
		this.setupTestService.submitAnswer(q.id, index);
		this.answeredCount.set(this.answeredCount() + 1);
	}

	visibilityDebounce: any;
	onVisibilityChange = () => {
		if (document.hidden && this.isTestStarted() && !this.setupTestService.result()) {
			clearTimeout(this.visibilityDebounce);
			this.visibilityDebounce = setTimeout(() => {
				this.setupTestService.triggerAntiCheat('VISIBILITY_HIDDEN');
			}, 1000);
		}
	};

	formattedTimeLeft() {
		const t = this.testTimeLeft();
		const m = Math.floor(t / 60);
		const s = t % 60;
		return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
	}

	// === P-AU-012 test enhancements ===
	testLevelLabel() {
		const score = this.setupTestService.result()?.score || 0;
		if (score >= 85) return 'احترافي · المستوى 4';
		if (score >= 70) return 'بارع · المستوى 3';
		if (score >= 50) return 'تطبيقي · المستوى 2';
		return 'تمهيدي · المستوى 1';
	}

	testTimeSpent() {
		const spent = this.testTotalTime - this.testTimeLeft();
		const m = Math.floor(spent / 60);
		const s = spent % 60;
		return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
	}



	canGoPrev() {
		const idx = this.setupTestService.currentQuestion()?.index ?? 0;
		return idx > 0;
	}

	prevQuestion() {
		if (!this.canGoPrev()) return;
		// Optional: navigate to previous question if service supports it
		const svc = this.setupTestService as any;
		if (typeof svc.goToPreviousQuestion === 'function') {
			svc.goToPreviousQuestion();
		}
	}

	pauseTest() {
		this.alertModal.set({
			type: 'info',
			title: 'إيقاف مؤقت',
			message: 'تم إيقاف الاختبار مؤقتاً. يمكنك استئنافه في أي وقت قبل انتهاء الوقت.',
			confirmText: 'استئناف',
			onConfirm: () => this.closeAlertModal()
		});
	}

	finishTestProcess() {
		this.router.navigate(['/provider-overview']);
	}
}
