import { Component, ElementRef, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MarketerProfileService, MarketerProfile } from '../../../../../core/services/marketer-profile.service';
import { ibanValidator } from '../../../../../core/validators/iban.validator';
import { buildReferralUrl } from '../../../../../core/utils/referral-link.util';
import { BioFieldDirective } from '../../../../../shared/directives/bio-field.directive';
import { applyServerFieldErrors, attemptSubmit, InvalidField } from '../../../../../core/forms/form-helpers';
import { mapHttpError } from '../../../../../core/forms/http-error';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { FieldErrorComponent } from '../../../../../shared/forms/field-error.component';
import { FormSummaryComponent } from '../../../../../shared/forms/form-summary.component';

const MARKETER_LABELS: Record<string, string> = {
	bio: 'الوصف التسويقي',
	platform: 'نوع القناة',
	handle: 'معرّف القناة أو رابطها',
	accountHolderName: 'اسم صاحب الحساب',
	iban: 'رقم IBAN',
	bankName: 'اسم البنك',
};

@Component({
	selector: 'app-marketer-profile-setup',
	standalone: true,
	imports: [CommonModule, RouterModule, ReactiveFormsModule, BioFieldDirective, FieldErrorComponent, FormSummaryComponent],
	templateUrl: './profile-setup.html',
	styleUrl: './profile-setup.css',
})
export class ProfileSetup implements OnInit {
	private fb = inject(FormBuilder);
	private router = inject(Router);
	private profileService = inject(MarketerProfileService);
	private readonly host = inject(ElementRef<HTMLElement>);
	private readonly notify = inject(UiNotificationService);

	/** What is missing after a failed save attempt (shown by <ws-form-summary>). */
	missing = signal<InvalidField[]>([]);
	/** True once the bank details were sent: the backend files them as a change request that waits for review. */
	bankSubmitted = signal(false);

	profile = signal<MarketerProfile | null>(null);
	isLoading = signal(true);
	isSubmitting = signal(false);
	toastMsg = signal<string | null>(null);
	currentStep = signal(1);

	steps = [
		{ id: 1, label: 'بياناتك الأساسية' },
		{ id: 2, label: 'الملف التسويقي' },
		{ id: 3, label: 'قناة تسويق واحدة' },
		{ id: 4, label: 'الحساب البنكي' },
		{ id: 5, label: 'المراجعة والإنهاء' },
	];

	marketingForm: FormGroup = this.fb.group({
		bio: ['', [Validators.maxLength(500)]],
	});

	channelForm: FormGroup = this.fb.group({
		platform: ['', Validators.required],
		handle: ['', Validators.required],
	});

	bankForm: FormGroup = this.fb.group({
		// Backend updateBankInfoSchema: bankName/accountHolderName max 120, iban max 34 and a valid IBAN.
		accountHolderName: ['', [Validators.required, Validators.maxLength(120)]],
		iban: ['', [Validators.required, ibanValidator, Validators.maxLength(34)]],
		bankName: ['', [Validators.required, Validators.maxLength(120)]],
	});

	agree = signal(false);

	completionPercentage = computed(() => this.profile()?.completionPercentage ?? 0);
	hasChannel = computed(() => (this.profile()?.marketingChannels?.length ?? 0) > 0);
	hasBank = computed(() => !!this.profile()?.iban);
	bankReviewState = computed(() => this.hasBank() ? 'مكتمل' : this.bankSubmitted() ? 'قيد المراجعة' : 'لم يُضف');
	referralLink = computed(() => buildReferralUrl(this.profile()?.referralSlug));

	ngOnInit(): void {
		this.loadProfile();
	}

	loadProfile(): void {
		this.isLoading.set(true);
		this.profileService.getProfile().subscribe({
			next: (res) => {
				this.isLoading.set(false);
				if (res.success && res.data) {
					this.profile.set(res.data);
					this.marketingForm.patchValue({ bio: res.data.bio || '' });
					this.bankForm.patchValue({
						accountHolderName: res.data.accountHolderName || '',
						iban: res.data.iban || '',
						bankName: res.data.bankName || '',
					});
				}
			},
			error: () => this.isLoading.set(false)
		});
	}

	nextStep(): void {
		this.missing.set([]);
		if (this.currentStep() < 5) this.currentStep.update(v => v + 1);
	}

	prevStep(): void {
		this.missing.set([]);
		if (this.currentStep() > 1) this.currentStep.update(v => v - 1);
	}

	setStep(step: number): void {
		// Every step is saved on its own and the optional ones can be skipped, so the bar is free navigation.
		this.missing.set([]);
		this.currentStep.set(step);
	}

	/** Marks the form touched, lists what is missing and focuses the first problem. Returns true when it is valid. */
	private check(form: FormGroup): boolean {
		const attempt = attemptSubmit(form, { root: this.host.nativeElement, labels: MARKETER_LABELS });
		this.missing.set(attempt.missing);
		return attempt.valid;
	}

	/** Server answer -> Arabic message (+ field errors from zod `errors[]` on the right inputs). */
	private fail(form: FormGroup, err: unknown): void {
		this.isSubmitting.set(false);
		const mapped = this.notify.httpError(err);
		if (Object.keys(mapped.fieldErrors).length) {
			applyServerFieldErrors(form, mapped.fieldErrors);
			this.check(form);
		}
	}

	saveBio(): void {
		if (!this.check(this.marketingForm)) return;
		this.isSubmitting.set(true);
		this.profileService.updateMarketingInfo(this.marketingForm.value).subscribe({
			next: () => { this.isSubmitting.set(false); this.showToast('تم حفظ الوصف التسويقي'); this.loadProfile(); this.nextStep(); },
			error: (err) => this.fail(this.marketingForm, err)
		});
	}

	addChannel(): void {
		if (!this.check(this.channelForm)) return;
		this.isSubmitting.set(true);
		this.profileService.addChannel(this.channelForm.value).subscribe({
			next: () => { this.isSubmitting.set(false); this.showToast('تمت إضافة القناة'); this.loadProfile(); this.nextStep(); },
			error: (err) => this.fail(this.channelForm, err)
		});
	}

	skipChannel(): void {
		this.nextStep();
	}

	saveBankInfo(): void {
		if (!this.check(this.bankForm)) return;
		this.isSubmitting.set(true);
		this.profileService.updateBankInfo(this.bankForm.value).subscribe({
			next: () => {
				this.isSubmitting.set(false);
				this.bankSubmitted.set(true);
				// The backend files this as a change request that is reviewed before it replaces the saved bank data.
				this.showToast('تم إرسال بياناتك البنكية للمراجعة، وستُفعَّل بعد الاعتماد');
				this.loadProfile();
				this.nextStep();
			},
			error: (err) => this.fail(this.bankForm, err)
		});
	}

	finish(): void {
		this.showToast('تم استكمال بياناتك بنجاح');
		setTimeout(() => this.router.navigate(['/marketer-overview']), 1200);
	}

	private toastTimer: ReturnType<typeof setTimeout> | null = null;

	showToast(msg: string): void {
		this.toastMsg.set(msg);
		// A newer toast must not be cleared early by the timer of an older one.
		if (this.toastTimer) clearTimeout(this.toastTimer);
		this.toastTimer = setTimeout(() => this.toastMsg.set(null), 3000);
	}
}
