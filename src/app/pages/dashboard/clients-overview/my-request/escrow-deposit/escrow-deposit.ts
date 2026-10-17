import { Component, signal, computed, inject, OnInit, ViewEncapsulation, ElementRef, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ThemeService } from '../../../../../core/services/theme.service';
import { environment } from '../../../../../../environments/environment';
import { ClientFinanceService } from '../../../../../core/services/client-finance.service';
import { DepositModal } from '../../../../../sheards/deposit-modal/deposit-modal';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { mapHttpError } from '../../../../../core/forms/http-error';
import { scrollFocus } from '../../../../../shared/forms/form-error-focus';
import { reportClientProblems } from '../../client-form-report';
import { WaitHandle, WaitTimerService, waitScope } from '../../../../../core/wait/wait-timer.service';
import { isRateLimitError, RATE_LIMIT_MESSAGE } from '../../../../../core/utils/rate-limit.util';
import { rateLimitSentence } from '../../../../../core/wait/wait-format';
import { formatClock } from '../../../../../core/wait/wait-format';

@Component({
	selector: 'app-escrow-deposit',
	standalone: true,
	imports: [CommonModule, RouterModule, DepositModal],
	templateUrl: './escrow-deposit.html',
	styleUrl: './escrow-deposit.css',
	encapsulation: ViewEncapsulation.None
})
export class EscrowDeposit implements OnInit {
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private http = inject(HttpClient);
	private clientFinanceService = inject(ClientFinanceService);
	public themeService = inject(ThemeService);
	private authStore = inject(AuthStore);
	private host = inject<ElementRef<HTMLElement>>(ElementRef);
	private waits = inject(WaitTimerService);
	private destroyRef = inject(DestroyRef);
	// Three different timers, all from the server: the code VALIDITY (expiresAt / expiresInSeconds of the signing OTP), the SEND wait (429 on contract/sign)
	// and the CONFIRM wait (429 on escrow/deposit). Money-in: nothing is ever retried at zero. Created in ngOnInit (they are keyed by the request + offer).
	validityWait!: WaitHandle;
	sendWait!: WaitHandle;
	confirmWait!: WaitHandle;
	private expiryKnown = signal(false);
	private rateLimitedNoTime = signal(false);
	otpExpired = computed(() => this.expiryKnown() && !this.validityWait?.active());
	rateLimitText = computed(() => {
		const w = this.confirmWait?.active() ? this.confirmWait : this.sendWait?.active() ? this.sendWait : null;
		return w ? rateLimitSentence(w.remainingSeconds(), true) : this.rateLimitedNoTime() ? RATE_LIMIT_MESSAGE : null;
	});
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
	/** Seconds left on the e-mailed code; from the server's real validity (expiresAt), never a guessed timer. */
	otpCountdown = computed(() => (this.validityWait ? this.validityWait.remainingSeconds() : 0));
	/** Wrong / expired code (and resend problems) are shown inside the code dialog, never in a browser alert. */
	otpError = signal('');
	otpNotice = signal('');
	isResending = signal(false);

	otpValues = signal<string[]>(['', '', '', '', '', '']);
	showSuccessOverlay = signal<boolean>(false);

	ngOnInit() {
		const id = this.route.snapshot.paramMap.get('id');
		const offerId = this.route.snapshot.queryParamMap.get('offerId');
		const key = `${id ?? ''}:${offerId ?? ''}`;
		this.validityWait = this.waits.track(waitScope('contract-otp-valid', key), this.destroyRef);
		this.sendWait = this.waits.track(waitScope('contract-otp-send', key), this.destroyRef);
		this.confirmWait = this.waits.track(waitScope('contract-otp-confirm', key), this.destroyRef);
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

	/** Space on the focused checkbox row toggles it (and must not scroll the page). */
	toggleTermsKey(e: Event) {
		e.preventDefault();
		this.toggleTerms();
	}

	// Format helpers
	formatCurrency(val: number): string {
		return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
	}

	handlePrimaryAction() {
		this.formError.set('');
		if (this.isSubmitting()) return;
		if (!this.termsAccepted()) {
			// The button stays clickable so the user is told WHY nothing happens: the message sits under the terms row, which gets focus.
			void reportClientProblems(this.host.nativeElement, [{ field: 'ed-terms', message: 'وافق على شروط حساب الضمان للمتابعة' }]);
			return;
		}
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
		if (this.sendWait.active()) return onFail(rateLimitSentence(this.sendWait.remainingSeconds(), true));
		this.http.post<any>(`${environment.url_api}/client/my-requests/${this.requestId()}/contract/sign`, {
			offerId: this.offerId()
		}).subscribe({
			next: (res) => onSent(res),
			error: (err) => {
				// 429: a wait from the server (Retry-After / retryAt); no stated time = an honest sentence with no number.
				if (isRateLimitError(err)) {
					const end = this.sendWait.startFromResponse(err);
					this.rateLimitedNoTime.set(end == null || !this.sendWait.active());
					return onFail(end != null && this.sendWait.active() ? rateLimitSentence(this.sendWait.remainingSeconds(), true) : RATE_LIMIT_MESSAGE);
				}
				onFail(err.error?.message || 'تعذر إرسال رمز التوقيع. حاول مرة أخرى.');
			}
		});
	}

	private applyOtpSent(res: any) {
		const email = res?.data?.email;
		if (email) this.clientEmail.set(this.maskEmail(email));
		this.startOTPTimer(res?.data);
	}

	// Sends the code first; the dialog opens only once the e-mail was really sent.
	openOTP() {
		if (!this.termsAccepted() || !this.hasSufficientBalance() || this.isSubmitting() || this.sendWait.active()) return;
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
		this.validityWait.clear();
		this.expiryKnown.set(false);
	}

	/** Validity of the code just sent: the server's `expiresAt`, else its `expiresInSeconds`; neither = no timer and no guessed duration. */
	startOTPTimer(data?: { expiresAt?: string; expiresInSeconds?: number }) {
		const end = data?.expiresAt ? Date.parse(data.expiresAt) : NaN;
		const ttl = Number(data?.expiresInSeconds);
		if (Number.isFinite(end)) { this.expiryKnown.set(true); this.validityWait.start(end); }
		else if (ttl > 0) { this.expiryKnown.set(true); this.validityWait.startIn(ttl); }
		else { this.expiryKnown.set(false); this.validityWait.clear(); }
	}

	otpCountdownText(): string {
		return formatClock(this.otpCountdown());
	}

	resetOTP() {
		if (this.isResending() || this.isSubmitting() || this.sendWait.active()) return;
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
			// Focus goes to the first empty box (below the header), the message is announced through aria-describedby.
			const firstEmpty = this.otpValues().findIndex(v => v.length !== 1);
			const box = document.getElementById(`otp${firstEmpty < 0 ? 0 : firstEmpty}`);
			if (box) scrollFocus(box);
			return;
		}
		if (this.isSubmitting() || this.confirmWait.active()) return;
		if (this.otpExpired()) {
			this.otpError.set('انتهت صلاحية الرمز. اضغط «إعادة الإرسال» للحصول على رمز جديد.');
			return;
		}

		this.isSubmitting.set(true);
		this.otpError.set(''); this.otpNotice.set(''); this.rateLimitedNoTime.set(false);
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
				// A 429 is a wait, never "wrong code": the digits stay and only confirm waits (the server's time; nothing is retried at zero).
				if (isRateLimitError(err)) {
					const end = this.confirmWait.startFromResponse(err);
					this.rateLimitedNoTime.set(end == null || !this.confirmWait.active());
					this.otpError.set('');
					return;
				}
				// Only a rejected code (400/422/401) says "wrong code"; network, 429 and 5xx stay honest generic messages and keep the digits.
				const mapped = mapHttpError(err, { unauthorizedIs: 'credentials', fallback: 'كود التحقق غير صحيح أو منتهي الصلاحية' });
				const rejected = mapped.kind === 'backend-validation' || mapped.kind === 'credentials';
				this.otpError.set(rejected ? (err.error?.message || 'كود التحقق غير صحيح أو منتهي الصلاحية') : mapped.message);
				if (rejected) this.otpValues.set(['', '', '', '', '', '']);
			}
		});
	}
}
