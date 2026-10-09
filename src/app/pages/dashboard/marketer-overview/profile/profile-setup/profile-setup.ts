import { Component, ElementRef, inject, signal, computed, OnInit } from '@angular/core';
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
import { MARKETER_EDIT_PAGE, MARKETER_SETUP_MESSAGE, resolveMarketerSetup } from './marketer-setup-state';

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
	toastMsg = signal<string | null>(null);
	currentStep = signal(1);

	steps = [
		{ id: 1, label: 'بياناتك الأساسية' },
		{ id: 2, label: 'الملف التسويقي' },
		{ id: 3, label: 'قناة تسويق واحدة' },
		{ id: 4, label: 'بريد PayPal' },
		{ id: 5, label: 'المراجعة والإنهاء' },
	];

	marketingForm: FormGroup = this.fb.group({
		bio: ['', [Validators.maxLength(500)]],
	});

	channelForm: FormGroup = this.fb.group({
		platform: ['', Validators.required],
		handle: ['', Validators.required],
	});

	// PayPal is the only payout destination: one required, valid email (backend updatePaypalPayoutSchema).
	paypalForm: FormGroup = this.fb.group({
		paypalPayoutEmail: ['', paypalEmailValidators],
	});

	agree = signal(false);

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

	setStep(step: number): void {
		// Every step is saved on its own and none of them is mandatory to move on ("التالي" passes without input), so the bar is free navigation.
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

	savePaypal(): void {
		if (!this.check(this.paypalForm)) return;
		this.isSubmitting.set(true);
		this.profileService.updatePaypalPayout(String(this.paypalForm.value.paypalPayoutEmail || '').trim()).subscribe({
			next: () => {
				this.isSubmitting.set(false);
				this.showToast('تم حفظ بريد PayPal');
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
