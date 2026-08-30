import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MarketerOverviewService, MarketerSummary } from '../../../../../core/services/marketer-overview.service';
import { MarketerProfileService, MarketerProfile, AffiliateChannelHandle } from '../../../../../core/services/marketer-profile.service';

@Component({
	selector: 'app-data',
	standalone: true,
	imports: [CommonModule, ReactiveFormsModule],
	templateUrl: './data.html',
	styleUrl: './data.css',
})
export class Data implements OnInit {
	private fb = inject(FormBuilder);
	private overviewService = inject(MarketerOverviewService);
	private profileService = inject(MarketerProfileService);

	summary = signal<MarketerSummary | null>(null);
	profile = signal<MarketerProfile | null>(null);
	channels = signal<AffiliateChannelHandle[]>([]);

	activeTab = signal<string>('profile');
	isGovModalOpen = signal<boolean>(false);
	governedEditField = signal<string>('');

	marketingForm!: FormGroup;
	bankForm!: FormGroup;
	channelForm!: FormGroup;

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
		this.isGovModalOpen.set(false);
	}

	confirmGovernedEdit() {
		if (this.governedEditField() === 'البيانات البنكية والمستندات') {
			this.profileService.updateBankInfo(this.bankForm.value).subscribe(res => {
				if (res.success) {
					this.loadProfile();
					console.log('Bank info updated');
				}
			});
		}
		this.closeGovernedEdit();
	}

	saveMarketingProfile() {
		this.profileService.updateMarketingInfo(this.marketingForm.value).subscribe(res => {
			if (res.success) {
				this.loadProfile();
				console.log('Marketing profile saved');
			}
		});
	}

	onAvatarChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			const file = input.files[0];

			// Basic validation
			if (file.size > 5 * 1024 * 1024) {
				alert('حجم الصورة يجب أن لا يتجاوز 5 ميجابايت');
				return;
			}

			const reader = new FileReader();
			reader.onload = (e: any) => {
				const base64Str = e.target.result;
				this.marketingForm.patchValue({ avatarUrl: base64Str });
				this.saveMarketingProfile();
			};
			reader.readAsDataURL(file);
		}
	}

	removeAvatar() {
		this.marketingForm.patchValue({ avatarUrl: '' });
		this.saveMarketingProfile();
	}

	addChannel() {
		if (this.channelForm.valid) {
			this.profileService.addChannel(this.channelForm.value).subscribe(res => {
				if (res.success) {
					this.loadProfile();
					this.channelForm.reset();
				}
			});
		}
	}

	removeChannel(id: string) {
		this.profileService.removeChannel(id).subscribe(res => {
			if (res.success) {
				this.loadProfile();
			}
		});
	}
}
