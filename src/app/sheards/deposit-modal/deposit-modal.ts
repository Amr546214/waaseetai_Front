import { AfterViewInit, Component, EventEmitter, OnDestroy, Output, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaypalDepositService } from '../../core/services/paypal-deposit.service';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../../core/store/auth.store';
import { AccountType } from '../../core/models/auth.model';

declare const paypal: any;

@Component({
	selector: 'app-deposit-modal',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './deposit-modal.html',
	styleUrl: './deposit-modal.css',
})
export class DepositModal implements AfterViewInit, OnDestroy {
	private paypalDepositService = inject(PaypalDepositService);
	private authStore = inject(AuthStore);
	readonly isCompany = () => this.authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY;
	private destroyed = false;
	private paypalSdkPoll?: ReturnType<typeof setInterval>;
	private paypalButtonsRendered = false;

	@Output() close = new EventEmitter<void>();
	@Output() deposited = new EventEmitter<{ amount: number; reference: string; method: string }>();

	currentBalance = input<number>(0);
	initialAmount = input<number | null>(null);
	lockAmount = input(false);

	amount = signal(1000);
	termsAccepted = signal(false);
	paymentStatus = signal<'idle' | 'processing' | 'success' | 'error'>('idle');
	paymentError = signal('');
	paymentReference = signal('');
	isPaypalSdkLoaded = signal(false);
	readonly paypalElementId = `pp-wallet-${crypto.randomUUID()}`;
	readonly quickAmounts = [500, 1000, 2500, 5000];

	ngAfterViewInit() {
		const requestedAmount = this.initialAmount();
		if (requestedAmount !== null && Number.isFinite(requestedAmount)) {
			this.amount.set(this.normaliseAmount(requestedAmount));
		}
		this.loadPaypalSdk();
	}

	ngOnDestroy() {
		this.destroyed = true;
		if (this.paypalSdkPoll) clearInterval(this.paypalSdkPoll);
	}

	/**
	 * Dynamically injects the PayPal JS SDK v6 script (client-id is
	 * environment-specific). No-op if it's already loaded/loading.
	 */
	private loadPaypalSdk() {
		if (typeof paypal !== 'undefined') {
			this.isPaypalSdkLoaded.set(true);
			this.initPaypalButtons();
			return;
		}

		const existing = document.getElementById('paypal-sdk-script');
		if (!existing) {
			const clientId = environment.paypal_client_id;
			if (!clientId) {
				this.paymentError.set('تهيئة PayPal غير مكتملة. يرجى المحاولة لاحقاً.');
				this.paymentStatus.set('error');
				return;
			}
			const script = document.createElement('script');
			script.id = 'paypal-sdk-script';
			script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
			document.head.appendChild(script);
		}

		let attempts = 0;
		this.paypalSdkPoll = setInterval(() => {
			attempts += 1;
			if (typeof paypal !== 'undefined') {
				clearInterval(this.paypalSdkPoll);
				this.isPaypalSdkLoaded.set(true);
				this.initPaypalButtons();
			} else if (attempts >= 25) {
				clearInterval(this.paypalSdkPoll);
				this.paymentError.set('تعذر تحميل بوابة PayPal الآمنة. تحقق من الاتصال ثم أعد المحاولة.');
				this.paymentStatus.set('error');
			}
		}, 200);
	}

	private initPaypalButtons() {
		if (this.destroyed || this.paypalButtonsRendered) return;
		const container = document.getElementById(this.paypalElementId);
		if (!container?.isConnected || typeof paypal === 'undefined') return;

		this.paypalButtonsRendered = true;
		paypal
			.Buttons({
				style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
				// Amount is read live at click time — never captured at render
				// time — and the actual order is created server-side; PayPal
				// itself never sees a client-trusted amount from this callback.
				createOrder: () => {
					if (!this.termsAccepted()) {
						this.paymentError.set('وافق على شروط الإيداع قبل تأكيد عملية الدفع.');
						return Promise.reject(new Error('terms not accepted'));
					}
					this.paymentError.set('');
					return new Promise<string>((resolve, reject) => {
						this.paypalDepositService.createOrder(this.amount()).subscribe({
							next: (response) => {
								if (!response?.success || !response.data?.paypalOrderId) {
									reject(new Error('تعذر إنشاء طلب الدفع عبر PayPal'));
									return;
								}
								resolve(response.data.paypalOrderId);
							},
							error: (error) => reject(new Error(error.error?.message || 'تعذر إنشاء طلب الدفع عبر PayPal'))
						});
					});
				},
				onApprove: (data: { orderID: string }) => {
					return new Promise<void>((resolve) => {
						this.paymentStatus.set('processing');
						this.paypalDepositService.captureOrder(data.orderID).subscribe({
							next: (response) => {
								if (!response?.success) {
									this.paymentError.set('تعذر التحقق النهائي من الدفع. لم تتم إضافة أي رصيد.');
									this.paymentStatus.set('error');
									resolve();
									return;
								}
								this.paymentReference.set(data.orderID);
								this.paymentStatus.set('success');
								this.deposited.emit({ amount: this.amount(), reference: data.orderID, method: 'paypal' });
								resolve();
							},
							error: (error) => {
								this.paymentError.set(error.error?.message || 'رفض الخادم التحقق من عملية PayPal. لم تتم إضافة أي رصيد.');
								this.paymentStatus.set('error');
								resolve();
							}
						});
					});
				},
				onError: () => {
					this.paymentError.set('فشلت عملية الدفع لدى PayPal. لم تتم إضافة أي رصيد.');
					this.paymentStatus.set('error');
				}
			})
			.render(`#${this.paypalElementId}`);
	}

	get balanceAfter() {
		return this.currentBalance() + this.amount();
	}

	canSubmit = computed(() => this.amount() >= 50 && this.amount() <= 100000 && this.termsAccepted());

	setAmount(value: number) {
		if (this.lockAmount()) return;
		this.amount.set(this.normaliseAmount(value));
	}

	onAmountInput(event: Event) {
		if (this.lockAmount()) return;
		const value = Number((event.target as HTMLInputElement).value.replace(/,/g, ''));
		if (Number.isFinite(value)) {
			this.amount.set(this.normaliseAmount(value));
			}
	}

	private normaliseAmount(value: number) {
		return Math.min(100000, Math.max(50, Math.ceil(value * 100) / 100));
	}

	confirmPayment() {}

	toggleTerms() {
		this.termsAccepted.update(value => !value);
		if (this.termsAccepted()) {
			if (this.paymentError() === 'وافق على شروط الإيداع قبل تأكيد عملية الدفع.') this.paymentError.set('');
		}
	}

	onClose() {
		this.close.emit();
	}
}
