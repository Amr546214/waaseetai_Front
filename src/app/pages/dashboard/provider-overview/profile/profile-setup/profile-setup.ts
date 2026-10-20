import { requiredText } from '../../../../../core/forms/required-text.validator';
import { Component, ElementRef, inject, signal, computed, OnInit, OnDestroy, effect, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { CommonModule } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { AuthStore } from '../../../../../core/store/auth.store';
import { ProviderPrefsStore } from '../../../../../core/services/provider-prefs.store';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { SpecialtyService } from '../../../../../core/services/specialty.service';
import { SetupTestService, SETUP_TEST_QUESTION_COUNT, SETUP_TEST_TIME_LIMIT_MINUTES } from '../../../../../core/services/setup-test.service';
import { SPECIALTY_TEST_PASS_SCORE, SpecialtyTestComponent, type SpecialtyTestPhase, type SpecialtyTestQuestion, type SpecialtyTestResult } from '../../../../../shared/specialty-test/specialty-test.component';
import { COUNTRY_NAMES, citiesOf, cityPlaceholder, normalizeCountry } from '../../../../../shared/data/countries-cities';
import { linkCountryCity } from '../../../../../shared/data/country-city-form';
import { paypalEmailError, paypalEmailValidators } from '../../../../../core/validators/paypal-email.validator';
import { BioFieldDirective } from '../../../../../shared/directives/bio-field.directive';
import { attemptSubmit, collectInvalidFields, focusFirstInvalid, InvalidField } from '../../../../../core/forms/form-helpers';
import { mapHttpError } from '../../../../../core/forms/http-error';
import { WaitTimerService, waitScope } from '../../../../../core/wait/wait-timer.service';
import { isRateLimitError, rateLimitEndsAt, rateLimitToastMessage } from '../../../../../core/utils/rate-limit.util';
import { MB, validateFile } from '../../../../../core/forms/file-validation';
import { PaypalEmailConfirmComponent } from '../../../../../shared/forms/paypal-email-confirm.component';
import { FieldErrorComponent } from '../../../../../shared/forms/field-error.component';
import { FormSummaryComponent } from '../../../../../shared/forms/form-summary.component';
import { birthDateValidator, dobInputValue } from '../../../../../core/forms/birth-date';
import { SkillsPickerComponent } from '../../../../../shared/forms/skills-picker.component';
import { KycDocumentLink } from '../../../../../sheards/kyc-document-link/kyc-document-link';
import { KycAccess } from '../../../../../core/models/kyc-document.model';
import { PROVIDER_EDIT_PAGE, PROVIDER_SETUP_REDIRECT_MESSAGE, resolveProviderSetup } from './provider-setup-state';
import { PROVIDER_ACCESS_STATUS_URL, ProviderAccessService } from '../../../../../core/services/provider-access.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';

const SETUP_LABELS: Record<string, string> = {
	jobTitle: 'المسمى الوظيفي',
	expYears: 'سنوات الخبرة',
	country: 'الدولة',
	city: 'المدينة',
	bio: 'النبذة المهنية',
	mainSpec: 'التخصص الرئيسي',
	subSpecs: 'التخصصات الفرعية',
	paypalEmail: 'بريد PayPal',
	ackFinal: 'الإقرار والموافقة النهائية',
};

export interface PortfolioItem { id?: string; review: string; reviewDisplayName: string; proofs: string[]; proofDisplayNames: string[] }
/** A file the provider already has stored (private, never returned by the API): kept through the stored row, never re-sent as a link. */
export const KEPT_REVIEW = 'kept:review';
export const keptProofMarker = (index: number) => `kept:proof:${index}`;
const KEPT_PROOF = /^kept:proof:(\d+)$/;
export const isKeptMarker = (value: string) => value === KEPT_REVIEW || KEPT_PROOF.test(value);
/** Inline error slots of the business-model step: the model file, the proof of ownership, and the sub-specialty as a whole. */
export const pfReviewKey = (spec: string, idx: number) => `pf-review-${spec}-${idx}`;
export const pfProofKey = (spec: string, idx: number) => `pf-proof-${spec}-${idx}`;
export const pfSpecKey = (spec: string) => `pf-spec-${spec}`;

/** Documents and portfolio files: PDF / JPG / PNG, 10 MB (the backend upload limit). */
const DOC_RULE = { maxBytes: 10 * MB, mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], typesLabel: 'PDF أو JPG أو PNG' };
/** Portfolio samples: what the upload inputs themselves accept (images, PDF, ZIP, and MP4 for the main sample). */
const PORTFOLIO_RULE = {
	maxBytes: 10 * MB,
	mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/zip', 'application/x-zip-compressed', 'video/mp4'],
	extensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.zip', '.mp4'],
	typesLabel: 'صورة أو PDF أو ZIP أو MP4',
};
const DOC_FILE_KEYS = ['frontId', 'backId', 'selfie', 'certs'];

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
	imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule, BioFieldDirective, PaypalEmailConfirmComponent, FieldErrorComponent, FormSummaryComponent, KycDocumentLink, SkillsPickerComponent, SpecialtyTestComponent],
	templateUrl: './profile-setup.html',
	styleUrls: ['./profile-setup.css']
})
export class ProfileSetupDashboard implements OnInit, OnDestroy {
	private fb = inject(FormBuilder);
	private destroyRef = inject(DestroyRef);
	private router = inject(Router);
	private access = inject(ProviderAccessService);
	private uiNotify = inject(UiNotificationService);
	private authStore = inject(AuthStore);
	private waitTimers = inject(WaitTimerService);
	private profileApi = inject(ProfileApiService);
	private prefsStore = inject(ProviderPrefsStore);
	private providerProfileService = inject(ProviderProfileService);
	private specialtyService = inject(SpecialtyService);
	public setupTestService = inject(SetupTestService);

	// Shared country -> cities data (src/app/shared/data); the city list always follows the chosen country.
	readonly countryNames = COUNTRY_NAMES;
	readonly citiesOf = citiesOf;
	readonly cityPlaceholder = cityPlaceholder;

	isSubmitting = signal<boolean>(false);
	/** The PayPal email already stored on the profile (a different one needs the e-mailed code, finance #33). */
	private storedPaypalEmail = '';
	/** The new PayPal email waiting for its code on the last step; null when nothing is pending. */
	pendingPaypalEmail = signal<string | null>(null);
	paypalAccountEmailHint = signal('');
	paypalConfirmMode = signal<'add' | 'change'>('add');
	/** The code e-mail could not be sent: said on the last step (the code can be requested again from the profile data page). */
	paypalSendError = signal('');
	currentStep = signal<number>(1);
	/** ID documents were sent and wait for review (kycStatus PENDING): shown as pending, never as a missing step. */
	kycPending = signal<boolean>(false);
	/** The identity review was approved (an approved KYC or an approved document): nothing to send. */
	kycVerified = signal<boolean>(false);
	/** the admin refused the identity documents: the reason is shown and the step is open for new files */
	kycRejectedReason = signal<string | null>(null);
	private readonly host = inject(ElementRef<HTMLElement>);
	/** What is missing after a failed Next/submit attempt (shown by <ws-form-summary>). */
	missing = signal<InvalidField[]>([]);
	/** Inline Arabic file problems (size/type/upload failure/required), keyed by upload slot. */
	fileErrors = signal<Record<string, string>>({});
	/** The backend rejected a skill (it must exist in the skills directory); shown next to the skills. */
	skillsServerError = signal('');

	particles: { style: string }[] = [];

	steps = [
		{ id: 1, label: 'البيانات المهنية' },
		{ id: 2, label: 'التخصصات والمهارات' },
		{ id: 3, label: 'بريد PayPal' },
		{ id: 4, label: 'المستندات الرسمية' },
		{ id: 5, label: 'نماذج الأعمال' },
		{ id: 6, label: 'المراجعة والإرسال' },
		{ id: 7, label: 'اختبار التصنيف الأولي' }
	];

	setupForm: FormGroup = this.fb.group({
		profData: this.fb.group({
			jobTitle: ['', requiredText],
			expYears: ['', Validators.required],
			country: ['', Validators.required],
			city: ['', Validators.required],
			// Date of birth (private, optional): stored on the profile and shown only to its owner; never on the public profile.
			dob: ['', birthDateValidator],
			languages: [[]],
			bio: ['', [requiredText, Validators.maxLength(500)]],
			portfolioUrl: [''],
			linkedinUrl: [''],
			websiteUrl: [''],
			timezone: ['Asia/Riyadh']
		}),
		specialties: this.fb.group({
			mainSpec: ['', Validators.required],
			// At least one sub-specialty is required to leave step 2 (portfolio samples are collected per sub-specialty).
			subSpecs: [[], Validators.required]
		}),
		payout: this.fb.group({
			paypalEmail: ['', paypalEmailValidators]
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


	categories = signal<any[]>([]);
	subSpecialtiesList = signal<any[]>([]);
	selectedSpecs = signal<string[]>([]);
	/** Shown under the sub-specialty chips after trying to leave step 2 without choosing one. */
	subSpecError = signal(false);

	uploadedFrontId = signal<string>('');
	uploadedFrontIdName = signal<string>('');
	uploadedBackIdName = signal<string>('');
	uploadedSelfieName = signal<string>('');
	uploadedCerts = signal<string[]>([]);
	/** Documents already stored as PRIVATE (their value is not visible here; re-saving without a new file keeps them). */
	storedFrontAccess = signal<KycAccess | null>(null);
	storedBackAccess = signal<KycAccess | null>(null);
	storedCertsAccess = signal<(KycAccess | null)[]>([]);
	uploadedCertsNames = signal<string[]>([]);
	isNafathVerified = signal<boolean>(false);
	isNafathVerifying = signal<boolean>(false);

	// Profile completion extras (P-AU-011)
	avatarPreview = signal<string>('');
	avatarUrl = signal<string>('');
	/** The photo already stored on the account (from the backend): shown after a refresh, and restored when a new upload fails. */
	private storedAvatarUrl = '';
	avatarError = signal('');
	readonly todayIso = new Date().toISOString().slice(0, 10);
	/** The skills offered for the chosen main specialty (the backend catalog): the only skills that can be picked. */
	skillOptions = signal<string[]>([]);
	skillsNotice = signal('');
	private pruneSkillsOnCatalog = false;
	skillsList = signal<string[]>([]);
	isSuggestingSkills = signal<boolean>(false);
	notifChannels = signal<string[]>(['email']);
	aiSuggestedSkills = signal<string[]>([]);
	skillsSuggestionError = signal('');
	skillsSuggestionReady = signal(false);

	// Upload progress states keyed by field identifier
	uploadStates = signal<Record<string, { status: 'uploading' | 'uploaded' | 'error'; progress: number; name: string }>>({});
	isUploading = computed(() => Object.values(this.uploadStates()).some(s => s.status === 'uploading'));

	// Portfolio — review/proofs store URLs; reviewDisplayName/proofDisplayNames store original filenames for UI
	portfolioItems = signal<Record<string, PortfolioItem[]>>({});

	// Test
	isTestStarted = signal<boolean>(false);
	testTotalTime = 0;
	readonly setupTestQuestionCount = SETUP_TEST_QUESTION_COUNT;
	readonly setupTestMinutes = SETUP_TEST_TIME_LIMIT_MINUTES;
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

		this.specialtyService.getCategories().subscribe(res => {
			if (res.success) {
				this.categories.set(res.data);
			}
		});

		this.setupForm.get('specialties.mainSpec')?.valueChanges.subscribe(val => {
			this.loadSkillOptions(val || '');
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
			this.subSpecError.set(false);
			this.setupForm.get('specialties.subSpecs')?.setValue([]);
		});

		// Load saved data
		this.profileApi.getProviderProfileSetup().subscribe({
			next: (res: any) => {
				if (res && res.data) {
					const d = res.data;
					this.storedPaypalEmail = String(d.paypalPayoutEmail || '').trim();
					this.storedSetupTestScore.set(typeof d.setupTestScore === 'number' ? d.setupTestScore : null);
					this.storedSetupTestStatus.set(typeof d.setupTestStatus === 'string' ? d.setupTestStatus : null);
					this.skillsList.set((d.skills || []).map((s: { name: string }) => s.name));
					this.storedAvatarUrl = typeof d.avatarUrl === 'string' ? d.avatarUrl : '';
					if (this.storedAvatarUrl) { this.avatarUrl.set(this.storedAvatarUrl); this.avatarPreview.set(this.storedAvatarUrl); }
					const prefs = d.preferences && typeof d.preferences === 'object' ? d.preferences : {};
					if (prefs.preferredCommunicationLanguage === 'ar' || prefs.preferredCommunicationLanguage === 'en') this.setupForm.get('uiLanguage')?.setValue(prefs.preferredCommunicationLanguage);
					if (typeof prefs.timezone === 'string' && prefs.timezone) this.setupForm.get('profData.timezone')?.setValue(prefs.timezone);
					if (Array.isArray(prefs.notifChannels)) this.notifChannels.set(prefs.notifChannels.filter((c: unknown) => c === 'push' || c === 'email'));
					this.setupForm.patchValue({
						profData: {
							jobTitle: d.headline || d.industry || '',
							country: normalizeCountry(d.country),
							city: d.city || '',
							dob: dobInputValue(d.dob),
							bio: d.bio || '',
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
						payout: {
							paypalEmail: d.paypalPayoutEmail || ''
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
					if (d.frontIdUrlAccess?.private) this.storedFrontAccess.set(d.frontIdUrlAccess);
					if (d.backIdUrlAccess?.private) this.storedBackAccess.set(d.backIdUrlAccess);
					if (d.certUrlsAccess?.some((a: KycAccess | null) => a?.private)) this.storedCertsAccess.set(d.certUrlsAccess);
					const legacyCerts = (d.certUrls || []).filter(Boolean);
					if (legacyCerts.length) this.uploadedCerts.set(legacyCerts);
					if (d.subSpecialties && d.subSpecialties.length) this.selectedSpecs.set(d.subSpecialties);
					if (d.kycStatus === 'VERIFIED' || d.isNafathVerified) this.isNafathVerified.set(true);
					// Stage 5: the saved portfolio comes back from the server, so a re-save never starts from an empty list.
					const saved = this.portfolioFromServer(d.portfolioItems);
					if (Object.keys(saved).length) this.portfolioItems.set(saved);
					// ONE state for the identity review (NOT_SUBMITTED / PENDING_REVIEW / VERIFIED / REJECTED), the same the profile page and the dashboard show;
					// the older kycStatus is only the fallback when the backend did not send it.
					const iv = d.identityVerification as { status?: string; rejectionReason?: string | null } | null | undefined;
					this.kycPending.set(iv ? iv.status === 'PENDING_REVIEW' : d.kycStatus === 'PENDING');
					this.kycVerified.set(iv ? iv.status === 'VERIFIED' : d.kycStatus === 'VERIFIED');
					this.kycRejectedReason.set(iv
						? (iv.status === 'REJECTED' ? (iv.rejectionReason || d.kycRejectionReason || 'لم تستوفِ الوثائق متطلبات التحقق') : null)
						: (d.kycStatus === 'REJECTED' ? (d.kycRejectionReason || 'لم تستوفِ الوثائق متطلبات التحقق') : null));

					// Open where the work really is (first missing step from the saved data; step 7 when only the test is left), not always on step 1.
					const start = resolveProviderSetup(d);
					if (start.kind === 'redirect') {
						this.uiNotify.info(PROVIDER_SETUP_REDIRECT_MESSAGE);
						this.router.navigateByUrl(PROVIDER_EDIT_PAGE);
						return;
					}
					this.currentStep.set(start.step);
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

	/** The chosen sub-specialties: the form value is the source of truth (toggleSpec keeps both in sync). */
	private chosenSubSpecs(): string[] {
		const v = this.setupForm.get('specialties.subSpecs')?.value;
		return Array.isArray(v) && v.length ? v : this.selectedSpecs();
	}

	private setFileError(key: string, message: string) {
		this.fileErrors.update(e => ({ ...e, [key]: message }));
	}

	private clearFileErrorsWithPrefix(prefix: string) {
		this.fileErrors.update(e => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith(prefix))));
	}

	/** The inline error of one upload slot ('' when none). */
	fileErr(key: string): string {
		return this.fileErrors()[key] ?? '';
	}

	private clearFileError(...keys: string[]) {
		this.fileErrors.update(e => {
			const next = { ...e };
			for (const k of keys) delete next[k];
			return next;
		});
	}

	/** An upload failed on the server: say why (size limit, rate limit, network...) next to the file. */
	private uploadFailed(key: string, file: File, err: unknown) {
		this.setFileError(key, `تعذّر رفع «${file.name}»: ${mapHttpError(err).message}`);
	}

	private checkGroup(name: string): boolean {
		const group = this.setupForm.get(name);
		if (!group) return true;
		const attempt = attemptSubmit(group, { root: (this.host.nativeElement as HTMLElement).querySelector('.step-panel.active') ?? this.host.nativeElement, labels: SETUP_LABELS });
		this.missing.set(attempt.missing);
		return attempt.valid;
	}

	/** One wizard step: marks touched, builds the summary, focuses the first missing field. */
	private validateStep(step: number): boolean {
		switch (step) {
			case 1:
				return this.checkGroup('profData');
			case 2: {
				const ok = this.checkGroup('specialties');
				// A missing sub-specialty gets its own message + highlight on the chips area.
				if (this.selectedSpecs().length === 0 && this.setupForm.get('specialties.mainSpec')?.value) this.subSpecError.set(true);
				return ok;
			}
			case 3:
				return this.checkGroup('payout');
			case 4: {
				const items: InvalidField[] = [];
				const labels: Record<string, string> = { frontId: 'صورة الهوية (الوجه الأمامي)', backId: 'صورة الهوية (الوجه الخلفي)', selfie: 'الصورة الشخصية مع الهوية', certs: 'الشهادات المهنية' };
				for (const key of ['frontId', 'backId', 'selfie', 'certs']) {
					const state = this.getUploadState(key)?.status;
					if (state === 'uploading') {
						const message = 'انتظر اكتمال رفع الملف';
						this.setFileError(key, message); items.push({ path: `docs.${key}`, label: labels[key], message });
					} else if (state === 'error' && key === 'frontId') {
						const message = 'فشل رفع صورة الهوية (الوجه الأمامي): أعد رفع الملف';
						this.setFileError(key, message); items.push({ path: `docs.${key}`, label: labels[key], message });
					}
				}
				if (items.length === 0 && !this.uploadedFrontId() && !this.storedFrontAccess()?.private && !this.kycPending() && !this.kycVerified()) {
					const message = 'صورة الهوية (الوجه الأمامي) مطلوبة، ارفع ملف PDF أو JPG أو PNG';
					items.push({ path: 'docs.frontId', label: labels['frontId'], message });
					this.setFileError('frontId', message);
				}
				this.missing.set(items);
				return items.length === 0;
			}
			case 5: {
				const items: InvalidField[] = [];
				this.clearFileErrorsWithPrefix('pf-');
				const specs = this.chosenSubSpecs();
				if (specs.length === 0) {
					items.push({ path: 'specialties.subSpecs', label: 'التخصصات الفرعية', message: 'اختر تخصصًا فرعيًا واحدًا على الأقل في الخطوة 2' });
				} else {
					// Every chosen sub-specialty needs a model FILE and, for that model, at least one COMPLETED proof of ownership that is a different file. Nothing is
					// created from the model file, and an upload that is running or failed is never a proof.
					for (const spec of specs) {
						const list = this.portfolioItems()[spec] || [this.emptyPortfolioItem()];
						let complete = false; let problemShown = false;
						list.forEach((item, idx) => {
							const started = !!item.review || item.proofs.length > 0 || item.proofDisplayNames.length > 0;
							if (idx > 0 && !started) return; // an empty extra card is ignored
							const reviewState = this.getUploadState(`portfolio-review-${spec}-${idx}`)?.status;
							let reviewMsg = '';
							if (reviewState === 'uploading') reviewMsg = 'انتظر اكتمال رفع ملف النموذج';
							else if (reviewState === 'error') reviewMsg = 'فشل رفع ملف النموذج، أعد رفعه';
							else if (!item.review) reviewMsg = 'ارفع ملف نموذج العمل';
							let proofMsg = '';
							const states = item.proofs.map((_, i) => this.getUploadState(`portfolio-proof-${spec}-${idx}-${i}`)?.status);
							const doneProofs = item.proofs.filter(v => !!v && v !== item.review);
							if (states.includes('uploading')) proofMsg = 'انتظر اكتمال رفع وثيقة الإثبات';
							else if (states.includes('error') || item.proofs.some(v => !v)) {
								const failedAt = states.findIndex(st => st === 'error');
								const name = item.proofDisplayNames[failedAt >= 0 ? failedAt : item.proofs.findIndex(v => !v)] || '';
								proofMsg = `فشل رفع وثيقة الإثبات${name ? ` «${name}»` : ''}: احذفها وأعد إرفاقها`;
							} else if (doneProofs.length === 0) {
								proofMsg = item.proofs.some(v => !!v && v === item.review) ? 'وثيقة الإثبات يجب أن تكون ملفًا مختلفًا عن ملف النموذج' : 'أرفق وثيقة إثبات ملكية واحدة على الأقل لهذا النموذج';
							}
							if (reviewMsg) { this.setFileError(pfReviewKey(spec, idx), reviewMsg); items.push({ path: `portfolio.${spec}.${idx}.review`, label: `ملف النموذج: ${spec}`, message: reviewMsg }); problemShown = true; }
							if (proofMsg) { this.setFileError(pfProofKey(spec, idx), proofMsg); items.push({ path: `portfolio.${spec}.${idx}.proof`, label: `وثيقة الإثبات: ${spec}`, message: proofMsg }); problemShown = true; }
							if (!reviewMsg && !proofMsg) complete = true;
						});
						if (!complete && !problemShown) {
							const message = 'ارفع نموذج عمل واحدًا على الأقل مع وثيقة إثبات الملكية لهذا التخصص';
							this.setFileError(pfSpecKey(spec), message);
							items.push({ path: `portfolio.${spec}`, label: `نموذج عمل: ${spec}`, message });
						}
					}
				}
				this.missing.set(items);
				return items.length === 0;
			}
			case 6:
				return this.checkGroup('agreements');
			default:
				return true;
		}
	}

	/** After a step change the new step's inputs are not rendered yet: focus the first missing field once they are. */
	private focusSoon() {
		setTimeout(() => {
			// All wizard panels stay in the DOM and only the active one is shown: look for the field inside it, never in
			// a hidden step (focusing a hidden control does nothing).
			const host = this.host.nativeElement as HTMLElement;
			const panel = host.querySelector<HTMLElement>('.step-panel.active') ?? host;
			// Upload slots are not form controls: when nothing invalid is focusable, focus the first upload input.
			if (!focusFirstInvalid(panel)) panel.querySelector<HTMLElement>('.upload-file-inp, .upload-area')?.focus();
		});
	}

	goToStep(step: number) {
		if (step < 1 || step > 7) return;

		// Moving forward validates EVERY step on the way (the step bar must not skip an incomplete one) and stops at
		// the first incomplete step with its summary.
		if (step > this.currentStep()) {
			for (let s = this.currentStep(); s < step; s++) {
				if (!this.validateStep(s)) {
					if (s !== this.currentStep()) this.currentStep.set(s);
					this.focusSoon();
					return;
				}
			}
		}
		this.missing.set([]);

		// Auto-init portfolio when reaching step 5
		if (step === 5) {
			const current = { ...this.portfolioItems() };
			let changed = false;
			this.selectedSpecs().forEach(s => {
				if (!current[s] || current[s].length === 0) {
					current[s] = [this.emptyPortfolioItem()];
					changed = true;
				}
			});
			if (changed) this.portfolioItems.set(current);
		}

		this.currentStep.set(step);
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	toggleSpec(spec: string) {
		const current = [...this.selectedSpecs()];
		const idx = current.indexOf(spec);
		if (idx > -1) current.splice(idx, 1);
		else current.push(spec);
		this.selectedSpecs.set(current);
		if (current.length) this.subSpecError.set(false);
		this.setupForm.get('specialties.subSpecs')?.setValue(current);
	}

	onFileSelected(event: any, type: string) {
		const files = event.target.files;
		if (!files || files.length === 0) return;

		if (type === 'frontId' || type === 'backId' || type === 'selfie') {
			const file = files[0] as File;
			const problem = validateFile(file, DOC_RULE);
			if (problem) {
				// Inline, next to the upload slot; nothing is uploaded and a previously uploaded file stays.
				this.setFileError(type, problem);
				event.target.value = '';
				return;
			}
			this.clearFileError(type);
			this.uploadSingleDoc(file, type);
		} else if (type === 'certs') {
			const validFiles: File[] = [];
			for (const f of Array.from(files) as File[]) {
				const problem = validateFile(f, DOC_RULE);
				if (problem) {
					this.setFileError('certs', `«${f.name}»: ${problem}`);
					event.target.value = '';
					return;
				}
				validFiles.push(f);
			}
			this.clearFileError('certs');
			this.uploadCerts(validFiles);
		}
	}

	// === Profile completion extras (P-AU-011) ===
	onAvatarSelected(event: any) {
		const file = event.target.files?.[0];
		if (!file) return;
		event.target.value = ''; // so the same photo can be picked again
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
		// The local preview is only a preview: the photo counts as stored once the upload answered with its URL AND the setup is saved with it.
		const reader = new FileReader();
		reader.onload = () => this.avatarPreview.set(reader.result as string);
		reader.readAsDataURL(file);

		this.avatarError.set('');
		this.setUploadState('avatar', { status: 'uploading', progress: 0, name: file.name });
		this.providerProfileService.uploadDocument(file, { visibility: 'public' }).subscribe({
			next: (event: any) => {
				if (event.type === HttpEventType.UploadProgress) {
					const progress = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
					this.setUploadState('avatar', { status: 'uploading', progress, name: file.name });
				}
				if (event.type === HttpEventType.Response) {
					const url = event.body?.data?.url || '';
					if (!url) { this.failAvatarUpload(file.name); return; }
					this.avatarUrl.set(url);
					this.setUploadState('avatar', { status: 'uploaded', progress: 100, name: file.name });
				}
			},
			error: () => this.failAvatarUpload(file.name)
		});
	}

	/** A failed upload is never shown as a photo that is there: the preview goes back to what is really stored and the user is told. */
	private failAvatarUpload(name: string) {
		this.avatarUrl.set(this.storedAvatarUrl);
		this.avatarPreview.set(this.storedAvatarUrl);
		this.avatarError.set('تعذّر رفع الصورة. لم تُحفظ، جرّب مرة أخرى.');
		this.setUploadState('avatar', { status: 'error', progress: 0, name });
	}

	// ── skills: a searchable list of the chosen field's catalog (no free text) ──
	onSkillsChange(list: string[]) {
		this.skillsServerError.set('');
		this.skillsNotice.set('');
		this.skillsList.set(list.slice(0, 30));
	}

	/** The user picked another main specialty: skills of the old field that do not belong to the new one are removed (and the user is told). */
	onMainSpecUserChange() {
		this.pruneSkillsOnCatalog = true;
	}

	private loadSkillOptions(mainSpec: string) {
		if (!mainSpec) { this.skillOptions.set([]); return; }
		this.providerProfileService.getSkillsCatalog(mainSpec).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: res => {
				const options = res?.success ? (res.data?.skills ?? []) : [];
				this.skillOptions.set(options);
				if (this.pruneSkillsOnCatalog) {
					this.pruneSkillsOnCatalog = false;
					const keep = this.skillsList().filter(sk => options.includes(sk));
					const removed = this.skillsList().length - keep.length;
					if (removed > 0) {
						this.skillsList.set(keep);
						this.skillsNotice.set(`أُزيلت ${removed} مهارة لا تتبع التخصص الجديد.`);
					}
				}
			},
			error: () => this.skillOptions.set([])
		});
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
			error: (err) => {
				if (err?.status === 503) { this.skillsSuggestionError.set('اقتراح المهارات بالذكاء الاصطناعي غير متاح حاليًا.'); return; }
				const mapped = mapHttpError(err);
				// Rate limit / no connection say so; any other failure keeps the generic retry wording.
				const detail = mapped.kind === 'rate-limit' || mapped.kind === 'network' ? mapped.message : 'يرجى المحاولة مجدداً.';
				this.skillsSuggestionError.set(`تعذر إنشاء اقتراح بالذكاء الاصطناعي. ${detail}`);
			}
		});
	}

	addAiSkill(skill: string) {
		if (!this.aiSuggestedSkills().includes(skill) || this.skillsList().length >= 30) return;
		// Only a skill of the chosen field's catalog can be added (the server refuses anything else); with no catalog loaded yet the old behaviour stays.
		if (this.skillOptions().length && !this.skillOptions().includes(skill)) return;
		const key = skill.trim().normalize('NFKC').toLowerCase();
		if (!this.skillsList().some(s => s.trim().normalize('NFKC').toLowerCase() === key)) {
			this.skillsList.update(list => [...list, skill]);
		}
		this.aiSuggestedSkills.update(list => list.filter(s => s !== skill));
	}

	setUiLanguage(lang: string) {
		this.setupForm.get('uiLanguage')?.setValue(lang);
		this.savePreferences();
	}

	/** '' | 'saving' | 'saved' | 'error' — status of the last preferences save (PUT /provider/profile/preferences). */
	prefsStatus = signal<'' | 'saving' | 'saved' | 'error'>('');

	/** Saves language / timezone / notification channels right when they change (they are stored in provider_profiles.preferences). */
	savePreferences() {
		this.prefsStatus.set('saving');
		const lang = this.setupForm.get('uiLanguage')?.value === 'en' ? 'en' : 'ar';
		this.profileApi.saveProviderPreferences({
			preferredCommunicationLanguage: lang,
			timezone: this.setupForm.get('profData.timezone')?.value || 'Asia/Riyadh',
			notifChannels: this.notifChannels()
		}).subscribe({
			next: () => { this.prefsStatus.set('saved'); this.prefsStore.setTimezone(this.setupForm.get('profData.timezone')?.value || 'Asia/Riyadh'); },
			error: () => this.prefsStatus.set('error')
		});
	}

	// Profile completion percentage (P-AU-011 progress ring)
	profileCompletionPct(): number {
		let p = 20;
		if (this.avatarUrl()) p += 30; // the uploaded/stored photo, never a preview that was not stored
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
		this.savePreferences();
	}

	private uploadSingleDoc(file: File, type: string) {
		this.clearFileError(type);
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
			error: (err) => {
				this.setUploadState(key, { status: 'error', progress: 0, name: file.name });
				this.uploadFailed(type, file, err);
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
				error: (err) => {
					hasError = true;
					this.uploadFailed('certs', file, err);
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
			message: 'التحقق عبر نفاذ غير متاح حاليًا.',
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

	// All portfolio edits create NEW arrays/objects: the template's @for must see a new reference, otherwise the first click appeared to
	// do nothing and only a second click showed the added card.
	private emptyPortfolioItem() { return { review: '', reviewDisplayName: '', proofs: [] as string[], proofDisplayNames: [] as string[] }; }

	private updatePortfolioItem(spec: string, idx: number, change: (item: PortfolioItem) => PortfolioItem) {
		const current = { ...this.portfolioItems() };
		current[spec] = (current[spec] || []).map((item, i) => (i === idx ? change(item) : item));
		this.portfolioItems.set(current);
	}

	/**
	 * Rebuilds the wizard's per-specialty list from the rows GET /provider/profile/setup returns (title "نموذج أعمال - <spec>", description = model file, tags = proof files).
	 * The API never returns a private file, only that it exists (`descriptionAccess` / `tagsAccess`): such a file becomes a KEPT marker, so a resumed wizard shows it as
	 * already uploaded and the save keeps it through the stored row (id + keep flags) instead of asking for it again.
	 */
	portfolioFromServer(rows: unknown): Record<string, PortfolioItem[]> {
		const out: Record<string, PortfolioItem[]> = {};
		if (!Array.isArray(rows)) return out;
		const nameOf = (url: string) => decodeURIComponent((url.split('?')[0].split('/').pop() || url));
		for (const row of rows as Array<{ id?: string; title?: string; description?: string | null; tags?: Array<string | null> | null; coverImage?: string | null; descriptionAccess?: { private?: boolean } | null; tagsAccess?: Array<{ private?: boolean } | null> | null }>) {
			const spec = String(row?.title || '').replace(/^نموذج أعمال\s*-\s*/, '').trim();
			if (!spec) continue;
			const hasReview = !!row.description || !!row.descriptionAccess?.private;
			const tagCount = Math.max(row.tags?.length ?? 0, row.tagsAccess?.length ?? 0);
			const proofs: string[] = [];
			for (let i = 0; i < tagCount; i++) if (row.tags?.[i] || row.tagsAccess?.[i]) proofs.push(keptProofMarker(i));
			if (!tagCount && row.coverImage) proofs.push(keptProofMarker(0));
			const proofNames = proofs.map((_, n) => { const tag = row.tags?.[Number(KEPT_PROOF.exec(proofs[n])![1])] ?? (tagCount ? null : row.coverImage); return tag ? nameOf(tag) : 'وثيقة إثبات مرفوعة سابقًا'; });
			out[spec] ||= [];
			out[spec].push({ id: row.id, review: hasReview ? KEPT_REVIEW : '', reviewDisplayName: !hasReview ? '' : row.description ? nameOf(row.description) : 'ملف النموذج المرفوع سابقًا', proofs, proofDisplayNames: proofNames });
		}
		return out;
	}

	addPortfolioItem(spec: string) {
		const current = { ...this.portfolioItems() };
		current[spec] = [...(current[spec] || []), this.emptyPortfolioItem()];
		this.portfolioItems.set(current);
	}

	removePortfolioItem(spec: string, idx: number) {
		const current = { ...this.portfolioItems() };
		if (current[spec]) {
			const rest = current[spec].filter((_, i) => i !== idx);
			current[spec] = rest.length ? rest : [this.emptyPortfolioItem()];
			this.portfolioItems.set(current);
		}
	}

	onPortfolioReviewChange(event: any, spec: string, idx: number) {
		if (event.target.files && event.target.files[0]) {
			const file = event.target.files[0] as File;
			const errKey = pfReviewKey(spec, idx);
			const problem = validateFile(file, PORTFOLIO_RULE);
			if (problem) {
				this.setFileError(errKey, problem);
				event.target.value = '';
				return;
			}
			this.clearFileError(errKey);
			const key = `portfolio-review-${spec}-${idx}`;
			this.setUploadState(key, { status: 'uploading', progress: 0, name: file.name });

			this.updatePortfolioItem(spec, idx, item => ({ ...item, reviewDisplayName: file.name }));
			this.clearFileError(pfSpecKey(spec));

			(event.target as HTMLInputElement).value = ''; // the same file can be attached again after removing it
			this.providerProfileService.uploadDocument(file).subscribe({
				next: (event: any) => {
					if (event.type === HttpEventType.UploadProgress) {
						const progress = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
						this.setUploadState(key, { status: 'uploading', progress, name: file.name });
					}
					if (event.type === HttpEventType.Response) {
						const url = event.body?.data?.url || '';
						const name = event.body?.data?.name || file.name;
						this.updatePortfolioItem(spec, idx, item => ({ ...item, review: url, reviewDisplayName: name }));
						this.clearFileError(errKey);
						this.setUploadState(key, { status: 'uploaded', progress: 100, name });
					}
				},
				error: (err) => {
					this.setUploadState(key, { status: 'error', progress: 0, name: file.name });
					this.uploadFailed(errKey, file, err);
				}
			});
		}
	}

	onPortfolioProofsChange(event: any, spec: string, idx: number) {
		if (event.target.files && event.target.files.length > 0) {
			const files = Array.from(event.target.files) as File[];
			const errKey = pfProofKey(spec, idx);

			for (const f of files) {
				const problem = validateFile(f, PORTFOLIO_RULE);
				if (problem) {
					this.setFileError(errKey, `«${f.name}»: ${problem}`);
					event.target.value = '';
					return;
				}
			}

			this.clearFileError(errKey, pfSpecKey(spec));
			(event.target as HTMLInputElement).value = ''; // the same file can be attached again after removing it
			files.forEach((file, proofIdx) => {
				const baseProofIdx = this.portfolioItems()[spec][idx].proofs.length;
			const key = `portfolio-proof-${spec}-${idx}-${baseProofIdx}`;
			this.setUploadState(key, { status: 'uploading', progress: 0, name: file.name });

				// placeholder entry until the upload completes
				this.updatePortfolioItem(spec, idx, item => ({ ...item, proofDisplayNames: [...item.proofDisplayNames, file.name], proofs: [...item.proofs, ''] }));

				this.providerProfileService.uploadDocument(file).subscribe({
					next: (ev: any) => {
						if (ev.type === HttpEventType.UploadProgress) {
							const progress = ev.total ? Math.round((ev.loaded / ev.total) * 100) : 0;
							this.setUploadState(key, { status: 'uploading', progress, name: file.name });
						}
						if (ev.type === HttpEventType.Response) {
							const url = ev.body?.data?.url || '';
							const name = ev.body?.data?.name || file.name;
							this.updatePortfolioItem(spec, idx, item => ({
								...item,
								proofs: item.proofs.map((p, i) => (i === baseProofIdx ? url : p)),
								proofDisplayNames: item.proofDisplayNames.map((n, i) => (i === baseProofIdx ? name : n))
							}));
							this.setUploadState(key, { status: 'uploaded', progress: 100, name });
							this.clearFileError(errKey);
						}
					},
					error: (err) => {
						this.setUploadState(key, { status: 'error', progress: 0, name: file.name });
						this.uploadFailed(errKey, file, err);
					}
				});
			});
		}
	}

	removePortfolioProof(spec: string, itemIdx: number, proofIdx: number) {
		const item = this.portfolioItems()[spec]?.[itemIdx];
		if (!item) return;
		// the upload states of the later proofs move down with them (their keys carry the position), and the removed one's state goes away
		const prefix = `portfolio-proof-${spec}-${itemIdx}-`;
		this.uploadStates.update(states => {
			const next = { ...states };
			for (let i = proofIdx; i < item.proofs.length; i++) {
				const following = states[`${prefix}${i + 1}`];
				if (following) next[`${prefix}${i}`] = following; else delete next[`${prefix}${i}`];
			}
			return next;
		});
		this.updatePortfolioItem(spec, itemIdx, it => ({
			...it,
			proofs: it.proofs.filter((_, i) => i !== proofIdx),
			proofDisplayNames: it.proofDisplayNames.filter((_, i) => i !== proofIdx)
		}));
		this.clearFileError(pfProofKey(spec, itemIdx));
	}

	/**
	 * The payload of step 5. A KEPT marker is never sent as a value: the stored row is named by `id` and the stored files are kept by flag / index, which the server
	 * resolves from ITS row. An upload that failed leaves an empty placeholder: never sent.
	 */
	private sanitizePortfolioForPayload(items: Record<string, PortfolioItem[]>): Record<string, Array<{ id?: string; review?: string; keepReview?: boolean; proofs: string[]; keepProofs: number[] }>> {
		const out: Record<string, Array<{ id?: string; review?: string; keepReview?: boolean; proofs: string[]; keepProofs: number[] }>> = {};
		for (const key of Object.keys(items)) {
			out[key] = items[key].map(item => {
				const keepProofs = item.proofs.map(p => KEPT_PROOF.exec(p)).filter((m): m is RegExpExecArray => !!m).map(m => Number(m[1]));
				return {
					...(item.id ? { id: item.id } : {}),
					...(item.review === KEPT_REVIEW ? { keepReview: true } : { review: item.review }),
					proofs: item.proofs.filter(p => !!p && !isKeptMarker(p)),
					keepProofs
				};
			});
		}
		return out;
	}

	saveAndGoToTest() {
		if (this.isSubmitting()) return; // one submission at a time (double click / Enter)
		// Everything is validated here, in step order: stop at the first incomplete step and say what is missing.
		for (let step = 1; step <= 6; step++) {
			if (!this.validateStep(step)) {
				this.currentStep.set(step);
				this.focusSoon();
				return;
			}
		}
		this.missing.set([]);

		this.isSubmitting.set(true);
		const payload = {
			skills: this.skillsList(),
			// Only a photo that was uploaded in this session is sent; the stored one (own storage URL or the Google sign-in picture) is kept by the server and never re-posted as a "new link".
			...(this.avatarUrl() && this.avatarUrl() !== this.storedAvatarUrl ? { avatarUrl: this.avatarUrl() } : {}),
			details: {
				occupation: this.setupForm.get('profData.jobTitle')?.value,
				country: this.setupForm.get('profData.country')?.value,
				city: this.setupForm.get('profData.city')?.value,
				...(this.setupForm.get('profData.dob')?.value ? { dob: this.setupForm.get('profData.dob')?.value } : {}),
				bio: this.setupForm.get('profData.bio')?.value,
				expYears: this.setupForm.get('profData.expYears')?.value
			},
			specialties: {
				mainSpec: this.setupForm.get('specialties.mainSpec')?.value,
				subSpecs: this.setupForm.get('specialties.subSpecs')?.value
			},
			identity: {
				frontId: this.uploadedFrontId(),
				backId: this.setupForm.get('docs.backId')?.value,
				certs: this.uploadedCerts()
			},
			portfolio: this.sanitizePortfolioForPayload(this.portfolioItems()),

			// No `bank` key on purpose: the setup endpoint then leaves any saved bank values untouched
			// (undefined is skipped by the upsert) instead of overwriting them with empty values.
			agreements: {
				accurate: this.setupForm.get('agreements.ackFinal')?.value,
				terms: this.setupForm.get('agreements.ackFinal')?.value,
				privacy: this.setupForm.get('agreements.ackFinal')?.value
			}
		};

		// The setup endpoint does not persist the PayPal email, and the email is never saved directly any more (finance #33): when it
		// differs from the stored one, a code is e-mailed to the account email after the setup is saved and confirmed on the last step.
		const paypalEmail = String(this.setupForm.get('payout.paypalEmail')?.value || '').trim();
		this.profileApi.saveProviderProfileSetup(payload).subscribe({
			next: () => {
				// the documents were sent again after a rejection: a new review starts (reason gone, "under review")
				if (this.kycRejectedReason()) { this.kycRejectedReason.set(null); this.kycPending.set(true); }
				if (paypalEmail && paypalEmail.toLowerCase() !== this.storedPaypalEmail.toLowerCase()) {
					this.providerProfileService.requestPaypalEmailChange(paypalEmail).subscribe({
						next: (r) => {
							if (r.emailSent === true) {
								this.paypalAccountEmailHint.set(r.emailHint || '');
								this.paypalConfirmMode.set(r.mode ?? (this.storedPaypalEmail ? 'change' : 'add'));
								this.pendingPaypalEmail.set(paypalEmail);
							} else this.paypalSendError.set('تعذر إرسال رمز التحقق، حاول مرة أخرى من صفحة بيانات الملف المهني.');
						},
						error: (err) => {
							// A 429 leaves its end timestamp for the profile page's send button (same scope); nothing is retried here.
							if (isRateLimitError(err)) this.waitTimers.setEnd(waitScope('paypal-otp-resend', this.authStore.currentUser()?.id ?? ''), rateLimitEndsAt(err));
							this.paypalSendError.set(isRateLimitError(err) ? rateLimitToastMessage(err) : 'تعذر إرسال رمز التحقق، حاول مرة أخرى من صفحة بيانات الملف المهني.');
						}
					});
				}
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
				const mapped = mapHttpError(error, { fallback: 'تعذر حفظ البيانات. يرجى المحاولة مجدداً.' });
				// Server field messages (zod-style `errors[]`, names as the backend calls them) go to the matching inputs;
				// the wizard returns to the step that holds the first one and focuses it.
				// The backend names a model with a missing / invalid proof (portfolio.<sub-specialty>) or the missing identity front: show it under that attachment.
				if (this.applyServerDocumentErrors(error?.error?.errors)) return;
				if (this.applyServerFieldErrors(mapped.fieldErrors)) return;
				// The backend rejects a skill that is not in the skills directory (400, Arabic): show it where the skills are.
				if (mapped.kind === 'backend-validation' && /المهارات/.test(mapped.message)) {
					this.skillsServerError.set(mapped.message);
					this.currentStep.set(1); // the skills section is on step 1
					this.missing.set([{ path: 'skills', label: 'المهارات', message: mapped.message }]);
					// Focus the skills input (it is on the active step, visible on the next change detection).
					setTimeout(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.skills-input')?.focus(), 100);
				}
				this.alertModal.set({ type: 'error', title: 'تعذر الحفظ', message: mapped.message });
			}
		});
	}

	/** Backend field name -> the form control that holds it and the wizard step it is on. */
	private static readonly SERVER_FIELDS: Record<string, { control: string; step: number }> = {
		occupation: { control: 'profData.jobTitle', step: 1 }, jobTitle: { control: 'profData.jobTitle', step: 1 },
		expYears: { control: 'profData.expYears', step: 1 }, country: { control: 'profData.country', step: 1 },
		city: { control: 'profData.city', step: 1 }, bio: { control: 'profData.bio', step: 1 },
		mainSpec: { control: 'specialties.mainSpec', step: 2 }, subSpecs: { control: 'specialties.subSpecs', step: 2 },
		paypalPayoutEmail: { control: 'payout.paypalEmail', step: 3 }, paypalEmail: { control: 'payout.paypalEmail', step: 3 },
	};

	/** Backend document errors -> the inline slot of the attachment, on the step that holds it. Returns true when at least one was placed. */
	private applyServerDocumentErrors(errors: unknown): boolean {
		if (!Array.isArray(errors)) return false;
		let step = 0;
		for (const e of errors as Array<{ field?: unknown; path?: unknown; message?: unknown }>) {
			const name = typeof (e?.field ?? e?.path) === 'string' ? String(e.field ?? e.path) : '';
			const message = typeof e?.message === 'string' ? e.message : '';
			if (!name || !message) continue;
			if (name === 'identity.frontId') { this.setFileError('frontId', message); step = step || 4; }
			else if (name.startsWith('portfolio.') && name.length > 'portfolio.'.length) {
				const spec = name.slice('portfolio.'.length);
				const list = this.portfolioItems()[spec] || [];
				const idx = Math.max(0, list.findIndex(i => !!i.review && !i.proofs.some(Boolean)));
				this.setFileError(/وثيقة|إثبات|الإثبات/.test(message) ? pfProofKey(spec, idx) : pfSpecKey(spec), message);
				step = step && step < 5 ? step : 5;
			}
		}
		if (!step) return false;
		this.currentStep.set(step);
		this.focusSoon();
		return true;
	}

	/** Puts server field errors on the right controls; returns true when at least one matched (and the step was changed). */
	private applyServerFieldErrors(fieldErrors: Record<string, string>): boolean {
		const targets = Object.entries(fieldErrors)
			.map(([name, message]) => ({ message, target: ProfileSetupDashboard.SERVER_FIELDS[name] }))
			.filter(t => t.target && this.setupForm.get(t.target.control));
		if (!targets.length) return false;
		const firstStep = targets[0].target.step;
		this.currentStep.set(firstStep);
		// The step's inputs are created on the next render, and binding a control to its input revalidates it (dropping
		// manual errors). So the server errors are set once the step is on screen.
		setTimeout(() => {
			for (const { message, target } of targets) {
				const control = this.setupForm.get(target.control)!;
				control.setErrors({ ...(control.errors ?? {}), server: message });
				control.markAsTouched();
			}
			this.missing.set(collectInvalidFields(this.setupForm.get(['profData', 'specialties', 'payout'][Math.min(firstStep, 3) - 1])!, SETUP_LABELS));
			setTimeout(() => this.focusSoon(), 60);
		}, 30);
		return true;
	}

	/** Validation message of the PayPal email (shown once the field was touched/edited, or on a failed next). */
	paypalEmailMsg(): string | null {
		const c = this.setupForm.get('payout.paypalEmail');
		if (!c || !(c.touched || c.dirty)) return null;
		const server = c.errors?.['server'];
		return typeof server === 'string' ? server : paypalEmailError(c.errors);
	}

	startTest() {
		this.isTestStarted.set(true);
		this.setupTestService.startTest();

		this.testTotalTime = SETUP_TEST_TIME_LIMIT_MINUTES * 60;
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
					confirmText: 'متابعة حالة الاعتماد',
					onConfirm: () => {
						this.closeAlertModal();
						this.access.invalidate();
						this.router.navigateByUrl(PROVIDER_ACCESS_STATUS_URL);
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

	/** Stored result of the setup test, when GET profile-setup returns it (— otherwise). */
	storedSetupTestScore = signal<number | null>(null);
	storedSetupTestStatus = signal<string | null>(null);
	storedSetupTestStatusLabel(): string {
		const st = this.storedSetupTestStatus();
		if (!st) return '—';
		const labels: Record<string, string> = { COMPLETED: 'مكتمل', PASSED: 'مكتمل', FAILED: 'لم يكتمل', PENDING: 'لم يبدأ', BANNED: 'موقوف مؤقتاً' };
		return labels[st] ?? '—';
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



	/** The setup test screen is the shared specialty test (shared/specialty-test); these map this page's state onto it. */
	testPhase = computed<SpecialtyTestPhase>(() => {
		const s = this.setupTestService;
		if (s.errorMsg()) return 'error';
		if (s.result()) return 'result';
		if (s.isGenerating()) return 'generating';
		return 'active';
	});

	testQuestion = computed<SpecialtyTestQuestion | null>(() => {
		const q = this.setupTestService.currentQuestion();
		return q ? { text: q.text, options: q.options } : null;
	});

	/** Result view of the setup test: the test proves a pass only (never an approval); the level is a hint from the score. */
	testResultView = computed<SpecialtyTestResult | null>(() => {
		const r = this.setupTestService.result();
		if (!r) return null;
		const level = this.testLevelLabel();
		const passed = r.score > SPECIALTY_TEST_PASS_SCORE;
		const stats: SpecialtyTestResult['stats'] = [];
		if (r.correct != null) {
			stats.push({ label: 'إجابات صحيحة', value: r.correct, tone: 'teal' });
			stats.push({ label: 'إجابات خاطئة', value: (r.total || 0) - r.correct, tone: 'coral' });
		}
		stats.push({ label: 'الوقت المستغرق', value: this.testTimeSpent() });
		const scoreText = Number.isInteger(r.score) ? String(r.score) : r.score.toFixed(1);
		const summary = r.correct != null ? `أديت ${r.correct} من أصل ${r.total || 0} أسئلة بشكل صحيح.` : `حصلت على ${scoreText}% في اختبار من ${r.total || 0} أسئلة.`;
		return {
			score: r.score,
			passed,
			headline: passed ? 'اجتزت اختبار الإعداد' : 'لم تتجاوز الحد الأدنى للاجتياز (أكثر من 25%)',
			subline: `${summary} بناءً على درجتك، يظهر مستواك كمقدم خدمة ${level}، ولا يعني هذا اعتماد التخصص، فالاعتماد بقرار الإدارة بعد مراجعة نماذجك.`,
			pill: { label: `مستوى حسب الدرجة: ${level}`, tone: level.includes('احترافي') ? 'expert' : (level.includes('تطبيقي') || level.includes('بارع')) ? 'mid' : 'beginner' },
			stats,
			primaryLabel: 'متابعة حالة الاعتماد',
		};
	});

	/** After an error the user goes back to the start of the test (the intro) and can start again. */
	backToIntro() {
		this.isTestStarted.set(false);
	}

	/** The test being done never opens the dashboard: the status page shows what the backend says (sample required / under review / approved). */
	finishTestProcess() {
		this.access.invalidate();
		this.router.navigateByUrl(PROVIDER_ACCESS_STATUS_URL);
	}
}
