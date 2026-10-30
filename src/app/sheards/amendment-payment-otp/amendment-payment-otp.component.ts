import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AmendmentActionsService, AmendmentInsufficientBalance, insufficientBalanceOf } from '../../core/services/amendment-actions.service';
import { scrollFocus } from '../../shared/forms/form-error-focus';
import { AMENDMENT_DEPOSIT_ROUTE } from '../../core/constants/amendment-effect';
import { WaitHandle, WaitTimerService, waitScope } from '../../core/wait/wait-timer.service';
import { isRateLimitError, RATE_LIMIT_MESSAGE } from '../../core/utils/rate-limit.util';
import { rateLimitSentence } from '../../core/wait/wait-format';

/**
 * The client's payment authorization for a contract BUDGET INCREASE: an e-mail code (2 minutes) bound to ONE amendment and ONE amount.
 *  - mode 'respond'   : the client approves a PROVIDER request; the code travels with the approval and the wallet is charged by that same call.
 *  - mode 'authorize' : the client raised the increase; the code stores the authorization only, nothing is charged until the provider approves.
 * `done` is emitted ONLY after the API succeeded (no optimistic success); every failure keeps the step open with a real message, a wallet shortfall
 * shows the deposit link.
 */
@Component({
	selector: 'app-amendment-payment-otp',
	standalone: true,
	imports: [RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
<div class="apo" dir="rtl" data-testid="amendment-otp">
	<p class="apo-txt" data-testid="amendment-otp-intro">
		@if (mode() === 'respond') { لاعتماد دفع <b>{{ amount() }} $</b> من محفظتك لهذا التعديل نرسل رمز تحقق إلى بريدك. الرمز صالح دقيقتين ومرتبط بهذا الطلب وهذا المبلغ فقط. }
		@else { لاعتماد دفع <b>{{ amount() }} $</b> لطلبك نرسل رمز تحقق إلى بريدك. لا يُخصم شيء الآن؛ يُخصم المبلغ فقط عندما يوافق مقدم الخدمة. }
	</p>
	@if (!sent()) {
		<button type="button" class="apo-btn apo-pri" data-testid="amendment-otp-send" [disabled]="busy() || sendWait.active()" (click)="send()">{{ sending() ? 'جارٍ الإرسال...' : 'إرسال رمز التحقق' }}@if (sendWait.active()) { <span data-testid="amendment-otp-send-wait"> {{ sendWait.label() }}</span> }</button>
	} @else {
		<div class="apo-sent" data-testid="amendment-otp-sent">أُرسل الرمز إلى {{ maskedEmail() }} <span data-testid="amendment-otp-timer">@if (secondsLeft() > 0) { · ينتهي خلال {{ timerText() }} } @else if (expired()) { · انتهت صلاحية الرمز }</span></div>
		<input class="apo-in" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr" placeholder="000000" aria-label="رمز التحقق" data-testid="amendment-otp-input"
			id="amendment-otp-code" name="otpCode" [attr.aria-invalid]="codeError() || codeRejected() ? 'true' : null" [attr.aria-describedby]="codeError() ? 'amendment-otp-code-err' : (codeRejected() ? 'amendment-otp-err' : null)" [class.ws-invalid]="codeError() || codeRejected()"
			[value]="code()" (input)="onCode($any($event.target).value)" [disabled]="submitting()">
		@if (codeError()) { <div class="apo-err" id="amendment-otp-code-err" role="alert" data-testid="amendment-otp-code-error">{{ codeError() }}</div> }
		<div class="apo-row">
			<button type="button" class="apo-btn apo-pri" data-testid="amendment-otp-confirm" [disabled]="busy() || confirmWait.active()" (click)="confirm()">{{ submitting() ? 'جارٍ التأكيد...' : (mode() === 'respond' ? 'تأكيد الدفع والموافقة' : 'اعتماد الدفع') }}@if (confirmWait.active()) { <span data-testid="amendment-otp-confirm-wait"> {{ confirmWait.label() }}</span> }</button>
			<button type="button" class="apo-btn apo-gh" data-testid="amendment-otp-resend" [disabled]="busy() || submitting() || sendWait.active()" (click)="send()">إعادة إرسال الرمز@if (sendWait.active()) { <span data-testid="amendment-otp-resend-wait"> {{ sendWait.label() }}</span> }</button>
		</div>
	}
	@if (insufficient(); as short) {
		<div class="apo-err" role="alert" data-testid="amendment-otp-insufficient">رصيد المحفظة غير كافٍ: المطلوب {{ short.required }} $ والمتاح {{ short.available }} $ (الناقص {{ short.shortfall }} $). <a [routerLink]="depositRoute" data-testid="amendment-otp-deposit">شحن المحفظة</a></div>
	} @else if (rateLimitText()) {
		<div class="apo-err" id="amendment-otp-err" role="alert" data-testid="amendment-otp-rate-limit">{{ rateLimitText() }}</div>
	} @else if (error()) {
		<div class="apo-err" id="amendment-otp-err" role="alert" data-testid="amendment-otp-error">{{ error() }}</div>
	}
	<button type="button" class="apo-btn apo-gh" data-testid="amendment-otp-cancel" [disabled]="submitting()" (click)="closed.emit()">رجوع</button>
</div>`,
	styles: [`
		.apo { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
		.apo-txt { margin: 0; font-size: var(--font-size-label); line-height: 1.7; color: var(--txt-2, inherit); }
		.apo-sent { font-size: var(--font-size-small); color: var(--txt-2, inherit); }
		.apo-in { width: 100%; max-width: 220px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border, #444); background: transparent; color: inherit; font-size: var(--font-size-section); letter-spacing: 6px; text-align: center; }
		.apo-row { display: flex; gap: 8px; flex-wrap: wrap; }
		.apo-btn { padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border, #444); background: transparent; color: inherit; cursor: pointer; font: inherit; }
		.apo-pri { background: var(--blue, #2563eb); border-color: var(--blue, #2563eb); color: #fff; }
		.apo-btn:disabled { opacity: .5; cursor: not-allowed; }
		.apo-err { font-size: var(--font-size-label); color: var(--red, #dc2626); }
		.apo-err a { color: inherit; text-decoration: underline; font-weight: 600; }
	`]
})
export class AmendmentPaymentOtpComponent implements OnInit {
	private api = inject(AmendmentActionsService);
	private destroyRef = inject(DestroyRef);
	private waits = inject(WaitTimerService);

	amendmentId = input.required<string>();
	mode = input<'respond' | 'authorize'>('respond');
	amount = input<number>(0);
	done = output<any>();
	closed = output<void>();

	readonly depositRoute = AMENDMENT_DEPOSIT_ROUTE;
	sending = signal(false);
	submitting = signal(false);
	sent = signal(false);
	maskedEmail = signal('');
	/**
	 * Three different timers, each from the server: the code VALIDITY (expiresAt of the OTP), the SEND wait and the CONFIRM wait (both only from a 429 with a stated time).
	 * End timestamps live in WaitTimerService (re-synced when the tab returns); reaching zero never sends or confirms anything.
	 */
	validityWait!: WaitHandle;
	sendWait!: WaitHandle;
	confirmWait!: WaitHandle;
	private expiryKnown = signal(false);
	private rateLimitedNoTime = signal(false);
	secondsLeft = computed(() => (this.validityWait ? this.validityWait.remainingSeconds() : 0));
	expired = computed(() => this.expiryKnown() && this.secondsLeft() <= 0);
	rateLimitText = computed(() => {
		const w = this.confirmWait?.active() ? this.confirmWait : this.sendWait?.active() ? this.sendWait : null;
		return w ? rateLimitSentence(w.remainingSeconds(), true) : this.rateLimitedNoTime() ? RATE_LIMIT_MESSAGE : null;
	});
	code = signal('');
	error = signal('');
	/** Under the code box: shown when confirm is pressed with a short / expired code (the button is never silently dead). */
	codeError = signal('');
	/** The server rejected the code itself (400/422): the box is marked too, the server text stays in the banner. */
	codeRejected = signal(false);
	insufficient = signal<AmendmentInsufficientBalance | null>(null);
	busy = computed(() => this.sending() || this.submitting());
	canConfirm = computed(() => /^\d{6}$/.test(this.code()) && !this.busy() && !this.expired() && !this.confirmWait?.active());
	timerText = computed(() => `${Math.floor(this.secondsLeft() / 60)}:${String(this.secondsLeft() % 60).padStart(2, '0')}`);

	ngOnInit() {
		const id = this.amendmentId();
		this.validityWait = this.waits.track(waitScope('amendment-otp-valid', id), this.destroyRef);
		this.sendWait = this.waits.track(waitScope('amendment-otp-send', id), this.destroyRef);
		this.confirmWait = this.waits.track(waitScope('amendment-otp-confirm', id), this.destroyRef);
	}

	onCode(value: string) { this.code.set((value || '').replace(/\D/g, '').slice(0, 6)); this.codeError.set(''); this.codeRejected.set(false); }

	send() {
		if (this.busy() || this.sendWait.active()) return;
		this.sending.set(true); this.error.set(''); this.insufficient.set(null); this.rateLimitedNoTime.set(false);
		this.api.initPaymentOtp(this.amendmentId()).subscribe({
			next: res => {
				this.sending.set(false);
				// The backend says whether the mail server took the code: after a known failure nothing is "sent" and the user may ask again.
				if (res?.data?.emailSent === false) { this.error.set('تعذر إرسال رمز التحقق إلى بريدك الآن. حاول مرة أخرى بعد قليل.'); return; }
				this.sent.set(true); this.code.set('');
				this.maskedEmail.set(res?.data?.otpSentTo || '');
				this.startValidity(res?.data?.expiresAt);
			},
			error: err => {
				this.sending.set(false);
				this.insufficient.set(insufficientBalanceOf(err));
				if (isRateLimitError(err)) { this.applyRateLimit(this.sendWait, err); return; }
				this.error.set(err?.error?.message || 'تعذر إرسال رمز التحقق');
			}
		});
	}

	confirm() {
		if (this.busy() || this.confirmWait.active()) return;
		if (!/^\d{6}$/.test(this.code()) || this.expired()) {
			this.codeError.set(this.expired() ? 'انتهت صلاحية الرمز، أعد إرسال رمز جديد' : 'أدخل رمز التحقق المكوّن من 6 أرقام');
			const el = document.getElementById('amendment-otp-code');
			if (el) scrollFocus(el);
			return;
		}
		this.submitting.set(true); this.error.set(''); this.insufficient.set(null); this.codeRejected.set(false); this.rateLimitedNoTime.set(false);
		const call = this.mode() === 'respond' ? this.api.clientRespond(this.amendmentId(), 'approve', this.code()) : this.api.authorizeFunding(this.amendmentId(), this.code());
		call.subscribe({
			next: res => { this.submitting.set(false); this.validityWait.clear(); this.done.emit(res?.data ?? res); },
			error: err => {
				this.submitting.set(false);
				this.insufficient.set(insufficientBalanceOf(err));
				// A 429 is a wait (typed code and amendment kept), never "wrong code"; nothing is retried at zero.
				if (isRateLimitError(err)) { this.applyRateLimit(this.confirmWait, err); return; }
				this.codeRejected.set(err?.status === 400 || err?.status === 422);
				this.error.set(err?.error?.message || 'تعذر إتمام العملية');
			}
		});
	}

	/** Validity of the code just sent: the server's expiresAt; none given = no timer and no invented 2 minutes. */
	private startValidity(expiresAt?: string) {
		const end = expiresAt ? Date.parse(expiresAt) : NaN;
		this.expiryKnown.set(Number.isFinite(end));
		if (Number.isFinite(end)) this.validityWait.start(end); else this.validityWait.clear();
	}

	private applyRateLimit(handle: WaitHandle, err: unknown) {
		this.error.set('');
		const end = handle.startFromResponse(err);
		this.rateLimitedNoTime.set(end == null || !handle.active());
	}
}
