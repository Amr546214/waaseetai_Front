import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MarketerProfileService, MarketerProfile } from '../../../../../core/services/marketer-profile.service';

@Component({
	selector: 'app-marketer-profile-setup',
	standalone: true,
	imports: [CommonModule, RouterModule, ReactiveFormsModule],
	templateUrl: './profile-setup.html',
	styleUrl: './profile-setup.css',
})
export class ProfileSetup implements OnInit {
	private fb = inject(FormBuilder);
	private router = inject(Router);
	private profileService = inject(MarketerProfileService);

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
		accountHolderName: ['', Validators.required],
		iban: ['', Validators.required],
		bankName: ['', Validators.required],
	});

	agree = signal(false);

	completionPercentage = computed(() => this.profile()?.completionPercentage ?? 0);
	hasChannel = computed(() => (this.profile()?.marketingChannels?.length ?? 0) > 0);
	hasBank = computed(() => !!this.profile()?.iban);

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
		if (this.currentStep() < 5) this.currentStep.update(v => v + 1);
	}

	prevStep(): void {
		if (this.currentStep() > 1) this.currentStep.update(v => v - 1);
	}

	setStep(step: number): void {
		this.currentStep.set(step);
	}

	saveBio(): void {
		if (this.marketingForm.invalid) { this.marketingForm.markAllAsTouched(); return; }
		this.isSubmitting.set(true);
		this.profileService.updateMarketingInfo(this.marketingForm.value).subscribe({
			next: () => { this.isSubmitting.set(false); this.showToast('تم حفظ الوصف التسويقي'); this.loadProfile(); this.nextStep(); },
			error: () => { this.isSubmitting.set(false); this.showToast('حدث خطأ، حاول مرة أخرى'); }
		});
	}

	addChannel(): void {
		if (this.channelForm.invalid) { this.channelForm.markAllAsTouched(); return; }
		this.isSubmitting.set(true);
		this.profileService.addChannel(this.channelForm.value).subscribe({
			next: () => { this.isSubmitting.set(false); this.showToast('تمت إضافة القناة'); this.loadProfile(); this.nextStep(); },
			error: () => { this.isSubmitting.set(false); this.showToast('حدث خطأ، حاول مرة أخرى'); }
		});
	}

	skipChannel(): void {
		this.nextStep();
	}

	saveBankInfo(): void {
		if (this.bankForm.invalid) { this.bankForm.markAllAsTouched(); return; }
		this.isSubmitting.set(true);
		this.profileService.updateBankInfo(this.bankForm.value).subscribe({
			next: () => { this.isSubmitting.set(false); this.showToast('تم حفظ البيانات البنكية'); this.loadProfile(); this.nextStep(); },
			error: () => { this.isSubmitting.set(false); this.showToast('حدث خطأ، حاول مرة أخرى'); }
		});
	}

	finish(): void {
		this.showToast('تم استكمال بياناتك بنجاح');
		setTimeout(() => this.router.navigate(['/marketer-overview']), 1200);
	}

	showToast(msg: string): void {
		this.toastMsg.set(msg);
		setTimeout(() => this.toastMsg.set(null), 3000);
	}
}
