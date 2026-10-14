import { Component, signal, computed, inject, OnInit, ViewEncapsulation, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ThemeService } from '../../../../../core/services/theme.service';
import { environment } from '../../../../../../environments/environment';
import { ClientFinanceService } from '../../../../../core/services/client-finance.service';
import { DepositModal } from '../../../../../sheards/deposit-modal/deposit-modal';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

@Component({
	selector: 'app-escrow-deposit',
	standalone: true,
	imports: [CommonModule, RouterModule, DepositModal],
	templateUrl: './escrow-deposit.html',
	styleUrl: './escrow-deposit.css',
	encapsulation: ViewEncapsulation.None
})
export class EscrowDeposit implements OnInit, OnDestroy {
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private http = inject(HttpClient);
	private clientFinanceService = inject(ClientFinanceService);
	public themeService = inject(ThemeService);
	private authStore = inject(AuthStore);
	readonly isCompany = () => this.authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY;

	requestId = signal<string>('');
	offerId = signal<string | null>(null);
	isLoading = signal<boolean>(true);
	hasError = signal<boolean>(false);

	// Project details
	requestTitle = signal<string>('جارٍ التحميل...');
	duration = signal<string>('');
	/** Set when the contract cannot be funded now (not selected, already signed, other offer): shown instead of the payment form. */
	blockedReason = signal('');

	// Math and Pricing
	basePrice = signal<number>(0);
	totalAmount = signal<number>(0);
	walletBalance = signal(0);
	showWalletDeposit = signal(false);
	isSubmitting = signal(false);
	formError = signal('');
	shortfall = computed(() => Math.max(0, Math.round((this.totalAmount() - this.walletBalance()) * 100) / 100));
	hasSufficientBalance = computed(() => this.shortfall() === 0 && this.totalAmount() > 0);

	clientEmail = signal<string>('');

	// UI States
	termsAccepted = signal<boolean>(false);

	showOtpModal = signal<boolean>(false);
	/** Seconds left on the e-mailed code; starts from the server's real validity, never a guessed timer. */
	otpCountdown = signal<number>(0);
	otpTimer: any;
	/** Wrong / expired code (and resend problems) are shown inside the code dialog, never in a browser alert. */
	otpError = signal('');
	otpNotice = signal('');
	isResending = signal(false);
	private otpTtlSeconds = 600;

	otpValues = signal<string[]>(['', '', '', '', '', '']);
	showSuccessOverlay = signal<boolean>(false);

	ngOnInit() {
		const id = this.route.snapshot.paramMap.get('id');
		const offerId = this.route.snapshot.queryParamMap.get('offerId');
		const email = this.route.snapshot.queryParamMap.get('email');

		if (email) {
			this.clientEmail.set(this.maskEmail(email));
		}

		if (id) {
			this.requestId.set(id);
			if (offerId) {
				this.offerId.set(offerId);
			}
			this.fetchDetails(id, offerId);
		}
	}

	ngOnDestroy() {
		clearInterval(this.otpTimer);
	}

	fetchDetails(reqId: string, offerId: string | null) {
		this.isLoading.set(true);
		this.hasError.set(false);
		this.blockedReason.set('');
		const query = offerId ? `?offerId=${encodeURIComponent(offerId)}` : '';
		// The amount charged is the frozen contract's price (what the server debits), not the offers list.
		this.http.get<any>(`${environment.url_api}/client/my-requests/${reqId}/contract${query}`).subscribe({
			next: (res) => {
				const c = res && res.success ? res.data : null;
				if (!c) {
					this.isLoading.set(false);
					this.hasError.set(true);
					return;
				}
				this.requestTitle.set(c.title || 'مشروع بدون عنوان');
				if (c.state === 'no_contract' || !c.ready) {
					this.blockedReason.set(c.message || 'هذا العقد غير جاهز للتمويل حالياً.');
					this.isLoading.set(false);
					return;
				}
				this.otpTtlSeconds = Number(c.otpTtlSeconds) > 0 ? Number(c.otpTtlSeconds) : 600;
				this.duration.set(c.durationDays ? `${c.durationDays} يوم` : 'غير محدد');
				const priceNum = Number(c.price || 0);
				this.basePrice.set(priceNum);
				// fee policy v2: locking the escrow charges the contract value ONLY (no VAT / platform / insurance at lock); the provider's level commission is taken when each stage is released
				this.totalAmount.set(priceNum);
				this.loadWalletBalance();
			},
			error: (err) => {
				if (err?.status === 404) {
					this.blockedReason.set(err.error?.message || 'طلب المشروع غير موجود أو لا تملك صلاحية الوصول إليه.');
					this.isLoading.set(false);
					return;
				}
				console.error('Error fetching details:', err);
				this.isLoading.set(false);
				this.hasError.set(true);
			}
		});
	}

	private loadWalletBalance() {
		this.clientFinanceService.getWallet().subscribe({
			next: (response) => {
				this.walletBalance.set(Number(response.data?.summary?.availableBalance || 0));
				this.isLoading.set(false);
			},
			error: () => {
				this.isLoading.set(false);
				this.hasError.set(true);
			}
		});
	}

	maskEmail(email: string): string {
		if (!email || email.trim() === '') return 'بريدك الإلكتروني';
		const parts = email.split('@');
		if (parts.length !== 2) return email;
		const name = parts[0];
		const domain = parts[1];
		if (name.length <= 2) return `${name}***@${domain}`;
		return `${name.substring(0, 1)}***${name.substring(name.length - 1)}@${domain}`;
	}

	retryFetch() {
		this.fetchDetails(this.requestId(), this.offerId());
	}

	goBack() {
		this.router.navigate(['/client-overview/my-requests', this.requestId(), 'contract'], {
			queryParams: { offerId: this.offerId() }
		});
	}

	goDashboard() {
		this.router.navigate(['/client-overview/my-requests', this.requestId()]);
	}

	toggleTerms() {
		this.termsAccepted.set(!this.termsAccepted());
	}

	// Format helpers
	formatCurrency(val: number): string {
		return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
	}

	handlePrimaryAction() {
		this.formError.set('');
		if (!this.termsAccepted()) return;
		if (!this.hasSufficientBalance()) {
			this.showWalletDeposit.set(true);
			return;
		}
		this.openOTP();
	}

	onWalletDepositComplete() {
		this.showWalletDeposit.set(false);
		this.isLoading.set(true);
		this.loadWalletBalance();
	}

	// OTP Logic
	private requestOtp(onSent: (res: any) => void, onFail: (message: string) => void) {
		this.http.post<any>(`${environment.url_api}/client/my-requests/${this.requestId()}/contract/sign`, {
			offerId: this.offerId()
		}).subscribe({
			next: (res) => onSent(res),
			error: (err) => onFail(err.error?.message || 'تعذر إرسال رمز التوقيع. حاول مرة أخرى.')
		});
	}

	private applyOtpSent(res: any) {
		const email = res?.data?.email;
		if (email) this.clientEmail.set(this.maskEmail(email));
		const ttl = Number(res?.data?.expiresInSeconds);
		if (ttl > 0) this.otpTtlSeconds = ttl;
		this.startOTPTimer();
	}

	// Sends the code first; the dialog opens only once the e-mail was really sent.
	openOTP() {
		if (!this.termsAccepted() || !this.hasSufficientBalance() || this.isSubmitting()) return;
		this.isSubmitting.set(true);
		this.otpError.set(''); this.otpNotice.set('');
		this.requestOtp(
			(res) => {
				this.isSubmitting.set(false);
				this.otpValues.set(['', '', '', '', '', '']);
				this.showOtpModal.set(true);
				this.applyOtpSent(res);
			},
			(message) => {
				this.isSubmitting.set(false);
				this.formError.set(message);
			}
		);
	}

	closeOTP() {
		this.showOtpModal.set(false);
		clearInterval(this.otpTimer);
	}

	startOTPTimer() {
		this.otpCountdown.set(this.otpTtlSeconds);
		clearInterval(this.otpTimer);
		this.otpTimer = setInterval(() => {
			if (this.otpCountdown() > 0) {
				this.otpCountdown.update(v => v - 1);
			} else {
				clearInterval(this.otpTimer);
			}
		}, 1000);
	}

	otpCountdownText(): string {
		const total = Math.max(0, this.otpCountdown());
		return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
	}

	resetOTP() {
		if (this.isResending() || this.isSubmitting()) return;
		this.isResending.set(true);
		this.otpError.set(''); this.otpNotice.set('');
		this.requestOtp(
			(res) => {
				this.isResending.set(false);
				this.otpValues.set(['', '', '', '', '', '']);
				this.applyOtpSent(res);
				this.otpNotice.set('أُرسل رمز جديد إلى بريدك الإلكتروني.');
			},
			(message) => {
				this.isResending.set(false);
				this.otpError.set(message);
			}
		);
	}

	onOtpInput(index: number, event: any) {
		const val = event.target.value;
		if (this.otpError()) this.otpError.set('');
		
		if (val.length > 1) {
			// Handle paste directly into input
			const chars = val.replace(/[^0-9]/g, '').split('').slice(0, 6);
			const newVals = [...this.otpValues()];
			chars.forEach((c: string, i: number) => {
				if (index + i < 6) {
					newVals[index + i] = c;
					const input = document.getElementById(`otp${index + i}`) as HTMLInputElement;
					if (input) input.value = c;
				}
			});
			this.otpValues.set(newVals);
			
			const nextIdx = Math.min(index + chars.length, 5);
			const nextInput = document.getElementById(`otp${nextIdx}`) as HTMLInputElement;
			if (nextInput) nextInput.focus();
			
			this.checkOTPComplete();
			return;
		}

		const newVals = [...this.otpValues()];
		newVals[index] = val;
		this.otpValues.set(newVals);

		if (val.length === 1 && index < 5) {
			const nextInput = document.getElementById(`otp${index + 1}`) as HTMLInputElement;
			if (nextInput) nextInput.focus();
		}

		this.checkOTPComplete();
	}

	onOtpPaste(event: ClipboardEvent) {
		event.preventDefault();
		const pastedData = event.clipboardData?.getData('text');
		if (!pastedData) return;
		
		const chars = pastedData.trim().replace(/[^0-9]/g, '').split('').slice(0, 6);
		if (chars.length === 0) return;

		const newVals = [...this.otpValues()];
		chars.forEach((c, i) => {
			newVals[i] = c;
			const input = document.getElementById(`otp${i}`) as HTMLInputElement;
			if (input) input.value = c;
		});
		
		this.otpValues.set(newVals);
		
		const nextIdx = Math.min(chars.length, 5);
		const nextInput = document.getElementById(`otp${nextIdx}`) as HTMLInputElement;
		if (nextInput) nextInput.focus();
		
		this.checkOTPComplete();
	}

	onOtpKeydown(index: number, event: KeyboardEvent) {
		if (event.key === 'Backspace' && !this.otpValues()[index] && index > 0) {
			const prevInput = document.getElementById(`otp${index - 1}`) as HTMLInputElement;
			if (prevInput) {
				prevInput.focus();
				const newVals = [...this.otpValues()];
				newVals[index - 1] = '';
				this.otpValues.set(newVals);
			}
		}
	}

	checkOTPComplete() {
		if (this.otpValues().every(v => v.length === 1)) {
			setTimeout(() => this.confirmDeposit(), 200);
		}
	}

	confirmDeposit() {
		const otpCode = this.otpValues().join('');
		if (otpCode.length !== 6) {
			this.otpError.set('أدخل رمز التحقق المكوّن من 6 أرقام بالكامل.');
			return;
		}
		if (this.isSubmitting()) return;
		if (this.otpCountdown() <= 0) {
			this.otpError.set('انتهت صلاحية الرمز. اضغط «إعادة الإرسال» للحصول على رمز جديد.');
			return;
		}

		this.isSubmitting.set(true);
		this.otpError.set(''); this.otpNotice.set('');
		this.http.post<any>(`${environment.url_api}/client/my-requests/${this.requestId()}/escrow/deposit`, {
			offerId: this.offerId(),
			otpCode: otpCode,
			paymentMethod: 'wallet'
		}).subscribe({
			next: (res) => {
				this.isSubmitting.set(false);
				if (res && res.success) {
					this.closeOTP();
					this.showSuccessOverlay.set(true);
				} else {
					this.otpError.set(res?.message || 'كود التحقق غير صحيح');
					this.otpValues.set(['', '', '', '', '', '']);
				}
			},
			error: (err) => {
				this.isSubmitting.set(false);
				if (err.status === 402) {
					this.closeOTP();
					this.formError.set('تغير رصيد المحفظة ولم يعد كافياً. اشحن الرصيد ثم أعد المحاولة. لم يُخصم أي مبلغ.');
					this.loadWalletBalance();
					return;
				}
				if (err.status === 409) {
					// Already signed / funded (e.g. a double submit or another tab): nothing more was charged.
					this.closeOTP();
					this.blockedReason.set(err.error?.message || 'تم توقيع هذا العقد وتمويله مسبقاً.');
					return;
				}
				this.otpError.set(err.error?.message || 'كود التحقق غير صحيح أو منتهي الصلاحية');
				this.otpValues.set(['', '', '', '', '', '']);
			}
		});
	}
}
