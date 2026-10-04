import { Component, DestroyRef, ElementRef, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthStore } from '../../../../../core/store/auth.store';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { COUNTRY_NAMES, citiesOf, cityPlaceholder, normalizeCountry } from '../../../../../shared/data/countries-cities';
import { linkCountryCity } from '../../../../../shared/data/country-city-form';
import { mapHttpError } from '../../../../../core/forms/http-error';
import { attemptSubmit, collectInvalidFields, focusFirstInvalid, InvalidField } from '../../../../../core/forms/form-helpers';
import { DOC_MIMES, MB, validateFile } from '../../../../../core/forms/file-validation';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { FieldErrorComponent } from '../../../../../shared/forms/field-error.component';
import { FormSummaryComponent } from '../../../../../shared/forms/form-summary.component';

const SETUP_LABELS: Record<string, string> = {
	idNumber: 'رقم الهوية الوطنية',
	dob: 'تاريخ الميلاد',
	country: 'الدولة',
	city: 'المدينة',
	occupation: 'المهنة الحالية',
	address: 'العنوان التفصيلي',
	paymentType: 'نوع طريقة الاستلام',
	bankName: 'اسم البنك',
	accountHolder: 'اسم صاحب الحساب',
	iban: 'رقم الآيبان (IBAN)',
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
	imports: [CommonModule, RouterModule, ReactiveFormsModule, FieldErrorComponent, FormSummaryComponent],
	templateUrl: './profile-setup.html'
})
export class ProfileSetupDashboard implements OnInit {
	private fb = inject(FormBuilder);
	private router = inject(Router);
	private authStore = inject(AuthStore);
	private profileApi = inject(ProfileApiService);

	isSubmitting = signal<boolean>(false);
	currentStep = signal<number>(1);
	toastMsg = signal<string | null>(null);
	isUploading = signal<{ [key: string]: boolean }>({});
	/** What is missing after a failed Next/submit attempt (shown by <ws-form-summary>). */
	missing = signal<InvalidField[]>([]);
	/** Arabic file errors (size/type) per upload control. */
	fileErrors = signal<Record<string, string>>({});
	private readonly host = inject(ElementRef<HTMLElement>);
	private readonly notify = inject(UiNotificationService);

	steps = [
		{ id: 1, label: 'بيانات طالب الخدمة' },
		{ id: 2, label: 'الهوية والتوثيق' },
		{ id: 3, label: 'البيانات البنكية أو المحفظة' },
		{ id: 4, label: 'المستندات عند الحاجة' },
		{ id: 5, label: 'المراجعة والإرسال' }
	];

	// Shared country -> cities data (src/app/shared/data); the city list always follows the chosen country.
	readonly countryNames = COUNTRY_NAMES;
	readonly citiesOf = citiesOf;
	readonly cityPlaceholder = cityPlaceholder;
	private destroyRef = inject(DestroyRef);

	setupForm: FormGroup = this.fb.group({
		details: this.fb.group({
			idNumber: ['', [Validators.required, Validators.pattern(/^[12]\d{9}$/)]],
			dob: ['', Validators.required],
			country: ['', Validators.required],
			city: ['', Validators.required],
			occupation: ['', Validators.required],
			address: ['', Validators.required]
		}),
		identity: this.fb.group({
			frontId: [''],
			backId: ['']
		}),
		bank: this.fb.group({
			paymentType: ['bank', Validators.required], // bank or wallet
			bankName: ['', Validators.required],
			accountHolder: ['', Validators.required],
			iban: ['', [Validators.required, Validators.minLength(24), Validators.maxLength(24)]]
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
						dob: data.dob ? new Date(data.dob).toISOString().split('T')[0] : '',
						country: normalizeCountry(data.country),
						city: data.city || '',
						occupation: data.industry || '',
						address: data.address || ''
					});

					// Patch bank
					this.setupForm.get('bank')?.patchValue({
						paymentType: data.paymentType || 'bank',
						bankName: data.bankName || '',
						accountHolder: data.accountHolder || '',
						iban: data.iban || ''
					});

					// Patch documents preview
					if (data.frontIdUrl) this.setupForm.get('identity.frontId')?.setValue(data.frontIdUrl);
					if (data.backIdUrl) this.setupForm.get('identity.backId')?.setValue(data.backIdUrl);
					if (data.supportingDocsUrl) this.setupForm.get('documents.supportingDocs')?.setValue(data.supportingDocsUrl);
					if (data.notes) this.setupForm.get('documents.notes')?.setValue(data.notes);

					// Disable verified fields to prevent tampering
					if (data.kycStatus === 'VERIFIED') {
						if (data.idNumber) this.setupForm.get('details.idNumber')?.disable();
						if (data.dob) this.setupForm.get('details.dob')?.disable();
						if (data.iban) this.setupForm.get('bank.iban')?.disable();
					}
				}
			},
			error: (err: any) => {
				console.error("Error loading profile setup data", err);
			}
		});
	}

	/** Validates one step: marks it touched, builds the summary, focuses the first missing field. */
	private validateStep(step: number): boolean {
		const group = this.setupForm.get(STEP_GROUPS[step]);
		if (!group) return true;
		const attempt = attemptSubmit(group, { root: this.host.nativeElement, labels: SETUP_LABELS });
		this.missing.set(attempt.missing);
		return attempt.valid;
	}

	/** After a step change the new step's inputs are not rendered yet: focus once they are. */
	private focusSoon() {
		setTimeout(() => focusFirstInvalid(this.host.nativeElement));
	}

	nextStep() {
		const step = this.currentStep();
		if (step >= 5) return;
		if (!this.validateStep(step)) return;
		this.missing.set([]);
		this.currentStep.update(v => v + 1);
	}

	prevStep() {
		if (this.currentStep() > 1) {
			this.missing.set([]);
			this.currentStep.update(v => v - 1);
		}
	}

	/** Step-bar click. Going forward validates every step on the way and stops at the first incomplete one. */
	setStep(target: number) {
		if (target < 1 || target > 5) return;
		for (let s = this.currentStep(); s < target; s++) {
			if (!this.validateStep(s)) {
				this.currentStep.set(s);
				this.focusSoon();
				return;
			}
		}
		this.missing.set([]);
		this.currentStep.set(target);
	}

	triggerNafath() {
		this.showToast('جاري الربط مع NAFATH...');
	}

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

		this.isUploading.update(s => ({ ...s, [controlName]: true }));

		const reader = new FileReader();
		reader.onload = () => {
			const base64Str = reader.result as string;
			const group = this.setupForm.get(groupName) as FormGroup;
			if (group) {
				group.patchValue({ [controlName]: base64Str });
			}
			this.isUploading.update(s => ({ ...s, [controlName]: false }));
		};
		reader.onerror = () => {
			this.isUploading.update(s => ({ ...s, [controlName]: false }));
			this.fileErrors.update(e => ({ ...e, [controlName]: 'تعذّرت قراءة الملف، حاول مرة أخرى أو اختر ملفًا آخر' }));
		};
		reader.readAsDataURL(file);
	}

	skipSetup() {
		this.showToast('تم التخطي — يمكنك العودة لاحقاً');
		setTimeout(() => {
			this.router.navigate(['/client-overview']);
		}, 1500);
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
				paymentType: formVal.bank.paymentType,
				bankName: formVal.bank.bankName,
				accountHolder: formVal.bank.accountHolder,
				iban: formVal.bank.iban
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
				this.showToast('تم حفظ البيانات بنجاح وإرسال المستندات للمراجعة');

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
		const raw: string = err?.error?.message || '';
		const fieldFix: [RegExp, string, string, string][] = [
			[/ID Number/i, 'details.idNumber', 'رقم الهوية غير صحيح: يجب أن يتكون من 10 أرقام ويبدأ بـ 1 أو 2', 'details'],
			[/IBAN/i, 'bank.iban', 'رقم الآيبان يجب أن يتكون من 24 حرفًا بالضبط', 'bank'],
		];
		for (const [re, path, message, groupName] of fieldFix) {
			if (re.test(raw)) {
				const c = this.setupForm.get(path);
				c?.setErrors({ ...(c.errors ?? {}), server: message });
				c?.markAsTouched();
				this.currentStep.set(Number(Object.keys(STEP_GROUPS).find(k => STEP_GROUPS[+k] === groupName)));
				this.missing.set(collectInvalidFields(this.setupForm.get(groupName)!, SETUP_LABELS));
				this.focusSoon();
				return;
			}
		}
		const mapped = this.notify.httpError(err, { fallback: 'حدث خطأ أثناء حفظ البيانات، يرجى المحاولة مرة أخرى' });
		// Server field messages (zod-style `errors[]`) land on the matching inputs.
		const names = Object.keys(mapped.fieldErrors);
		if (names.length) {
			for (const name of names) {
				const c = this.findControl(name);
				if (c) { c.setErrors({ ...(c.errors ?? {}), server: mapped.fieldErrors[name] }); c.markAsTouched(); }
			}
			this.missing.set(collectInvalidFields(this.setupForm, SETUP_LABELS));
			this.focusSoon();
		}
	}

	private findControl(name: string) {
		for (const g of Object.values(STEP_GROUPS)) {
			const c = this.setupForm.get(`${g}.${name}`);
			if (c) return c;
		}
		return null;
	}

	showToast(msg: string) {
		this.toastMsg.set(msg);
		setTimeout(() => {
			this.toastMsg.set(null);
		}, 3000);
	}
}
