import { AfterViewInit, Component, EventEmitter, OnDestroy, Output, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaypalDepositService } from '../../core/services/paypal-deposit.service';
import { LevelsService } from '../../core/levels/levels.service';
import { paypalDepositBreakdown } from '../../core/levels/deposit-fee';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../../core/store/auth.store';
import { mapHttpError } from '../../core/forms/http-error';
import { scrollFocus } from '../../shared/forms/form-error-focus';
import { backendBannerMessage, genericBanner } from '../../shared/forms/submit-feedback';
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
	private levels = inject(LevelsService);
	readonly isCompany = () => this.authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY;
	private destroyed = false;
	private paypalSdkPoll?: ReturnType<typeof setInterval>;
	private paypalButtonsRendered = false;

	@Output() close = new EventEmitter<void>();
	@Output() deposited = new EventEmitter<{ amount: number; reference: string; method: string }>();

	currentBalance = input<number>(0);
	initialAmount = input<number | null>(null);
	lockAmount = input(false);

	/** The user types the amount: it starts EMPTY (null), never a suggested number. Real limits are MIN_AMOUNT..MAX_AMOUNT. */
	amount = signal<number | null>(null);
	static readonly MIN_AMOUNT = 50;
	static readonly MAX_AMOUNT = 100000;
	/** What is literally in the box while typing (so "5" is not rewritten to the minimum under the user's fingers). */
	private rawText = signal<string | null>(null);
	readonly amountDisplay = computed(() => this.rawText() ?? (this.amount() ?? ''));
	/** Becomes true after the first blur / failed attempt, so an untouched empty box is not shouted at. */
	amountTouched = signal(false);
	termsError = signal('');
	/** Message under the amount box: empty, below the minimum or above the maximum. */
	readonly amountError = computed(() => {
		if (!this.amountTouched()) return '';
		const v = this.amount();
		if (v === null) return 'أدخل مبلغ الإيداع بالدولار';
		if (v < DepositModal.MIN_AMOUNT) return `الحد الأدنى للإيداع ${DepositModal.MIN_AMOUNT} دولار`;
		if (v > DepositModal.MAX_AMOUNT) return `الحد الأقصى للإيداع ${DepositModal.MAX_AMOUNT.toLocaleString('en-US')} دولار`;
		return '';
	});
	private creatingOrder = false;
	/**
	 * Fee policy: the amount is the NET added to the wallet; PayPal is charged net + the PayPal deposit fee (percent from the backend table).
	 * null while the table has not answered: no number is shown rather than a typed one.
	 */
	readonly breakdown = computed(() => {
		const a = this.amount();
		return a === null || a < DepositModal.MIN_AMOUNT || a > DepositModal.MAX_AMOUNT ? null : paypalDepositBreakdown(a, this.levels.payload()?.payments.clientDeposit['paypal']);
	});
	termsAccepted = signal(false);
	paymentStatus = signal<'idle' | 'processing' | 'success' | 'error'>('idle');
	paymentError = signal('');
	paymentReference = signal('');
	isPaypalSdkLoaded = signal(false);
	readonly paypalElementId = `pp-wallet-${crypto.randomUUID()}`;
	readonly quickAmounts = [500, 1000, 2500, 5000];

	constructor() { this.levels.ensureLoaded(); }

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
					// Each problem is explained next to its own control (amount box / terms row), not only in a banner.
					if (!this.validateBeforePay()) return Promise.reject(new Error('deposit form invalid'));
					if (this.creatingOrder) return Promise.reject(new Error('order already being created'));
					this.creatingOrder = true;
					this.paymentError.set('');
					return new Promise<string>((resolve, reject) => {
						this.paypalDepositService.createOrder(this.amount()!).subscribe({
							next: (response) => {
								this.creatingOrder = false;
								if (!response?.success || !response.data?.paypalOrderId) {
									reject(new Error('تعذر إنشاء طلب الدفع عبر PayPal'));
									return;
								}
								resolve(response.data.paypalOrderId);
							},
							error: (error) => {
								this.creatingOrder = false;
								// 400/422 about the amount -> under the amount box; network / 429 / 5xx stay one honest banner.
								const mapped = mapHttpError(error, { fallback: 'تعذر إنشاء طلب الدفع عبر PayPal' });
								const generic = genericBanner(mapped);
								if (generic !== null) { this.paymentError.set(generic); reject(new Error(mapped.message)); return; }
								void backendBannerMessage(document, mapped, { resolve: { amount: 'deposit-amount' } }).then(banner => {
									this.paymentError.set(banner);
									reject(new Error(mapped.message));
								});
							}
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
								this.deposited.emit({ amount: this.amount() ?? 0, reference: data.orderID, method: 'paypal' });
								resolve();
							},
							error: (error) => {
								this.paymentError.set(mapHttpError(error, { fallback: 'رفض الخادم التحقق من عملية PayPal. لم تتم إضافة أي رصيد.' }).message);
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
		return this.currentBalance() + (this.amount() ?? 0);
	}

	canSubmit = computed(() => { const a = this.amount(); return a !== null && a >= DepositModal.MIN_AMOUNT && a <= DepositModal.MAX_AMOUNT && this.termsAccepted(); });

	setAmount(value: number) {
		if (this.lockAmount()) return;
		this.rawText.set(null);
		this.amount.set(this.normaliseAmount(value));
	}

	onAmountInput(event: Event) {
		if (this.lockAmount()) return;
		const text = (event.target as HTMLInputElement).value;
		this.rawText.set(text);
		const trimmed = text.replace(/,/g, '').trim();
		const value = trimmed === '' ? NaN : Number(trimmed);
		// empty / not a number = no amount (null), never 0 and never the minimum; out-of-range numbers keep their value so the message can say why.
		this.amount.set(Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null);
	}

	/** Marks + focuses the first problem (amount first, then terms). True when the deposit may go to PayPal. */
	validateBeforePay(): boolean {
		this.amountTouched.set(true);
		if (this.amountError()) {
			this.focusField('deposit-amount');
			return false;
		}
		if (!this.termsAccepted()) {
			this.termsError.set('وافق على شروط الإيداع قبل تأكيد عملية الدفع.');
			this.focusField('deposit-terms');
			return false;
		}
		return true;
	}

	/** The PayPal buttons are not clickable until the terms are accepted: a click on that area explains what is missing instead of doing nothing. */
	onPaypalAreaClick() {
		if (!this.termsAccepted()) this.validateBeforePay();
	}

	onAmountBlur() { this.amountTouched.set(true); }

	private focusField(id: string) {
		const el = document.getElementById(id);
		if (el) scrollFocus(el);
	}

	private normaliseAmount(value: number) {
		return Math.min(100000, Math.max(50, Math.ceil(value * 100) / 100));
	}

	confirmPayment() {}

	toggleTerms() {
		this.termsAccepted.update(value => !value);
		if (this.termsAccepted()) {
			this.termsError.set('');
			if (this.paymentError() === 'وافق على شروط الإيداع قبل تأكيد عملية الدفع.') this.paymentError.set('');
		}
	}

	onClose() {
		this.close.emit();
	}
}
