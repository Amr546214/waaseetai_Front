import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { MarketerOverviewService, MarketerSummary } from '../../../../../core/services/marketer-overview.service';
import { MarketerProfileService, MarketerProfile, AffiliateChannelHandle } from '../../../../../core/services/marketer-profile.service';
import { environment } from '../../../../../../environments/environment';

@Component({
	selector: 'app-data',
	standalone: true,
	imports: [CommonModule, ReactiveFormsModule, RouterLink],
	templateUrl: './data.html',
	styleUrl: './data.css',
})
export class Data implements OnInit {
	private fb = inject(FormBuilder);
	private router = inject(Router);
	private overviewService = inject(MarketerOverviewService);
	private profileService = inject(MarketerProfileService);

	summary = signal<MarketerSummary | null>(null);
	profile = signal<MarketerProfile | null>(null);
	channels = signal<AffiliateChannelHandle[]>([]);

	activeTab = signal<string>('profile');
	isGovModalOpen = signal<boolean>(false);
	governedEditField = signal<string>('');
	copiedField = signal<string>('');

	toastMessage = signal<{ text: string; type: 'success' | 'error' } | null>(null);
	private toastTimer: ReturnType<typeof setTimeout> | null = null;

	savingProfile = signal<boolean>(false);
	savingBank = signal<boolean>(false);
	addingChannel = signal<boolean>(false);
	removingChannelId = signal<string | null>(null);
	submittingBasics = signal<boolean>(false);

	referralLink = computed(() => {
		const slug = this.profile()?.referralSlug;
		return slug ? `${environment.url_api.replace(/\/api\/?$/, '')}/ref/${slug}` : '';
	});

	marketingForm!: FormGroup;
	bankForm!: FormGroup;
	channelForm!: FormGroup;
	basicsForm!: FormGroup;

	ngOnInit() {
		this.marketingForm = this.fb.group({
			avatarUrl: [''],
			bio: ['', [Validators.maxLength(500)]],
		});

		this.bankForm = this.fb.group({
			accountHolderName: [''],
			iban: [''],
			bankName: [''],
			swiftCode: ['']
		});

		// EMAIL is deliberately NOT part of this form — governed email changes
		// are disabled for now (see profile-requests.dto.ts on the backend for
		// why: no email-ownership verification exists yet, and Google OAuth's
		// existing-user lookup matches by email, so a silent email swap here
		// could lock out a Google-authenticated affiliate with no password).
		// The email input on this tab stays read-only, bound directly to
		// profile()?.user?.email, never to this form.
		this.basicsForm = this.fb.group({
			firstName: [''],
			lastName: [''],
			nationalId: [''],
			phoneNumber: ['']
		});

		this.channelForm = this.fb.group({
			platform: ['', Validators.required],
			handle: ['', Validators.required]
		});

		this.overviewService.getSummary().subscribe(res => {
			if (res.success) {
				this.summary.set(res.data);
			}
		});

		this.loadProfile();
	}

	loadProfile() {
		this.profileService.getProfile().subscribe(res => {
			if (res.success && res.data) {
				this.profile.set(res.data);
				this.channels.set(res.data.marketingChannels || []);

				this.marketingForm.patchValue({
					avatarUrl: res.data.avatarUrl || '',
					bio: res.data.bio || ''
				});

				this.bankForm.patchValue({
					accountHolderName: res.data.accountHolderName || '',
					iban: res.data.iban || '',
					bankName: res.data.bankName || '',
					swiftCode: res.data.swiftCode || ''
				});

				this.basicsForm.patchValue({
					firstName: res.data.user?.firstName || '',
					lastName: res.data.user?.lastName || '',
					nationalId: res.data.user?.idNumber || '',
					phoneNumber: res.data.user?.phoneNumber || ''
				});
			}
		});
	}

	setActiveTab(tab: string) {
		this.activeTab.set(tab);
	}

	openGovernedEdit(field: string) {
		this.governedEditField.set(field);
		this.isGovModalOpen.set(true);
	}

	closeGovernedEdit() {
		if (this.savingBank()) return;
		this.isGovModalOpen.set(false);
	}

	confirmGovernedEdit() {
		if (this.governedEditField() !== 'البيانات البنكية والمستندات') {
			this.closeGovernedEdit();
			return;
		}
		if (this.savingBank()) return;

		this.savingBank.set(true);
		this.profileService.updateBankInfo(this.bankForm.value).pipe(
			finalize(() => this.savingBank.set(false))
		).subscribe({
			next: (res) => {
				if (res.success) {
					this.loadProfile();
					this.showToast('تم إرسال بيانات الحساب البنكي بنجاح', 'success');
					this.isGovModalOpen.set(false);
				} else {
					this.showToast(res.message || 'تعذر إرسال بيانات الحساب البنكي', 'error');
				}
			},
			error: (err) => {
				this.showToast(err?.error?.message || 'تعذر إرسال بيانات الحساب البنكي، حاول مرة أخرى', 'error');
			}
		});
	}

	submitBasicsChangeRequest() {
		if (this.submittingBasics() || this.basicsForm.invalid) return;

		const value = this.basicsForm.value;
		const payload: { firstName?: string; lastName?: string; nationalId?: string; phoneNumber?: string } = {};
		if (value.firstName) payload.firstName = value.firstName;
		if (value.lastName) payload.lastName = value.lastName;
		if (value.nationalId) payload.nationalId = value.nationalId;
		if (value.phoneNumber) payload.phoneNumber = value.phoneNumber;

		if (!payload.firstName && !payload.lastName && !payload.nationalId && !payload.phoneNumber) {
			this.showToast('يرجى إدخال قيمة جديدة لحقل واحد على الأقل', 'error');
			return;
		}

		this.submittingBasics.set(true);
		this.profileService.createIdentityRequest(payload).pipe(
			finalize(() => this.submittingBasics.set(false))
		).subscribe({
			next: (res) => {
				if (res.success) {
					this.showToast('تم إرسال طلب التعديل للمراجعة بنجاح', 'success');
				} else {
					this.showToast(res.message || 'تعذر إرسال طلب التعديل', 'error');
				}
			},
			error: (err) => {
				this.showToast(err?.error?.message || 'تعذر إرسال طلب التعديل، حاول مرة أخرى', 'error');
			}
		});
	}

	saveMarketingProfile(successMessage: string = 'تم حفظ الملف التسويقي بنجاح', revertAvatarUrlOnError?: string) {
		if (this.savingProfile()) return;

		this.savingProfile.set(true);
		this.profileService.updateMarketingInfo(this.marketingForm.value).pipe(
			finalize(() => this.savingProfile.set(false))
		).subscribe({
			next: (res) => {
				if (res.success) {
					this.loadProfile();
					this.showToast(successMessage, 'success');
				} else {
					if (revertAvatarUrlOnError !== undefined) this.marketingForm.patchValue({ avatarUrl: revertAvatarUrlOnError });
					this.showToast(res.message || 'تعذر حفظ التغييرات', 'error');
				}
			},
			error: (err) => {
				if (revertAvatarUrlOnError !== undefined) this.marketingForm.patchValue({ avatarUrl: revertAvatarUrlOnError });
				this.showToast(err?.error?.message || 'تعذر حفظ التغييرات، حاول مرة أخرى', 'error');
			}
		});
	}

	onAvatarChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			const file = input.files[0];

			// Basic validation
			if (file.size > 5 * 1024 * 1024) {
				this.showToast('حجم الصورة يجب أن لا يتجاوز 5 ميجابايت', 'error');
				input.value = '';
				return;
			}

			const previousAvatarUrl = this.marketingForm.value.avatarUrl || '';
			const reader = new FileReader();
			reader.onload = (e: any) => {
				const base64Str = e.target.result;
				this.marketingForm.patchValue({ avatarUrl: base64Str });
				this.saveMarketingProfile('تم تحديث الصورة الشخصية بنجاح', previousAvatarUrl);
			};
			reader.onerror = () => {
				this.showToast('تعذرت قراءة ملف الصورة، حاول مرة أخرى', 'error');
			};
			reader.readAsDataURL(file);
		}
	}

	removeAvatar() {
		const previousAvatarUrl = this.marketingForm.value.avatarUrl || '';
		this.marketingForm.patchValue({ avatarUrl: '' });
		this.saveMarketingProfile('تم حذف الصورة الشخصية بنجاح', previousAvatarUrl);
	}

	addChannel() {
		if (!this.channelForm.valid || this.addingChannel()) return;

		this.addingChannel.set(true);
		this.profileService.addChannel(this.channelForm.value).pipe(
			finalize(() => this.addingChannel.set(false))
		).subscribe({
			next: (res) => {
				if (res.success) {
					this.loadProfile();
					this.channelForm.reset();
					this.showToast('تمت إضافة القناة بنجاح', 'success');
				} else {
					this.showToast(res.message || 'تعذر إضافة القناة', 'error');
				}
			},
			error: (err) => {
				this.showToast(err?.error?.message || 'تعذر إضافة القناة، حاول مرة أخرى', 'error');
			}
		});
	}

	removeChannel(id: string) {
		if (this.removingChannelId()) return;

		this.removingChannelId.set(id);
		this.profileService.removeChannel(id).pipe(
			finalize(() => this.removingChannelId.set(null))
		).subscribe({
			next: (res) => {
				if (res.success) {
					this.loadProfile();
					this.showToast('تم حذف القناة بنجاح', 'success');
				} else {
					this.showToast(res.message || 'تعذر حذف القناة', 'error');
				}
			},
			error: (err) => {
				this.showToast(err?.error?.message || 'تعذر حذف القناة، حاول مرة أخرى', 'error');
			}
		});
	}

	private showToast(text: string, type: 'success' | 'error' = 'success') {
		this.toastMessage.set({ text, type });
		if (this.toastTimer) clearTimeout(this.toastTimer);
		this.toastTimer = setTimeout(() => this.toastMessage.set(null), type === 'error' ? 5000 : 3000);
	}

	useAiChannelSuggestion() {
		this.setActiveTab('profile');
		this.channelForm.patchValue({ platform: 'LINKEDIN' });
	}

	copyToClipboard(text: string, field: string) {
		if (!text) return;
		navigator.clipboard.writeText(text).then(() => {
			this.copiedField.set(field);
			setTimeout(() => this.copiedField.set(''), 2000);
		});
	}

	cancelAndReturn() {
		this.loadProfile();
		this.router.navigate(['/marketer-overview']);
	}
}
