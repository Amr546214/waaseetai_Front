import { Component, ElementRef, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { resolveField, scrollFocus } from '../../../../../../shared/forms/form-error-focus';
import { WsBasePipe, WsCurrencyPipe } from '../../../../../../shared/money/money.pipe';
import { currencyCode, formatBase } from '../../../../../../core/utils/currency';

/**
 * UI-only deposit dialog for the provider wallet.
 *
 * There is no provider-facing deposit/top-up endpoint in
 * provider-api.service.ts (only withdrawal is wired to a real backend via
 * WithdrawalApiService). To avoid inventing payment/wallet business logic,
 * this component does not perform any HTTP call — it only collects an
 * amount, shows a summary matching the design (P-CO-FN-003), and emits a
 * `confirmed` event the host page can react to (e.g. show an "unavailable"
 * notification).
 *
 * Payment policy: PayPal (USD) is the only deposit rail, and this dialog has no provider deposit endpoint
 * behind it, so the PayPal method is shown disabled and the confirm button is disabled until a real PayPal
 * deposit exists for providers.
 */
@Component({
	selector: 'app-provider-deposit-modal',
	standalone: true,
	imports: [WsBasePipe, WsCurrencyPipe, CommonModule],
	templateUrl: './deposit-modal.html',
	styleUrl: './deposit-modal.css'
})
export class ProviderDepositModal {
	private host = inject<ElementRef<HTMLElement>>(ElementRef);
	@Input() currentBalance = 0;
	@Output() close = new EventEmitter<void>();
	@Output() confirmed = new EventEmitter<{ amount: number; method: 'paypal' }>();

	/** Real deposit limits (platform base currency). */
	readonly minAmount = 50;
	readonly maxAmount = 100000;

	/** Starts empty: the provider types the amount; nothing is pre-filled or suggested. */
	amount = signal<number | null>(null);
	/** The provider pressed confirm: an empty amount now shows its message. */
	attempted = signal(false);
	selectedMethod = signal<'paypal'>('paypal');
	/** No provider deposit is available yet (see the class comment). */
	readonly depositAvailable = false;

	balanceAfter = computed(() => this.currentBalance + (this.amount() ?? 0));

	/** Why the amount is not acceptable (null when it is fine or still untouched). */
	amountError = computed<string | null>(() => {
		const a = this.amount();
		if (a == null) return this.attempted() ? `أدخل مبلغ الإيداع (${currencyCode()})` : null;
		if (a < this.minAmount) return `الحد الأدنى لمبلغ الإيداع ${formatBase(this.minAmount)}`;
		if (a > this.maxAmount) return `الحد الأقصى لمبلغ الإيداع ${formatBase(this.maxAmount)}`;
		return null;
	});

	canSubmit = computed(() => this.depositAvailable && this.amount() != null && this.amountError() === null);

	setAmount(value: number): void {
		this.amount.set(this.normaliseAmount(value));
	}

	onAmountInput(event: Event): void {
		const raw = (event.target as HTMLInputElement).value.replace(/,/g, '').trim();
		if (raw === '') { this.amount.set(null); return; }
		const value = Number(raw);
		if (Number.isFinite(value)) {
			this.amount.set(this.normaliseAmount(value));
		}
	}

	/** Methods are disabled for now; kept so enabling PayPal later is a one-line change. */
	selectMethod(method: 'paypal'): void {
		if (!this.depositAvailable) return;
		this.selectedMethod.set(method);
	}

	private normaliseAmount(value: number): number {
		return Math.min(100000, Math.max(0, Math.round(value)));
	}

	onConfirm(): void {
		this.attempted.set(true);
		if (this.amountError()) {
			// The message is rendered at the field; focus goes there below the sticky header.
			setTimeout(() => { const el = resolveField(this.host.nativeElement, 'dpmAmt'); if (el) scrollFocus(el); }, 0);
			return;
		}
		if (!this.canSubmit()) return;
		this.confirmed.emit({ amount: this.amount()!, method: this.selectedMethod() });
	}

	onClose(): void {
		this.close.emit();
	}
}
