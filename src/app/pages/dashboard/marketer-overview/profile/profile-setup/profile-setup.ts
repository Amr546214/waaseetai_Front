import { Component, ElementRef, inject, signal, computed, OnInit } from '@angular/core';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MarketerProfileService, MarketerProfile } from '../../../../../core/services/marketer-profile.service';
import { paypalEmailValidators } from '../../../../../core/validators/paypal-email.validator';
import { buildReferralUrl } from '../../../../../core/utils/referral-link.util';
import { BioFieldDirective } from '../../../../../shared/directives/bio-field.directive';
import { applyServerFieldErrors, attemptSubmit, InvalidField } from '../../../../../core/forms/form-helpers';
import { mapHttpError } from '../../../../../core/forms/http-error';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { FieldErrorComponent } from '../../../../../shared/forms/field-error.component';
import { FormSummaryComponent } from '../../../../../shared/forms/form-summary.component';
import { CompletionBoxComponent, CompletionBoxItem } from '../../../../../shared/forms/completion-box.component';
import { marketingChannelProblem } from '../../../../../core/utils/marketing-channel';
import { MARKETER_EDIT_PAGE, MARKETER_SETUP_MESSAGE, resolveMarketerSetup } from './marketer-setup-state';

/** Bio: required, and a value that is only spaces / invisible characters is empty. */
const bioRequired = (c: AbstractControl): ValidationErrors | null => String(c.value ?? '').replace(/[\s\u00A0\u200B-\u200D\u2060\uFEFF]/g, '') === '' ? { required: true } : null;
/** Channel handle: valid for the chosen platform (the same rule as the server). */
const channelHandleValid = (c: AbstractControl): ValidationErrors | null => {
	const problem = marketingChannelProblem(c.parent?.get('platform')?.value, c.value);
	return problem ? { channel: problem } : null;
};

const MARKETER_LABELS: Record<string, string> = {
	bio: 'الوصف التسويقي',
	platform: 'نوع القناة',
	handle: 'معرّف القناة أو رابطها',
	paypalPayoutEmail: 'بريد PayPal',
};

@Component({
	selector: 'app-marketer-profile-setup',
	standalone: true,
	imports: [CommonModule, RouterModule, ReactiveFormsModule, BioFieldDirective, FieldErrorComponent, FormSummaryComponent, CompletionBoxComponent],
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

	profile = signal<MarketerProfile | null>(null);
	isLoading = signal(true);
	isSubmitting = signal(false);
	currentStep = signal(1);

	steps = [
		{ id: 1, label: 'بياناتك الأساسية' },
		{ id: 2, label: 'الملف التسويقي' },
		{ id: 3, label: 'قناة تسويق واحدة' },
		{ id: 4, label: 'بريد PayPal' },
		{ id: 5, label: 'المراجعة والإنهاء' },
	];

	marketingForm: FormGroup = this.fb.group({
		bio: ['', [bioRequired, Validators.maxLength(500)]],
	});

	channelForm: FormGroup = this.fb.group({
		platform: ['', Validators.required],
		handle: ['', [Validators.required, channelHandleValid]],
	});

	// PayPal is the only payout destination: one required, valid email (backend updatePaypalPayoutSchema).
	paypalForm: FormGroup = this.fb.group({
		paypalPayoutEmail: ['', paypalEmailValidators],
	});

	agree = signal(false);
	/** The channel step was left (or the wizard finished) with no channel at all: the message under the channel control. */
	channelRequired = signal(false);
	/** The bio typed in this step is not saved yet while the user tries to leave it. */
	bioSaved = computed(() => !!(this.profile()?.bio ?? '').trim());

	completionPercentage = computed(() => this.profile()?.completionPercentage ?? 0);
	hasChannel = computed(() => (this.profile()?.marketingChannels?.length ?? 0) > 0);
	/** Backend `missingItems` (same source as the percentage). */
	missingItems = computed<CompletionBoxItem[]>(() => (this.profile()?.missingItems ?? []) as CompletionBoxItem[]);
	/** PayPal state from the backend (survives a reload). */
	paypalState = computed(() => this.profile()?.paypalPayoutEmail ? 'مكتمل' : 'لم يُضف');
	bioState = computed(() => this.missingItems().some(i => i.key === 'bio') ? (this.profile()?.bio?.trim() ? 'قصير (50 حرفًا على الأقل)' : 'لم يُضف') : 'مكتمل');
	referralLink = computed(() => buildReferralUrl(this.profile()?.referralSlug));

	ngOnInit(): void {
		this.loadProfile(true);
		// a different platform re-judges the typed handle; typing clears the "no channel yet" message
		this.channelForm.get('platform')!.valueChanges.subscribe(() => this.channelForm.get('handle')!.updateValueAndValidity({ emitEvent: false }));
		this.channelForm.valueChanges.subscribe(() => { if (this.channelRequired()) this.channelRequired.set(false); });
	}

	/** `initial`: the first read of the page also decides where the wizard opens (later reloads, after each saved step, never move the user). */
	loadProfile(initial = false): void {
		this.isLoading.set(true);
		this.profileService.getProfile().subscribe({
			next: (res) => {
				this.isLoading.set(false);
				if (res.success && res.data) {
					this.profile.set(res.data);
					this.marketingForm.patchValue({ bio: res.data.bio || '' });
					this.paypalForm.patchValue({ paypalPayoutEmail: res.data.paypalPayoutEmail || '' });
					if (initial) {
						// Open where the work really is (bio -> channel -> PayPal), not always on step 1; nothing left for the wizard = the profile page.
						const start = resolveMarketerSetup(res.data);
						if (start.kind === 'redirect') {
							this.notify.info(MARKETER_SETUP_MESSAGE[start.reason]);
							this.router.navigateByUrl(MARKETER_EDIT_PAGE);
							return;
						}
						this.currentStep.set(start.step);
					}
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

	/**
	 * The bar. Moving FORWARD past the bio step needs a saved bio, past the channel step needs one channel (the two required items); PayPal and the others stay free.
	 * Going back is always free.
	 */
	setStep(step: number): void {
		this.missing.set([]);
		if (step > this.currentStep()) {
			for (let s = this.currentStep(); s < step; s++) {
				if (!this.canLeave(s)) { this.currentStep.set(s); this.requireStep(s); return; }
			}
		}
		this.currentStep.set(step);
	}

	/** The «التالي» (skip) buttons: the same gate as the bar. */
	skipNext(): void {
		const s = this.currentStep();
		if (!this.canLeave(s)) { this.requireStep(s); return; }
		this.nextStep();
	}

	private canLeave(step: number): boolean {
		if (step === 2) return this.bioSaved();
		if (step === 3) return this.hasChannel();
		return true;
	}

	/** Shows what the step still needs, under the field, and focuses the first problem. */
	private requireStep(step: number): void {
		if (step === 2) {
			const bio = this.marketingForm.get('bio')!;
			bio.markAsTouched();
			if (bio.valid) bio.setErrors({ unsaved: true }); // typed but not saved yet
			this.check(this.marketingForm);
		} else if (step === 3) {
			this.channelRequired.set(true);
			this.check(this.channelForm);
		}
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
		this.profileService.updateMarketingInfo({ ...this.marketingForm.value, setup: true }).subscribe({
			next: () => { this.isSubmitting.set(false); this.notify.success('تم حفظ الوصف التسويقي'); this.loadProfile(); this.nextStep(); },
			error: (err) => this.fail(this.marketingForm, err)
		});
	}

	addChannel(): void {
		if (!this.check(this.channelForm)) return;
		this.isSubmitting.set(true);
		this.profileService.addChannel({ ...this.channelForm.value, setup: true }).subscribe({
			next: () => { this.isSubmitting.set(false); this.channelRequired.set(false); this.notify.success('تمت إضافة القناة'); this.loadProfile(); this.nextStep(); },
			error: (err) => this.fail(this.channelForm, err)
		});
	}

	savePaypal(): void {
		if (!this.check(this.paypalForm)) return;
		this.isSubmitting.set(true);
		this.profileService.updatePaypalPayout(String(this.paypalForm.value.paypalPayoutEmail || '').trim()).subscribe({
			next: () => {
				this.isSubmitting.set(false);
				this.notify.success('تم حفظ بريد PayPal');
				this.loadProfile();
				this.nextStep();
			},
			error: (err) => this.fail(this.paypalForm, err)
		});
	}

	/** Review-step box item: go back to the step that fixes it (PayPal step, or the bio / channel steps). */
	openMissingItem(item: CompletionBoxItem): void {
		const target = item.key === 'payout' ? 4 : item.key === 'channel' ? 3 : item.key === 'bio' ? 2 : null;
		if (target !== null) this.setStep(target);
	}

	finish(): void {
		// the two required items first (PayPal and the avatar stay optional here)
		if (!this.bioSaved()) { this.currentStep.set(2); this.requireStep(2); return; }
		if (!this.hasChannel()) { this.currentStep.set(3); this.requireStep(3); return; }
		this.notify.success('تم استكمال بياناتك بنجاح');
		setTimeout(() => this.router.navigate(['/marketer-overview']), 1200);
	}
}
