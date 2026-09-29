import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotificationPreferencesService } from '../../../../../core/services/notification-preferences.service';

const DEFAULT_PREFERENCES = {
	newOffer: true, requestStatus: true, newMessage: true, reviewDeadline: true,
	walletActivity: true, cashback: true, financialSecurity: true,
	providerRecommendations: true, promotions: false, newsletter: false,
	inApp: true, email: true, sms: true, push: false,
};

@Component({
	selector: 'app-notifications-settings',
	standalone: true,
	imports: [FormsModule],
	templateUrl: './notifications-settings.html',
	styleUrl: './notifications-settings.css',
})
export class NotificationsSettings implements OnInit {
	private preferencesService = inject(NotificationPreferencesService);

	preferences = { ...DEFAULT_PREFERENCES };
	readonly isLoading = signal(false);
	readonly hasError = signal(false);
	readonly toastMessage = signal('');
	readonly isSaving = signal(false);
	private toastTimer?: ReturnType<typeof setTimeout>;

	ngOnInit(): void {
		this.loadPreferences();
	}

	loadPreferences(): void {
		this.isLoading.set(true);
		this.hasError.set(false);
		this.preferencesService.getPreferences().subscribe({
			next: (res) => {
				this.isLoading.set(false);
				if (res.success) {
					const saved = res.data?.settings || {};
					// Keys never saved before (new account, or a toggle added since)
					// keep their local default rather than defaulting to false.
					this.preferences = { ...DEFAULT_PREFERENCES, ...saved } as typeof DEFAULT_PREFERENCES;
				} else {
					this.hasError.set(true);
				}
			},
			error: () => {
				this.isLoading.set(false);
				this.hasError.set(true);
			}
		});
	}

	savePreferences(): void {
		if (this.isSaving()) return;
		this.isSaving.set(true);
		this.preferencesService.updatePreferences(this.preferences).subscribe({
			next: (res) => {
				this.isSaving.set(false);
				if (res.success) {
					this.showToast('تم حفظ تفضيلات الإشعارات بنجاح');
				} else {
					this.showToast(res.message || 'تعذر حفظ التفضيلات');
				}
			},
			error: () => {
				this.isSaving.set(false);
				this.showToast('تعذر حفظ التفضيلات، حاول مرة أخرى');
			}
		});
	}

	retry(): void {
		this.loadPreferences();
	}

	private showToast(message: string): void {
		if (this.toastTimer) clearTimeout(this.toastTimer);
		this.toastMessage.set(message);
		this.toastTimer = setTimeout(() => this.toastMessage.set(''), 3000);
	}
}
