import { AfterViewInit, Component, EventEmitter, OnDestroy, Output, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WsBasePipe, WsCurrencyPipe } from '../../shared/money/money.pipe';
import { currencyLabel, formatBase } from '../../core/utils/currency';
import { PaypalDepositService } from '../../core/services/paypal-deposit.service';
import { LevelsService } from '../../core/levels/levels.service';
import { paypalDepositBreakdown } from '../../core/levels/deposit-fee';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../../core/store/auth.store';
import { mapHttpError } from '../../core/forms/http-error';
import { scrollFocus } from '../../shared/forms/form-error-focus';
import { backendBannerMessage, genericBanner } from '../../shared/forms/submit-feedback';
import { AccountType } from '../../core/models/auth.model';
import { WaitTimerService, waitScope } from '../../core/wait/wait-timer.service';
import { isRateLimitError, RATE_LIMIT_MESSAGE, startWaitFromError } from '../../core/utils/rate-limit.util';
import { rateLimitSentence } from '../../core/wait/wait-format';

declare const paypal: any;

@Component({
	selector: 'app-deposit-modal',
	standalone: true,
	imports: [CommonModule, WsBasePipe, WsCurrencyPipe],
	templateUrl: './deposit-modal.html',
	styleUrl: './deposit-modal.css',
})
export class DepositModal implements AfterViewInit, OnDestroy {
	private paypalDepositService = inject(PaypalDepositService);
	private authStore = inject(AuthStore);
	private levels = inject(LevelsService);
	/** The server's wait after a 429 on creating the PayPal order (end timestamp, survives a refresh). Money-in: nothing is retried at zero; the PayPal button simply works again. */
	readonly orderWait = inject(WaitTimerService).track(waitScope('paypal-create-order', this.authStore.currentUser()?.id ?? ''));
	private readonly orderRateLimitedNoTime = signal(false);
	/** «طلبات كثيرة، يمكنك إعادة المحاولة بعد 1:23» (ticking) or the honest sentence without a number; '' when nothing waits. */
	readonly rateLimitText = computed(() => this.orderWait.active() ? rateLimitSentence(this.orderWait.remainingSeconds(), true) : this.orderRateLimitedNoTime() ? RATE_LIMIT_MESSAGE : '');
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
	readonly minAmount = DepositModal.MIN_AMOUNT;
	readonly maxAmount = DepositModal.MAX_AMOUNT;
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
		if (v === null) return `أدخل مبلغ الإيداع بـ${currencyLabel()}`;
		if (v < DepositModal.MIN_AMOUNT) return `الحد الأدنى للإيداع ${formatBase(DepositModal.MIN_AMOUNT)}`;
		if (v > DepositModal.MAX_AMOUNT) return `الحد الأقصى للإيداع ${formatBase(DepositModal.MAX_AMOUNT)}`;
		return '';
	});
	private creatingOrder = false;
	/** The approved order whose confirmation was answered 429 (kept so the user can confirm it again after the wait). */
	readonly pendingCaptureId = signal<string | null>(null);
	/** Server wait for the capture/confirm call (end timestamp, survives a refresh); guards ONLY the confirm button. */
	readonly captureWait = inject(WaitTimerService).track(waitScope('paypal-capture', this.authStore.currentUser()?.id ?? ''));
	private readonly captureRateLimitedNoTime = signal(false);
	readonly captureRateLimitText = computed(() => !this.pendingCaptureId() ? '' : this.captureWait.active() ? rateLimitSentence(this.captureWait.remainingSeconds(), true) : this.captureRateLimitedNoTime() ? RATE_LIMIT_MESSAGE : '');
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
					// while the server's wait runs no request is made at all
					if (this.orderWait.active()) return Promise.reject(new Error('rate limited'));
					this.orderRateLimitedNoTime.set(false);
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
								// 429: a wait from the server (Retry-After / retryAt); the amount and the terms stay, no generic error is added.
								if (isRateLimitError(error)) {
									const end = this.orderWait.startFromResponse(error);
									this.orderRateLimitedNoTime.set(end == null || !this.orderWait.active());
									reject(new Error('rate limited'));
									return;
								}
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
					return new Promise<void>((resolve) => { this.capture(data.orderID, resolve); });
				},
				onError: () => {
					this.paymentError.set('فشلت عملية الدفع لدى PayPal. لم تتم إضافة أي رصيد.');
					this.paymentStatus.set('error');
				}
			})
			.render(`#${this.paypalElementId}`);
	}

	/**
	 * Confirms the approved PayPal order on the server. Money-in: a 429 is a WAIT, never an automatic retry: the order id is kept and the user presses the
	 * guarded button («إعادة محاولة تأكيد الدفع») after the server's time. The server decides whether it was already captured.
	 */
	private capture(orderId: string, done: () => void = () => undefined) {
		this.paymentStatus.set('processing');
		this.paymentError.set('');
		this.captureRateLimitedNoTime.set(false);
		this.paypalDepositService.captureOrder(orderId).subscribe({
			next: (response) => {
				if (!response?.success) {
					this.paymentError.set('تعذر التحقق النهائي من الدفع. لم تتم إضافة أي رصيد.');
					this.paymentStatus.set('error');
					done();
					return;
				}
				this.pendingCaptureId.set(null);
				this.paymentReference.set(orderId);
				this.paymentStatus.set('success');
				this.deposited.emit({ amount: this.amount() ?? 0, reference: orderId, method: 'paypal' });
				done();
			},
			error: (error) => {
				if (isRateLimitError(error)) {
					this.pendingCaptureId.set(orderId);
					const end = startWaitFromError(this.captureWait, error);
					this.captureRateLimitedNoTime.set(end == null || !this.captureWait.active());
					this.paymentStatus.set('error');
				} else {
					this.paymentError.set(mapHttpError(error, { fallback: 'رفض الخادم التحقق من عملية PayPal. لم تتم إضافة أي رصيد.' }).message);
					this.paymentStatus.set('error');
				}
				done();
			}
		});
	}

	/** User-pressed only; disabled while the server's wait runs. */
	retryCapture() {
		const id = this.pendingCaptureId();
		if (!id || this.captureWait.active() || this.paymentStatus() === 'processing') return;
		this.capture(id);
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
