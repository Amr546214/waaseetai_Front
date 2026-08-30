import { AfterViewInit, Component, EventEmitter, OnDestroy, Output, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClientFinanceService } from '../../core/services/client-finance.service';

declare const Moyasar: any;

@Component({
	selector: 'app-deposit-modal',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './deposit-modal.html',
	styleUrl: './deposit-modal.css',
})
export class DepositModal implements AfterViewInit, OnDestroy {
	private clientFinanceService = inject(ClientFinanceService);
	private sdkPoll?: ReturnType<typeof setInterval>;
	private reinitTimer?: ReturnType<typeof setTimeout>;
	private initSequence = 0;
	private destroyed = false;
	private moyasarContainer?: HTMLElement;
	private readonly guardMoyasarConfirmation = (event: Event) => {
		const isSubmit = event.type === 'submit';
		const isSubmitClick = event.type === 'click' && event.target instanceof Element &&
			Boolean(event.target.closest('button[type="submit"], input[type="submit"], .mysr-btn-primary'));
		if ((!isSubmit && !isSubmitClick) || this.termsAccepted()) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		this.paymentError.set('وافق على شروط الإيداع قبل تأكيد عملية الدفع.');
	};

	@Output() close = new EventEmitter<void>();
	@Output() deposited = new EventEmitter<{ amount: number; reference: string; method: string }>();

	currentBalance = input<number>(0);
	initialAmount = input<number | null>(null);
	lockAmount = input(false);

	amount = signal(1000);
	selectedMethod = signal<'card'>('card');
	termsAccepted = signal(false);
	paymentStatus = signal<'idle' | 'processing' | 'success' | 'error'>('idle');
	paymentError = signal('');
	paymentReference = signal('');
	isMoyasarLoaded = signal(false);
	readonly formElementId = `mysr-wallet-${crypto.randomUUID()}`;
	readonly quickAmounts = [500, 1000, 2500, 5000];

	ngAfterViewInit() {
		const requestedAmount = this.initialAmount();
		if (requestedAmount !== null && Number.isFinite(requestedAmount)) {
			this.amount.set(this.normaliseAmount(requestedAmount));
		}
		this.moyasarContainer = document.getElementById(this.formElementId) || undefined;
		this.moyasarContainer?.addEventListener('click', this.guardMoyasarConfirmation, true);
		this.moyasarContainer?.addEventListener('submit', this.guardMoyasarConfirmation, true);
		this.waitForMoyasar();
	}

	ngOnDestroy() {
		this.destroyed = true;
		this.initSequence += 1;
		if (this.sdkPoll) clearInterval(this.sdkPoll);
		if (this.reinitTimer) clearTimeout(this.reinitTimer);
		this.moyasarContainer?.removeEventListener('click', this.guardMoyasarConfirmation, true);
		this.moyasarContainer?.removeEventListener('submit', this.guardMoyasarConfirmation, true);
	}

	private waitForMoyasar() {
		if (typeof Moyasar !== 'undefined') {
			this.isMoyasarLoaded.set(true);
			this.scheduleMoyasarInit(0);
			return;
		}

		let attempts = 0;
		this.sdkPoll = setInterval(() => {
			attempts += 1;
			if (typeof Moyasar !== 'undefined') {
				clearInterval(this.sdkPoll);
				this.isMoyasarLoaded.set(true);
				this.scheduleMoyasarInit(0);
			} else if (attempts >= 25) {
				clearInterval(this.sdkPoll);
				this.paymentError.set('تعذر تحميل بوابة ميسر الآمنة. تحقق من الاتصال ثم أعد المحاولة.');
				this.paymentStatus.set('error');
			}
		}, 200);
	}

	private scheduleMoyasarInit(delay = 250) {
		if (this.destroyed || !this.isMoyasarLoaded() || this.selectedMethod() !== 'card') return;
		if (this.reinitTimer) clearTimeout(this.reinitTimer);
		this.reinitTimer = setTimeout(() => this.initMoyasarWebForm(), delay);
	}

	private initMoyasarWebForm() {
		const amount = this.amount();
		if (this.destroyed || typeof Moyasar === 'undefined' || amount < 50 || amount > 100000) return;
		const container = document.getElementById(this.formElementId);
		if (!container?.isConnected) return;

		const sequence = ++this.initSequence;
		this.paymentError.set('');
		container.replaceChildren();

		this.clientFinanceService.initiateDeposit(amount, 'card').subscribe({
			next: (response) => {
				if (this.destroyed || sequence !== this.initSequence || !response?.success || !response.data?.publishableKey) return;
				const liveContainer = document.getElementById(this.formElementId);
				if (!liveContainer?.isConnected) return;
				const session = response.data;
				try {
					const initialisation = Moyasar.init({
						element: liveContainer,
						amount: Math.round(amount * 100),
						currency: 'SAR',
						description: `إيداع في محفظة وسيط AI بمبلغ ${amount} ر.س`,
						publishable_api_key: session.publishableKey,
						callback_url: window.location.href,
						metadata: session.metadata,
						supported_networks: ['visa', 'mastercard', 'mada'],
						methods: ['creditcard'],
						language: 'ar',
						on_completed: (payment: any) => this.verifyCompletedPayment(payment),
						on_failure: () => {
							this.paymentError.set('فشلت عملية الدفع لدى ميسر. لم تتم إضافة أي رصيد.');
							this.paymentStatus.set('error');
						}
					});
					if (initialisation && typeof initialisation.catch === 'function') {
						initialisation.catch(() => this.handleMoyasarInitFailure(sequence));
					}
				} catch {
					this.handleMoyasarInitFailure(sequence);
				}
			},
			error: (error) => {
				if (sequence !== this.initSequence) return;
				this.paymentError.set(error.error?.message || 'تعذر بدء جلسة الدفع الآمنة مع ميسر.');
				this.paymentStatus.set('error');
			}
		});
	}

	private handleMoyasarInitFailure(sequence: number) {
		if (this.destroyed || sequence !== this.initSequence) return;
		this.paymentError.set('تعذر تهيئة نموذج ميسر الآمن. أعد المحاولة.');
		this.paymentStatus.set('error');
	}

	private verifyCompletedPayment(payment: any) {
		if (!payment?.id) {
			this.paymentError.set('لم ترجع ميسر معرّف دفع صالحاً. لم تتم إضافة أي رصيد.');
			this.paymentStatus.set('error');
			return;
		}

		const amount = this.amount();
		this.paymentStatus.set('processing');
		this.clientFinanceService.verifyDeposit({ paymentId: payment.id, amount }).subscribe({
			next: (response) => {
				if (!response?.success) {
					this.paymentError.set('تعذر التحقق النهائي من الدفع. لم تتم إضافة أي رصيد.');
					this.paymentStatus.set('error');
					return;
				}
				this.paymentReference.set(payment.id);
				this.paymentStatus.set('success');
				this.deposited.emit({ amount, reference: payment.id, method: 'moyasar' });
			},
			error: (error) => {
				this.paymentError.set(error.error?.message || 'رفض الخادم التحقق من عملية ميسر. لم تتم إضافة أي رصيد.');
				this.paymentStatus.set('error');
			}
		});
	}

	get balanceAfter() {
		return this.currentBalance() + this.amount();
	}

	canSubmit = computed(() => this.amount() >= 50 && this.amount() <= 100000 && this.termsAccepted());

	setAmount(value: number) {
		if (this.lockAmount()) return;
		this.amount.set(this.normaliseAmount(value));
		this.scheduleMoyasarInit();
	}

	onAmountInput(event: Event) {
		if (this.lockAmount()) return;
		const value = Number((event.target as HTMLInputElement).value.replace(/,/g, ''));
		if (Number.isFinite(value)) {
			this.amount.set(this.normaliseAmount(value));
			this.scheduleMoyasarInit();
		}
	}

	private normaliseAmount(value: number) {
		return Math.min(100000, Math.max(50, Math.ceil(value * 100) / 100));
	}

	selectMethod() {}
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
