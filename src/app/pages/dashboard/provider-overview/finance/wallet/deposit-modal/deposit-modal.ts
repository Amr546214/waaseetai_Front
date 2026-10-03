import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * UI-only deposit dialog for the provider wallet.
 *
 * There is no provider-facing deposit/top-up endpoint in
 * provider-api.service.ts (only withdrawal is wired to a real backend via
 * WithdrawalApiService). To avoid inventing payment/wallet business logic,
 * this component does not perform any HTTP call — it only collects an
 * amount, shows a summary matching the design (P-CO-FN-003), and emits a
 * `confirmed` event the host page can react to (e.g. show a "coming soon"
 * toast).
 *
 * Payment policy (temporary): the platform supports PayPal only, and this dialog has no provider
 * deposit endpoint behind it, so every method (card, bank transfer, PayPal) is shown disabled and
 * the confirm button is disabled until a real PayPal deposit exists for providers. It intentionally mirrors the visual language of the client-side
 * app-deposit-modal (sheards/deposit-modal) without touching that
 * component or its Moyasar/ClientFinanceService payment flow.
 */
@Component({
	selector: 'app-provider-deposit-modal',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './deposit-modal.html',
	styleUrl: './deposit-modal.css'
})
export class ProviderDepositModal {
	@Input() currentBalance = 0;
	@Output() close = new EventEmitter<void>();
	@Output() confirmed = new EventEmitter<{ amount: number; method: 'card' | 'bank' | 'paypal' }>();

	readonly quickAmounts = [500, 1000, 2500, 5000];

	amount = signal<number>(1000);
	selectedMethod = signal<'card' | 'bank' | 'paypal'>('paypal');
	/** No provider deposit is available yet (see the class comment). */
	readonly depositAvailable = false;

	balanceAfter = computed(() => this.currentBalance + this.amount());

	canSubmit = computed(() => this.depositAvailable && this.amount() >= 50 && this.amount() <= 100000);

	setAmount(value: number): void {
		this.amount.set(this.normaliseAmount(value));
	}

	onAmountInput(event: Event): void {
		const raw = (event.target as HTMLInputElement).value.replace(/,/g, '');
		const value = Number(raw);
		if (Number.isFinite(value)) {
			this.amount.set(this.normaliseAmount(value));
		}
	}

	/** Methods are disabled for now; kept so enabling PayPal later is a one-line change. */
	selectMethod(method: 'card' | 'bank' | 'paypal'): void {
		if (!this.depositAvailable) return;
		this.selectedMethod.set(method);
	}

	private normaliseAmount(value: number): number {
		return Math.min(100000, Math.max(0, Math.round(value)));
	}

	onConfirm(): void {
		if (!this.canSubmit()) return;
		this.confirmed.emit({ amount: this.amount(), method: this.selectedMethod() });
	}

	onClose(): void {
		this.close.emit();
	}
}
