import { Component, inject, signal, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthStore } from '../../../../../core/store/auth.store';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { SpecialtyService } from '../../../../../core/services/specialty.service';
import { SetupTestService } from '../../../../../core/services/setup-test.service';

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
	imports: [CommonModule, RouterModule, ReactiveFormsModule],
	templateUrl: './profile-setup.html',
	styleUrls: ['./profile-setup.css']
})
export class ProfileSetupDashboard implements OnInit, OnDestroy {
	private fb = inject(FormBuilder);
	private router = inject(Router);
	private authStore = inject(AuthStore);
	private profileApi = inject(ProfileApiService);
	private specialtyService = inject(SpecialtyService);
	public setupTestService = inject(SetupTestService);

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
			country: ['السعودية', Validators.required],
			city: ['', Validators.required],
			languages: [[]],
			bio: ['', Validators.required]
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
			certs: [[]]
		}),
		agreements: this.fb.group({
			ackFinal: [false, Validators.requiredTrue]
		})
	});

	availableLanguages = ['العربية', 'الإنجليزية', 'الفرنسية', 'الأردية', 'الهندية'];
	selectedLanguages = signal<string[]>(['العربية']);

	categories = signal<any[]>([]);
	subSpecialtiesList = signal<any[]>([]);
	selectedSpecs = signal<string[]>([]);

	uploadedFrontId = signal<string>('');
	uploadedCerts = signal<string[]>([]);
	isNafathVerified = signal<boolean>(false);
	isNafathVerifying = signal<boolean>(false);

	// Portfolio
	portfolioItems = signal<Record<string, { review: string; proofs: string[] }[]>>({});

	// Test
	isTestStarted = signal<boolean>(false);
	testTotalTime = 0;
	testTimeLeft = signal<number>(0);
	testTimer: any;
	answeredCount = signal<number>(0);

	alertModal = signal<SetupAlertModal | null>(null);

	constructor() {
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
					this.setupForm.patchValue({
						profData: {
							jobTitle: d.industry || '',
							country: d.country || 'السعودية',
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
					current[s] = [{ review: '', proofs: [] }];
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
		if (files && files.length > 0) {
			if (type === 'frontId') {
				this.uploadedFrontId.set(files[0].name);
				this.setupForm.get('docs.frontId')?.setValue(files[0].name);
			} else if (type === 'backId') {
				this.setupForm.get('docs.backId')?.setValue(files[0].name);
			} else if (type === 'certs') {
				const names = Array.from(files).map((f: any) => f.name);
				this.uploadedCerts.set(names);
				this.setupForm.get('docs.certs')?.setValue(names);
			}
		}
	}

	triggerNafath() {
		this.isNafathVerifying.set(true);
		setTimeout(() => {
			this.isNafathVerifying.set(false);
			this.isNafathVerified.set(true);
		}, 1800);
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
		current[spec].push({ review: '', proofs: [] });
		this.portfolioItems.set(current);
	}

	removePortfolioItem(spec: string, idx: number) {
		const current = { ...this.portfolioItems() };
		if (current[spec]) {
			current[spec].splice(idx, 1);
			if (current[spec].length === 0) current[spec] = [{ review: '', proofs: [] }];
			this.portfolioItems.set(current);
		}
	}

	onPortfolioReviewChange(event: any, spec: string, idx: number) {
		if (event.target.files && event.target.files[0]) {
			const current = { ...this.portfolioItems() };
			current[spec][idx].review = event.target.files[0].name;
			this.portfolioItems.set(current);
		}
	}

	onPortfolioProofsChange(event: any, spec: string, idx: number) {
		if (event.target.files && event.target.files.length > 0) {
			const current = { ...this.portfolioItems() };
			const names = Array.from(event.target.files).map((f: any) => f.name);
			current[spec][idx].proofs.push(...names);
			this.portfolioItems.set(current);
		}
	}

	removePortfolioProof(spec: string, itemIdx: number, proofIdx: number) {
		const current = { ...this.portfolioItems() };
		current[spec][itemIdx].proofs.splice(proofIdx, 1);
		this.portfolioItems.set(current);
	}

	saveAndGoToTest() {
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
			portfolio: this.portfolioItems(),

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
			error: () => {
				this.isSubmitting.set(false);
				this.goToStep(7); // Proceed anyway for UI flow
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

	finishTestProcess() {
		this.router.navigate(['/provider-overview']);
	}
}
