import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { NotificationPreferencesService, EMAIL_DISABLED_BY_PLATFORM, CODE_MAIL_ALWAYS_NOTE, emailDisabledByPlatform, isEmailDisabledError } from '../../../../../core/services/notification-preferences.service';

const DEFAULT_PREFERENCES = {
	newOffer: true, requestStatus: true, newMessage: true, reviewDeadline: true,
	walletActivity: true, cashback: true, financialSecurity: true,
	providerRecommendations: true, promotions: false, newsletter: false,
	channel_in_app: true, channel_email: false,
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
	private notify = inject(UiNotificationService);

	preferences = { ...DEFAULT_PREFERENCES };
	readonly isLoading = signal(false);
	readonly hasError = signal(false);
	readonly isSaving = signal(false);
	/** the platform switched optional e-mail off: the option stays visible with the stored choice but cannot be edited */
	readonly emailDisabled = signal(false);
	readonly emailDisabledText = EMAIL_DISABLED_BY_PLATFORM;
	readonly codeMailNote = CODE_MAIL_ALWAYS_NOTE;

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
					this.emailDisabled.set(emailDisabledByPlatform(res));
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
					this.notify.success('تم حفظ تفضيلات الإشعارات بنجاح');
				} else {
					this.notify.error(res.message || 'تعذر حفظ التفضيلات');
				}
			},
			error: (err) => {
				this.isSaving.set(false);
				if (isEmailDisabledError(err)) { this.emailDisabled.set(true); this.notify.error(EMAIL_DISABLED_BY_PLATFORM); return; }
				this.notify.error('تعذر حفظ التفضيلات، حاول مرة أخرى');
			}
		});
	}

	retry(): void {
		this.loadPreferences();
	}
}
