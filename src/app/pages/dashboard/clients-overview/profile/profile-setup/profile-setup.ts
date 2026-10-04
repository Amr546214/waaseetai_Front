import { Component, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthStore } from '../../../../../core/store/auth.store';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { COUNTRY_NAMES, citiesOf, cityPlaceholder, normalizeCountry } from '../../../../../shared/data/countries-cities';
import { paypalEmailError, paypalEmailValidators } from '../../../../../core/validators/paypal-email.validator';
import { linkCountryCity } from '../../../../../shared/data/country-city-form';

@Component({
	selector: 'app-profile-setup-dashboard',
	standalone: true,
	imports: [CommonModule, RouterModule, ReactiveFormsModule],
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

	steps = [
		{ id: 1, label: 'بيانات طالب الخدمة' },
		{ id: 2, label: 'الهوية والتوثيق' },
		{ id: 3, label: 'حساب PayPal للاستلام' },
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
			// PayPal is the only payout method for now; legacy bank/wallet values are neither shown nor sent.
			paymentType: ['paypal', Validators.required],
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
						dob: data.dob ? new Date(data.dob).toISOString().split('T')[0] : '',
						country: normalizeCountry(data.country),
						city: data.city || '',
						occupation: data.industry || '',
						address: data.address || ''
					});

					// Patch PayPal (a legacy bank/wallet paymentType is ignored: the step is PayPal-only)
					this.setupForm.get('bank')?.patchValue({
						paymentType: 'paypal',
						paypalPayoutEmail: data.paypalPayoutEmail || ''
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
					}
				}
			},
			error: (err: any) => {
				console.error("Error loading profile setup data", err);
			}
		});
	}

	paypalEmailMsg(): string | null {
		const c = this.setupForm.get('bank.paypalPayoutEmail');
		return c && (c.touched || c.dirty) ? paypalEmailError(c.errors) : null;
	}

	nextStep() {
		if (this.currentStep() < 5) {
			this.currentStep.update(v => v + 1);
		}
	}

	prevStep() {
		if (this.currentStep() > 1) {
			this.currentStep.update(v => v - 1);
		}
	}

	setStep(step: number) {
		if (step >= 1 && step <= 5) {
			this.currentStep.set(step);
		}
	}

	triggerNafath() {
		this.showToast('جاري الربط مع NAFATH...');
	}

	async onFileSelected(event: Event, groupName: string, controlName: string) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

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
			this.showToast('حدث خطأ أثناء معالجة الملف');
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
		if (this.setupForm.valid) {
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
					paymentType: 'paypal',
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

			console.log("Submitting Client Profile Setup", payload);

			this.profileApi.saveClientProfileSetup(payload).subscribe({
				next: (res: any) => {
					this.isSubmitting.set(false);
					this.showToast('تم حفظ البيانات بنجاح وإرسال المستندات للمراجعة');

					setTimeout(() => {
						this.router.navigate(['/client-overview/profile']);
					}, 2000);
				},
				error: (err: any) => {
					this.isSubmitting.set(false);
					this.showToast('حدث خطأ أثناء حفظ البيانات، يرجى المحاولة مرة أخرى');
				}
			});
		} else {
			console.warn("Form is INVALID! Cannot submit.");
			console.log("Details Form Valid?", this.setupForm.get('details')?.valid);
			console.log("Identity Form Valid?", this.setupForm.get('identity')?.valid);
			console.log("Bank Form Valid?", this.setupForm.get('bank')?.valid);
			console.log("Agreements Form Valid?", this.setupForm.get('agreements')?.valid);
			
			this.setupForm.markAllAsTouched();
			this.showToast('الرجاء التأكد من تعبئة جميع الحقول المطلوبة');
		}
	}

	showToast(msg: string) {
		this.toastMsg.set(msg);
		setTimeout(() => {
			this.toastMsg.set(null);
		}, 3000);
	}
}
