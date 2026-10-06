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
	specialty = signal<string>('غير محدد');
	duration = signal<string>('0 يوما');

	// Math and Pricing
	basePrice = signal<number>(0);
	systemFee = signal<number>(0); // 7%
	clientFee = signal<number>(0); // 1%
	transferFee = signal<number>(0); // 5%
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
	otpCountdown = signal<number>(30);
	otpTimer: any;

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
		this.http.get<any>(`${environment.url_api}/client/my-requests/${reqId}`).subscribe({
			next: (res) => {
				if (res && res.success && res.data) {
					const data = res.data;
					this.requestTitle.set(data.title || 'مشروع بدون عنوان');
					this.specialty.set(data.category || data.specialty || 'غير محدد');

					let targetOffer = null;
					if (offerId && data.proposals && data.proposals.length > 0) {
						targetOffer = data.proposals.find((p: any) => p.id === offerId);
					}
					if (!targetOffer) {
						this.isLoading.set(false);
						this.hasError.set(true);
						return;
					}

					// We already set email from query params, but fallback to client data if present
					if (data.client && data.client.email && !this.route.snapshot.queryParamMap.get('email')) {
						this.clientEmail.set(this.maskEmail(data.client.email));
					}

					if (targetOffer) {
						this.duration.set(targetOffer.deliveryDays ? `${targetOffer.deliveryDays} أيام` : (targetOffer.durationText || 'غير محدد'));

						// Calculate pricing
						const priceNum = targetOffer.totalPrice || targetOffer.bidAmount || 0;
						this.basePrice.set(priceNum);
						this.systemFee.set(priceNum * 0.07);
						this.clientFee.set(priceNum * 0.01);
						this.transferFee.set(priceNum * 0.05);
						this.totalAmount.set(priceNum + this.systemFee() + this.clientFee() + this.transferFee());
					}
				}
				this.loadWalletBalance();
			},
			error: (err) => {
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
	openOTP() {
		if (!this.termsAccepted() || !this.hasSufficientBalance() || this.isSubmitting()) return;
		this.isSubmitting.set(true);
		this.showOtpModal.set(true);
		this.startOTPTimer();
		
		// Send the OTP when modal opens
		this.http.post<any>(`${environment.url_api}/client/my-requests/${this.requestId()}/contract/sign`, {
			offerId: this.offerId()
		}).subscribe({
			next: () => {
				this.isSubmitting.set(false);
			},
			error: (err) => {
				this.isSubmitting.set(false);
				this.closeOTP();
				this.formError.set(err.error?.message || 'تعذر إرسال رمز التوقيع. حاول مرة أخرى.');
			}
		});
	}

	closeOTP() {
		this.showOtpModal.set(false);
		clearInterval(this.otpTimer);
	}

	startOTPTimer() {
		this.otpCountdown.set(30);
		clearInterval(this.otpTimer);
		this.otpTimer = setInterval(() => {
			if (this.otpCountdown() > 0) {
				this.otpCountdown.update(v => v - 1);
			} else {
				clearInterval(this.otpTimer);
			}
		}, 1000);
	}

	resetOTP() {
		this.otpValues.set(['', '', '', '', '', '']);
		this.startOTPTimer();

		// Resend OTP logic
		this.http.post<any>(`${environment.url_api}/client/my-requests/${this.requestId()}/contract/sign`, {
			offerId: this.offerId()
		}).subscribe({
			next: (res) => {
				// show success toast or silently succeed
			},
			error: (err) => {
				console.error('Error resending OTP', err);
			}
		});
	}

	onOtpInput(index: number, event: any) {
		const val = event.target.value;
		
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
			alert('الرجاء إدخال رمز التحقق المكون من 6 أرقام بالكامل.');
			return;
		}

		if (this.isSubmitting()) return;
		this.isSubmitting.set(true);
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
					alert(res.message || 'كود التحقق غير صحيح');
					this.otpValues.set(['', '', '', '', '', '']); // reset visually
				}
			},
			error: (err) => {
				this.isSubmitting.set(false);
				if (err.status === 402) {
					this.closeOTP();
					this.formError.set('تغير رصيد المحفظة ولم يعد كافياً. اشحن الرصيد ثم أعد المحاولة.');
					this.loadWalletBalance();
					return;
				}
				alert(err.error?.message || 'كود التحقق غير صحيح أو منتهي الصلاحية');
				this.otpValues.set(['', '', '', '', '', '']); // reset visually
			}
		});
	}
}
