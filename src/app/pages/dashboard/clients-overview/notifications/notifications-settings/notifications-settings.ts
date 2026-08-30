import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-notifications-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './notifications-settings.html',
  styleUrl: './notifications-settings.css',
})
export class NotificationsSettings {
	preferences = {
		newOffer: true, requestStatus: true, newMessage: true, reviewDeadline: true,
		walletActivity: true, cashback: true, financialSecurity: true,
		providerRecommendations: true, promotions: false, newsletter: false,
		inApp: true, email: true, sms: true, push: false,
	};
	readonly isLoading = signal(false);
	readonly hasError = signal(false);
	readonly toastMessage = signal('');
	private toastTimer?: ReturnType<typeof setTimeout>;

	savePreferences(): void { this.showToast('تم حفظ تفضيلات الإشعارات'); }
	retry(): void { this.hasError.set(false); }
	private showToast(message: string): void {
		if (this.toastTimer) clearTimeout(this.toastTimer);
		this.toastMessage.set(message);
		this.toastTimer = setTimeout(() => this.toastMessage.set(''), 3000);
	}

}
