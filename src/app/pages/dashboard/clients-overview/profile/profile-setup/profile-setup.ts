import { identityInspectionResult } from '../../../../../core/utils/identity-inspection-result';
import { documentInputProblem, DOCUMENT_NUMBER_PATTERN, IDENTITY_DOCUMENT_TYPES, identityCountryCode } from '../../../../../shared/data/identity-documents';
import { IdentityCheckService } from '../../../../../core/services/identity-check.service';
import { birthDateValidator, maxDobIso } from '../../../../../core/forms/birth-date';
import { Component, DestroyRef, ElementRef, effect, inject, signal, untracked, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthStore } from '../../../../../core/store/auth.store';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { GeoSuggestionService } from '../../../../../shared/data/geo-suggestion';
import { COUNTRY_NAMES, citiesOf, cityPlaceholder, normalizeCountry } from '../../../../../shared/data/countries-cities';
import { linkCountryCity } from '../../../../../shared/data/country-city-form';
import { mapHttpError } from '../../../../../core/forms/http-error';
import { attemptSubmit, collectInvalidFields, focusFirstInvalid, InvalidField } from '../../../../../core/forms/form-helpers';
import { DOC_MIMES, MB, validateFile } from '../../../../../core/forms/file-validation';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { FieldErrorComponent } from '../../../../../shared/forms/field-error.component';
import { paypalEmailValidators } from '../../../../../core/validators/paypal-email.validator';
import { FormSummaryComponent } from '../../../../../shared/forms/form-summary.component';
import { KycDocumentLink } from '../../../../../sheards/kyc-document-link/kyc-document-link';
import { KycAccess } from '../../../../../core/models/kyc-document.model';
import { IdentityGateService, identityRefusalMessage, isIdentityNotApproved } from '../../../../../core/services/identity-gate.service';
import { IdentityGateStatusComponent } from '../../../../../shared/identity-gate/identity-gate-status.component';
import { CLIENT_EDIT_PAGE, SETUP_REDIRECT_MESSAGE, resolveClientSetup } from './profile-setup-state';

const SETUP_LABELS: Record<string, string> = {
	idNumber: 'رقم الهوية الوطنية',
	dob: 'تاريخ الميلاد',
	country: 'الدولة',
	city: 'المدينة',
	occupation: 'المهنة الحالية',
	address: 'العنوان التفصيلي',
	paypalPayoutEmail: 'بريد PayPal',
	accurate: 'الإقرار بصحة البيانات',
	terms: 'الموافقة على شروط الاستخدام',
	privacy: 'الموافقة على سياسة الخصوصية',
};

/** Form group per wizard step (steps 2 and 4 have only optional uploads). */
const STEP_GROUPS: Record<number, string> = { 1: 'details', 2: 'identity', 3: 'bank', 4: 'documents', 5: 'agreements' };

/**
 * Upload limits. The three images travel as base64 inside ONE JSON body and the backend accepts at most 10 MB, so the
 * per-file limits keep the worst case (2 + 2 + 3 MB, x1.34 for base64) under it.
 */
const FILE_RULES: Record<string, { maxBytes: number; mimeTypes: string[]; typesLabel: string }> = {
	frontId: { maxBytes: 2 * MB, mimeTypes: DOC_MIMES, typesLabel: 'JPG أو PNG أو WEBP أو PDF' },
	backId: { maxBytes: 2 * MB, mimeTypes: DOC_MIMES, typesLabel: 'JPG أو PNG أو WEBP أو PDF' },
	supportingDocs: { maxBytes: 3 * MB, mimeTypes: DOC_MIMES, typesLabel: 'JPG أو PNG أو WEBP أو PDF' },
};

@Component({
	selector: 'app-profile-setup-dashboard',
	standalone: true,
	imports: [CommonModule, RouterModule, ReactiveFormsModule, FieldErrorComponent, FormSummaryComponent, KycDocumentLink, IdentityGateStatusComponent],
	providers: [IdentityGateService],
	templateUrl: './profile-setup.html'
})
export class ProfileSetupDashboard implements OnInit {
	private verifiedIssuer: string | undefined;
	readonly identityDocumentTypes = IDENTITY_DOCUMENT_TYPES;

	/** Documents already stored for this client (legacy public URL or private marker); shown with a "view" link. */
	storedDocs = signal<Record<'frontId' | 'backId' | 'supportingDocs', { url: string | null; access: KycAccess | null } | null>>({ frontId: null, backId: null, supportingDocs: null });
	private fb = inject(FormBuilder);
	private router = inject(Router);
	private authStore = inject(AuthStore);
	private profileApi = inject(ProfileApiService);
	private identityCheck = inject(IdentityCheckService);
	/** The identity gate: the next step opens only while the backend says the CURRENT image + data are APPROVED. */
	readonly gate = inject(IdentityGateService).use('CLIENT');
	/** Why the identity could not be sent from step 2 (data of step 1 incomplete / refused by the server). */
	gateProblem = signal<string | null>(null);
	/** The back side is required for every document except a passport. */
	backRequired(): boolean { return this.setupForm.get('details.idDocumentType')?.value !== 'PASSPORT'; }
	constructor() {
		// entering the identity step always reads the real state from the server
		effect(() => { if (this.currentStep() === 2) untracked(() => this.gate.load().subscribe({ error: () => { /* the state stays unknown: nothing opens */ } })); });
	}
	/** Neutral owner state of the automatic ID check: only «in review» or nothing, never a field result. An old backend without the endpoint just leaves it off. */
	identityInReview = signal<boolean>(false);
	private refreshIdentityInReview() {
		this.identityCheck.getMyState('CLIENT').subscribe({ next: (st) => this.identityInReview.set(st === 'IN_REVIEW'), error: () => this.identityInReview.set(false) });
	}

	isSubmitting = signal<boolean>(false);
	currentStep = signal<number>(1);
	/** ID documents were sent and wait for review (kycStatus PENDING): shown as pending, never as an empty step. */
	kycPending = signal<boolean>(false);
	/** the admin refused the identity documents: the reason is shown and the step is open for new files */
	kycRejectedReason = signal<string | null>(null);
	isUploading = signal<{ [key: string]: boolean }>({});
	/** What is missing after a failed Next/submit attempt (shown by <ws-form-summary>). */
	missing = signal<InvalidField[]>([]);
	/** Arabic file errors (size/type) per upload control. */
	fileErrors = signal<Record<string, string>>({});
	/** Advisory live AI document inspection results for Step 2 (frontId / backId). */
	private idInspectionVersions: Record<string, number> = {};
	idDocInspections = signal<Record<string, { status: 'scanning' | 'valid' | 'warning'; message: string }>>({});
	private readonly host = inject(ElementRef<HTMLElement>);
	private readonly notify = inject(UiNotificationService);

	steps = [
		{ id: 1, label: 'بيانات طالب الخدمة' },
		{ id: 2, label: 'الهوية والتوثيق' },
		{ id: 3, label: 'بريد PayPal' },
		{ id: 4, label: 'المستندات عند الحاجة' },
		{ id: 5, label: 'المراجعة والإرسال' }
	];

	// Shared country -> cities data (src/app/shared/data); the city list always follows the chosen country.
	readonly countryNames = COUNTRY_NAMES;
	private readonly geo = inject(GeoSuggestionService);
	/** the country/city were filled from an approximate network location (a hint the user can change); cleared as soon as the user edits either field */
	readonly geoSuggested = signal(false);
	private geoSuggest() {
		const g = this.setupForm.get('details'); this.geo.suggestInto(g, () => { this.geoSuggested.set(true); const off = () => this.geoSuggested.set(false); g?.get('country')?.valueChanges.subscribe(off); g?.get('city')?.valueChanges.subscribe(off); });
	}
	readonly citiesOf = citiesOf;
	readonly cityPlaceholder = cityPlaceholder;
	readonly maxDobIso = maxDobIso();
	private destroyRef = inject(DestroyRef);

	setupForm: FormGroup = this.fb.group({
		details: this.fb.group({
			idDocumentType: [''],
			idNumber: ['', [Validators.required, Validators.pattern(DOCUMENT_NUMBER_PATTERN)]],
			dob: ['', [Validators.required, birthDateValidator]],
			country: ['', Validators.required],
			city: ['', Validators.required],
			occupation: ['', Validators.required],
			address: ['', Validators.required]
		}),
		identity: this.fb.group({
			frontId: [''],
			backId: ['']
		}),
		// PayPal is the only payout destination (saved to ClientProfile.paypalPayoutEmail, counts +20 in the completion).
		bank: this.fb.group({
			paypalPayoutEmail: ['', paypalEmailValidators]
		}),
		documents: this.fb.group({
			supportingDocs: [''],
			notes: ['']
		}),
		agreements: this.fb.group({
			accurate: [false, Validators.requiredTrue],
			terms: [false, Validators.requiredTrue],
			privacy: [false, Validators.requiredTrue]
		})
	});

	ngOnInit() {
		linkCountryCity(this.setupForm.get('details'), this.destroyRef);
		this.loadClientProfile();
	}

	loadClientProfile() {
		this.profileApi.getClientProfileSetup().subscribe({
			next: (res: any) => {
				if (res && res.data) {
					const data = res.data;
					
					// Patch details
					this.setupForm.get('details')?.patchValue({
						idNumber: data.idNumber || '',
						idDocumentType: data.idDocumentType || '',
						dob: data.dob ? new Date(data.dob).toISOString().split('T')[0] : '',
						country: normalizeCountry(data.country),
						city: data.city || '',
						occupation: data.industry || '',
						address: data.address || ''
					});
					this.geoSuggest(); // approximate hint for EMPTY country/city only

					// Patch bank
					this.setupForm.get('bank')?.patchValue({ paypalPayoutEmail: data.paypalPayoutEmail || '' });

					// Patch documents preview
					// A legacy (public) document keeps coming back as its URL and is re-sent as before. A PRIVATE one comes back as null plus a
					// "<field>Access" marker: the form stays empty and re-saving without a new file keeps it (the backend keeps what is stored).
					if (data.frontIdUrl) this.setupForm.get('identity.frontId')?.setValue(data.frontIdUrl);
					if (data.backIdUrl) this.setupForm.get('identity.backId')?.setValue(data.backIdUrl);
					if (data.supportingDocsUrl) this.setupForm.get('documents.supportingDocs')?.setValue(data.supportingDocsUrl);
					this.storedDocs.set({
						frontId: data.frontIdUrl || data.frontIdUrlAccess?.private ? { url: data.frontIdUrl ?? null, access: data.frontIdUrlAccess ?? null } : null,
						backId: data.backIdUrl || data.backIdUrlAccess?.private ? { url: data.backIdUrl ?? null, access: data.backIdUrlAccess ?? null } : null,
						supportingDocs: data.supportingDocsUrl || data.supportingDocsUrlAccess?.private ? { url: data.supportingDocsUrl ?? null, access: data.supportingDocsUrlAccess ?? null } : null
					});
					if (data.notes) this.setupForm.get('documents.notes')?.setValue(data.notes);

					// Agreements that were already accepted stay accepted (the wizard saves them with the rest).
					this.setupForm.get('agreements')?.patchValue({ accurate: !!data.accurateAgreed, terms: !!data.termsAgreed, privacy: !!data.privacyAgreed });
					this.kycPending.set(data.kycStatus === 'PENDING');
					if (data.kycStatus === 'PENDING') this.refreshIdentityInReview();
					this.kycRejectedReason.set(data.kycStatus === 'REJECTED' ? (data.kycRejectionReason || 'لم تستوفِ الوثائق متطلبات التحقق') : null);

					// Open where the work really is (first missing step from the saved data), not always on step 1; nothing left for the wizard = go to the edit page.
					const start = resolveClientSetup(data);
					if (start.kind === 'redirect') {
						this.notify.info(SETUP_REDIRECT_MESSAGE[start.reason]);
						this.router.navigateByUrl(CLIENT_EDIT_PAGE);
						return;
					}
					this.currentStep.set(start.step);
					// a resumed wizard never stands past an identity that is not approved (the server would refuse those steps anyway)
					if (start.step > 2) this.gate.load().subscribe({ next: g => { if (!g.canAdvance && this.currentStep() > 2) this.currentStep.set(2); }, error: () => this.currentStep.set(2) });

					// Disable verified fields to prevent tampering
					if (data.kycStatus === 'VERIFIED') {
						this.verifiedIssuer = data.idIssuingCountry || undefined;
						if (data.idNumber) this.setupForm.get('details.idNumber')?.disable();
						this.setupForm.get('details.idDocumentType')?.disable();
						if (data.dob) this.setupForm.get('details.dob')?.disable();
					}
				}
			},
			error: (err: any) => {
				console.error("Error loading profile setup data", err);
			}
		});
	}

	/** Validates one step: marks it touched, builds the summary, focuses the first missing field. */
	documentError(key: 'idNumber' | 'idDocumentType'): string | null {
		const number = this.setupForm.get('details.idNumber');
		const type = this.setupForm.get('details.idDocumentType');
		if (!number || number.disabled || type?.disabled) return null;
		if (!number.touched && !type?.touched) return null;
		const problem = documentInputProblem(number.value, identityCountryCode(this.setupForm.get('details.country')?.value), type?.value ?? null);
		if (problem?.key === key) return problem.message;
		if (key === 'idNumber') return number.getError('server') ?? (number.hasError('required') ? 'أدخل رقم الوثيقة' : null);
		return type?.getError('server') ?? null;
	}

	private validateStep(step: number): boolean {
		const group = this.setupForm.get(STEP_GROUPS[step]);
		if (!group) return true;
		if (step === 1 && !group.get('idNumber')?.disabled) {
			const d = this.setupForm.getRawValue().details;
			this.setupForm.get('details.idNumber')?.markAsTouched();
			this.setupForm.get('details.idDocumentType')?.markAsTouched();
			const problem = documentInputProblem(d.idNumber, identityCountryCode(d.country), d.idDocumentType);
			if (problem) { this.missing.set([]); return false; }
		}

		// step 2 (identity): which sides are needed is decided by the identity gate (the server's «missing» list: a passport needs only the front), not here
		const attempt = attemptSubmit(group, { root: this.host.nativeElement, labels: SETUP_LABELS });
		this.missing.set(attempt.missing.filter(issue => issue.path !== 'idNumber' && issue.path !== 'details.idNumber'));
		return attempt.valid;
	}

	/** After a step change the new step's inputs are not rendered yet: focus once they are. */
	private focusSoon() {
		setTimeout(() => focusFirstInvalid(this.host.nativeElement));
	}

	/** Moving to the next step stores the current one first (database, never the browser); a failed save keeps the user on the step with the error. */
	nextStep() {
		const step = this.currentStep();
		if (step >= 5) return;
		this.advanceTo(step + 1);
	}

	/** Step 4 (supporting documents) is optional: go straight to the review. No upload, no save, no validation of the step. */
	skipDocuments() {
		if (this.currentStep() !== 4) return;
		this.missing.set([]);
		this.currentStep.set(5);
	}

	/** Required steps (1 details, 3 PayPal) are "done" only while their fields are really valid; optional steps (2, 4) never count as incomplete. */
	stepIsIncomplete(step: number): boolean {
		if (step !== 1 && step !== 3) return false;
		const group = this.setupForm.get(STEP_GROUPS[step]);
		return !!group && !group.valid;
	}

	/** Identity documents were sent (a file in the form, or already under review): the review shows "تم الإرسال" instead of "اختياري". */
	identityDocsProvided(): boolean {
		const v = this.setupForm.getRawValue().identity;
		return !!((v.frontId || this.storedDocs().frontId) && (v.backId || this.storedDocs().backId)) || this.kycPending();
	}

	/** Review shortcut to a step that is missing something: go there and show what is missing, right where the field is. */
	goToStep(step: number) {
		if (step < 1 || step > 5) return;
		this.currentStep.set(step);
		const group = this.setupForm.get(STEP_GROUPS[step]);
		if (group) {
			group.markAllAsTouched();
			this.missing.set(collectInvalidFields(group, SETUP_LABELS, STEP_GROUPS[step]));
		}
		this.focusSoon();
	}

	prevStep() {
		if (this.currentStep() > 1) {
			this.missing.set([]);
			this.currentStep.update(v => v - 1);
		}
	}

	/** Step-bar click: backwards is free; going forward validates AND stores every step on the way and stops at the first one that fails. */
	setStep(target: number) {
		if (target < 1 || target > 5) return;
		if (target <= this.currentStep()) {
			this.missing.set([]);
			this.currentStep.set(target);
			return;
		}
		this.advanceTo(target);
	}

	/** True while a step is being stored (the "التالي" button is disabled meanwhile). */
	isSavingStep = signal<boolean>(false);

	private advanceTo(target: number) {
		const step = this.currentStep();
		if (step >= target) { this.missing.set([]); return; }
		if (this.isSavingStep()) return;
		if (!this.validateStep(step)) { this.focusSoon(); return; }
		if (step === 2) { this.checkGate(() => this.afterStep(step, target)); return; }
		this.persistStep(step, () => this.afterStep(step, target));
	}

	private afterStep(step: number, target: number) {
		this.missing.set([]);
		this.currentStep.set(step + 1);
		this.advanceTo(target);
	}

	/** Leaving the identity step: the server's CURRENT answer decides, not the local state. */
	private checkGate(proceed: () => void) {
		this.isSavingStep.set(true);
		this.gate.load().subscribe({
			next: g => {
				this.isSavingStep.set(false);
				if (g.canAdvance) { this.gateProblem.set(null); proceed(); return; }
				this.gateProblem.set(g.status === 'UNDER_REVIEW' ? 'الوثيقة قيد المراجعة؛ تُفتح الخطوة التالية بعد اعتمادها.' : g.status === 'REJECTED' ? 'الوثيقة مرفوضة؛ صحّح البيانات أو أعد رفع الصورة.' : 'ارفع صورة الوثيقة وأكمل بيانات الهوية لتبدأ المراجعة.');
			},
			error: () => { this.isSavingStep.set(false); this.gateProblem.set('تعذّر التحقق من حالة الوثيقة، حاول مرة أخرى.'); }
		});
	}

	/** Only a NEW upload (a data URI) is sent: a document that is already stored is never re-submitted (that would re-open its review). */
	private newUpload(value: unknown): string | undefined {
		return typeof value === 'string' && value.startsWith('data:') ? value : undefined;
	}

	/** Builds the payload of one step; null = nothing to store for it (an optional step left empty). */
	private stepPayload(step: number): { step: 1 | 2 | 3 | 4; body: Record<string, unknown> } | null {
		const raw = this.setupForm.getRawValue();
		if (step === 1) {
			const d = raw.details;
			return { step: 1, body: { details: { idNumber: d.idNumber, idIssuingCountry: this.setupForm.get('details.idDocumentType')?.disabled ? this.verifiedIssuer : (d.idDocumentType && identityCountryCode(d.country)) || undefined, idDocumentType: d.idDocumentType || undefined, dob: d.dob ? new Date(d.dob).toISOString() : '', country: d.country, city: d.city, occupation: d.occupation, address: d.address } } };
		}
		if (step === 2) {
			return null; // the identity step is saved (and its review started) by sendIdentity(), right after the photo is chosen
		}
		if (step === 3) return { step: 3, body: { paypalPayoutEmail: String(raw.bank.paypalPayoutEmail || '').trim() } };
		if (step === 4) {
			const supportingDocs = this.newUpload(raw.documents.supportingDocs);
			const notes = String(raw.documents.notes || '').trim();
			return supportingDocs || notes ? { step: 4, body: { documents: { supportingDocs, notes } } } : null;
		}
		return null;
	}

	private persistStep(step: number, done: () => void) {
		const payload = this.stepPayload(step);
		if (!payload) { done(); return; }
		this.isSavingStep.set(true);
		this.profileApi.saveClientSetupStep(payload.step, payload.body).subscribe({
			next: (res: any) => {
				this.isSavingStep.set(false);
				// the details save re-evaluates the identity review on the server (a changed number/type/country cancels an old approval): re-read it
				if (payload.step === 1) this.gate.load().subscribe({ error: () => { /* keeps the previous state */ } });
				const pct = Number(res?.data?.completionPercentage);
				const user = this.authStore.currentUser();
				if (user && Number.isFinite(pct)) this.authStore.authenticate(this.authStore.token()!, { ...user, profileCompletionPercent: pct });
				done();
			},
			error: (err: any) => {
				this.isSavingStep.set(false);
				this.handleSaveError(err);
			}
		});
	}

	// Nafath verification is unavailable (no integration): the button is disabled in the template, so there is nothing to trigger.

	async onFileSelected(event: Event, groupName: string, controlName: string) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const rule = FILE_RULES[controlName];
		const problem = rule ? validateFile(file, rule) : null;
		if (problem) {
			// Reject before reading: nothing is stored, the previous valid file (if any) stays, the user is told why.
			this.fileErrors.update(e => ({ ...e, [controlName]: problem }));
			input.value = '';
			return;
		}
		this.fileErrors.update(e => { const { [controlName]: _gone, ...rest } = e; return rest; });

		const inspectionVersion = (this.idInspectionVersions[controlName] || 0) + 1;
		this.idInspectionVersions[controlName] = inspectionVersion;
		const isCurrent = () => this.idInspectionVersions[controlName] === inspectionVersion;
		this.idDocInspections.update(curr => { const next = { ...curr }; delete next[controlName]; return next; });
		this.isUploading.update(s => ({ ...s, [controlName]: true }));

		const reader = new FileReader();
		reader.onload = () => {
			if (!isCurrent()) return;
			const base64Str = reader.result as string;
			const group = this.setupForm.get(groupName) as FormGroup;
			if (group) {
				group.patchValue({ [controlName]: base64Str });
			}
			this.isUploading.update(s => ({ ...s, [controlName]: false }));

			if (
				groupName === 'identity' &&
				(controlName === 'frontId' || controlName === 'backId') &&
				(file.type?.startsWith('image/') || file.type === 'application/pdf') &&
				file.size >= 512 &&
				typeof this.profileApi.verifyIdentityDocument === 'function'
			) {
				this.idDocInspections.update(curr => ({
					...curr,
					[controlName]: { status: 'scanning', message: '⏳ جاري فحص وضوح الوثيقة ونوعها بالذكاء الاصطناعي...' }
				}));
				const u = this.authStore.currentUser();
				const fullName = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '';
				const idNumber = String(this.setupForm.get('details.idNumber')?.value || '').trim();
				const dob = String(this.setupForm.get('details.dob')?.value || '').trim();
				this.profileApi.verifyIdentityDocument({
					side: controlName === 'frontId' ? 'FRONT' : 'BACK',
					image: base64Str,
					imageMimeType: file.type,
					declared: {
						...(fullName ? { fullName } : {}),
						...(idNumber ? { nationalId: idNumber } : {}),
						...(dob ? { birthDate: dob } : {})
					}
				}).subscribe({
					next: (res: any) => {
						if (!isCurrent()) return;
						const d = res?.data;
						if (!d) {
							this.idDocInspections.update(curr => { const next = { ...curr }; delete next[controlName]; return next; });
							return;
						}
						const inspection = identityInspectionResult(d);
						this.idDocInspections.update(curr => ({
							...curr,
							[controlName]: {
								...inspection
							}
						}));
					},
					error: () => {
						if (!isCurrent()) return;
						this.idDocInspections.update(curr => { const next = { ...curr }; delete next[controlName]; return next; });
					}
				});
			} else if (controlName === 'frontId' || controlName === 'backId') {
				this.idDocInspections.update(curr => { const next = { ...curr }; delete next[controlName]; return next; });
			}
			// choosing the photo saves the identity (data + image) and starts the review right here; it never moves to another step
			if (groupName === 'identity') this.sendIdentity();
		};
		reader.onerror = () => {
			if (!isCurrent()) return;
			this.isUploading.update(s => ({ ...s, [controlName]: false }));
			this.fileErrors.update(e => ({ ...e, [controlName]: 'تعذّرت قراءة الملف، حاول مرة أخرى أو اختر ملفًا آخر' }));
		};
		reader.readAsDataURL(file);
	}

	/**
	 * The identity step save: the ID data of step 1 + the new photo(s) go to the server, which stores them and STARTS the review. A successful
	 * upload never opens the next step; only the server's APPROVED does. The user stays here and the form keeps everything (no data loss).
	 */
	sendIdentity() {
		const raw = this.setupForm.getRawValue();
		const d = raw.details;
		const issuer = this.setupForm.get('details.idDocumentType')?.disabled ? this.verifiedIssuer : identityCountryCode(d.country);
		const problem = documentInputProblem(d.idNumber, issuer ?? null, d.idDocumentType || null);
		if (problem || !d.idDocumentType || !issuer || !d.idNumber) {
			this.gateProblem.set('أكمل بيانات الهوية في الخطوة الأولى (الدولة ونوع الوثيقة ورقمها) ثم أعد رفع الصورة؛ الصورة محفوظة في النموذج.' + (problem ? ' ' + problem.message : ''));
			return;
		}
		const frontId = this.newUpload(raw.identity.frontId), backId = this.newUpload(raw.identity.backId);
		this.gateProblem.set(null);
		this.gate.save({
			idIssuingCountry: issuer, idDocumentType: d.idDocumentType, idNumber: String(d.idNumber).trim(),
			...(d.dob ? { dob: String(d.dob).slice(0, 10) } : {}), ...(frontId ? { frontId } : {}), ...(backId ? { backId } : {})
		}).subscribe({
			next: () => { /* the status panel shows the new state; polling follows while it is under review */ },
			error: (err: any) => { this.gateProblem.set(this.notify.httpError(err, { fallback: 'تعذّر حفظ الوثيقة، حاول مرة أخرى' }).message || 'تعذّر حفظ الوثيقة، حاول مرة أخرى'); }
		});
	}

	/** The saved data may have just taken the profile to 100%: update the completion the sidebar / banners read (best effort). */
	private refreshStoredCompletion() {
		this.profileApi.getClientProfileSetup().subscribe({
			next: (res: any) => {
				const pct = Number(res?.data?.completionPercentage);
				const user = this.authStore.currentUser();
				if (user && Number.isFinite(pct)) this.authStore.authenticate(this.authStore.token()!, { ...user, profileCompletionPercent: pct });
			},
			error: () => { /* the next dashboard / profile load refreshes it */ }
		});
	}

	submitForm() {
		if (this.setupForm.invalid) {
			// Find the first step with something missing, go there, list everything that is missing, focus it.
			this.setupForm.markAllAsTouched();
			const all = collectInvalidFields(this.setupForm, SETUP_LABELS);
			this.missing.set(all);
			const firstStep = Number(Object.keys(STEP_GROUPS).find(k => all.some(i => i.path.startsWith(STEP_GROUPS[+k] + '.')))) || 1;
			this.currentStep.set(firstStep);
			this.focusSoon();
			return;
		}

		this.missing.set([]);
		this.isSubmitting.set(true);
		const formVal = this.setupForm.getRawValue();

		const payload: any = {
			details: {
				idNumber: formVal.details.idNumber,
				idIssuingCountry: this.setupForm.get('details.idDocumentType')?.disabled ? this.verifiedIssuer : (formVal.details.idDocumentType && identityCountryCode(formVal.details.country)) || undefined,
				idDocumentType: formVal.details.idDocumentType || undefined,
				dob: formVal.details.dob ? new Date(formVal.details.dob).toISOString() : null,
				country: formVal.details.country,
				city: formVal.details.city,
				occupation: formVal.details.occupation,
				address: formVal.details.address
			},
			identity: {
				frontId: formVal.identity.frontId,
				backId: formVal.identity.backId
			},
			bank: {
				paypalPayoutEmail: String(formVal.bank.paypalPayoutEmail || '').trim()
			},
			documents: {
				supportingDocs: formVal.documents.supportingDocs,
				notes: formVal.documents.notes
			},
			agreements: {
				accurate: formVal.agreements.accurate,
				terms: formVal.agreements.terms,
				privacy: formVal.agreements.privacy
			}
		};

		this.profileApi.saveClientProfileSetup(payload).subscribe({
			next: () => {
				this.isSubmitting.set(false);
				this.notify.success('تم حفظ البيانات بنجاح وإرسال المستندات للمراجعة');
				this.refreshStoredCompletion();

				setTimeout(() => {
					this.router.navigate(['/client-overview/profile']);
				}, 2000);
			},
			error: (err: any) => {
				this.isSubmitting.set(false);
				this.handleSaveError(err);
			}
		});
	}

	/**
	 * Server rejection -> something the user can act on. The setup endpoint answers a few 400s in English
	 * ("Invalid ID Number format."), so those are matched here and placed on the right field and step.
	 */
	private handleSaveError(err: any) {
		if (isIdentityNotApproved(err)) {
			// the server refused a step that skipped the identity: go back to it and show the real state
			this.currentStep.set(2);
			this.gate.refusedByServer();
			this.gateProblem.set(identityRefusalMessage(err));
			return;
		}
		const raw: string = err?.error?.message || '';
		const fieldFix: [RegExp, string, string, string][] = [
			[/ID Number/i, 'details.idNumber', 'رقم الوثيقة غير مقبول؛ راجع الرقم ونوع الوثيقة', 'details'],
			[/PayPal/i, 'bank.paypalPayoutEmail', 'بريد PayPal غير صحيح', 'bank'],
		];
		for (const [re, path, message, groupName] of fieldFix) {
			if (re.test(raw)) {
				this.showFieldErrors([{ path, message }], groupName);
				return;
			}
		}
		const mapped = this.notify.httpError(err, { fallback: 'حدث خطأ أثناء حفظ البيانات، يرجى المحاولة مرة أخرى' });
		// Server field messages (zod-style `errors[]`) land on the matching inputs; if the field lives on another step,
		// go back to that step and focus it.
		const items: { path: string; message: string }[] = [];
		let firstGroup = '';
		for (const [name, message] of Object.entries(mapped.fieldErrors)) {
			const found = this.findControl(name);
			if (!found) continue;
			items.push({ path: `${STEP_GROUPS[found.step]}.${name}`, message });
			firstGroup = firstGroup || STEP_GROUPS[found.step];
		}
		if (items.length) this.showFieldErrors(items, firstGroup);
	}

	/**
	 * Goes to the step of the first field and, once that step is on screen, puts the server messages on the inputs and
	 * focuses the first one (binding a control to a freshly created input revalidates it, which would drop errors set
	 * earlier).
	 */
	private showFieldErrors(items: { path: string; message: string }[], groupName: string) {
		this.currentStep.set(Number(Object.keys(STEP_GROUPS).find(k => STEP_GROUPS[+k] === groupName)));
		setTimeout(() => {
			for (const { path, message } of items) {
				const c = this.setupForm.get(path);
				c?.setErrors({ ...(c.errors ?? {}), server: message });
				c?.markAsTouched();
			}
			this.missing.set(collectInvalidFields(this.setupForm.get(groupName)!, SETUP_LABELS));
			setTimeout(() => this.focusSoon(), 60);
		}, 30);
	}

	private findControl(name: string) {
		for (const [step, g] of Object.entries(STEP_GROUPS)) {
			const control = this.setupForm.get(`${g}.${name}`);
			if (control) return { control, step: Number(step) };
		}
		return null;
	}
}
