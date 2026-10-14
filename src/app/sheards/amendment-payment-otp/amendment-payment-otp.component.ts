import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AmendmentActionsService, AmendmentInsufficientBalance, insufficientBalanceOf } from '../../core/services/amendment-actions.service';
import { AMENDMENT_DEPOSIT_ROUTE } from '../../core/constants/amendment-effect';

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
		<button type="button" class="apo-btn apo-pri" data-testid="amendment-otp-send" [disabled]="busy()" (click)="send()">{{ sending() ? 'جارٍ الإرسال...' : 'إرسال رمز التحقق' }}</button>
	} @else {
		<div class="apo-sent" data-testid="amendment-otp-sent">أُرسل الرمز إلى {{ maskedEmail() }} <span data-testid="amendment-otp-timer">@if (secondsLeft() > 0) { · ينتهي خلال {{ timerText() }} } @else { · انتهت صلاحية الرمز }</span></div>
		<input class="apo-in" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr" placeholder="000000" aria-label="رمز التحقق" data-testid="amendment-otp-input"
			[value]="code()" (input)="onCode($any($event.target).value)" [disabled]="submitting()">
		<div class="apo-row">
			<button type="button" class="apo-btn apo-pri" data-testid="amendment-otp-confirm" [disabled]="!canConfirm()" (click)="confirm()">{{ submitting() ? 'جارٍ التأكيد...' : (mode() === 'respond' ? 'تأكيد الدفع والموافقة' : 'اعتماد الدفع') }}</button>
			<button type="button" class="apo-btn apo-gh" data-testid="amendment-otp-resend" [disabled]="busy() || submitting()" (click)="send()">إعادة إرسال الرمز</button>
		</div>
	}
	@if (insufficient(); as short) {
		<div class="apo-err" role="alert" data-testid="amendment-otp-insufficient">رصيد المحفظة غير كافٍ: المطلوب {{ short.required }} $ والمتاح {{ short.available }} $ (الناقص {{ short.shortfall }} $). <a [routerLink]="depositRoute" data-testid="amendment-otp-deposit">شحن المحفظة</a></div>
	} @else if (error()) {
		<div class="apo-err" role="alert" data-testid="amendment-otp-error">{{ error() }}</div>
	}
	<button type="button" class="apo-btn apo-gh" data-testid="amendment-otp-cancel" [disabled]="submitting()" (click)="closed.emit()">رجوع</button>
</div>`,
	styles: [`
		.apo { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
		.apo-txt { margin: 0; font-size: 13px; line-height: 1.7; color: var(--txt-2, inherit); }
		.apo-sent { font-size: 12px; color: var(--txt-2, inherit); }
		.apo-in { width: 100%; max-width: 220px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border, #444); background: transparent; color: inherit; font-size: 18px; letter-spacing: 6px; text-align: center; }
		.apo-row { display: flex; gap: 8px; flex-wrap: wrap; }
		.apo-btn { padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border, #444); background: transparent; color: inherit; cursor: pointer; font: inherit; }
		.apo-pri { background: var(--blue, #2563eb); border-color: var(--blue, #2563eb); color: #fff; }
		.apo-btn:disabled { opacity: .5; cursor: not-allowed; }
		.apo-err { font-size: 12.5px; color: var(--red, #dc2626); }
		.apo-err a { color: inherit; text-decoration: underline; font-weight: 600; }
	`]
})
export class AmendmentPaymentOtpComponent {
	private api = inject(AmendmentActionsService);
	private destroyRef = inject(DestroyRef);

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
	secondsLeft = signal(0);
	code = signal('');
	error = signal('');
	insufficient = signal<AmendmentInsufficientBalance | null>(null);
	busy = computed(() => this.sending() || this.submitting());
	canConfirm = computed(() => /^\d{6}$/.test(this.code()) && !this.busy() && this.secondsLeft() > 0);
	timerText = computed(() => `${Math.floor(this.secondsLeft() / 60)}:${String(this.secondsLeft() % 60).padStart(2, '0')}`);
	private timer: ReturnType<typeof setInterval> | null = null;

	constructor() { this.destroyRef.onDestroy(() => this.stopTimer()); }

	onCode(value: string) { this.code.set((value || '').replace(/\D/g, '').slice(0, 6)); }

	send() {
		if (this.busy()) return;
		this.sending.set(true); this.error.set(''); this.insufficient.set(null);
		this.api.initPaymentOtp(this.amendmentId()).subscribe({
			next: res => {
				this.sending.set(false);
				this.sent.set(true); this.code.set('');
				this.maskedEmail.set(res?.data?.otpSentTo || '');
				this.startTimer(res?.data?.expiresAt);
			},
			error: err => {
				this.sending.set(false);
				this.insufficient.set(insufficientBalanceOf(err));
				this.error.set(err?.error?.message || 'تعذر إرسال رمز التحقق');
			}
		});
	}

	confirm() {
		if (!this.canConfirm()) return;
		this.submitting.set(true); this.error.set(''); this.insufficient.set(null);
		const call = this.mode() === 'respond' ? this.api.clientRespond(this.amendmentId(), 'approve', this.code()) : this.api.authorizeFunding(this.amendmentId(), this.code());
		call.subscribe({
			next: res => { this.submitting.set(false); this.stopTimer(); this.done.emit(res?.data ?? res); },
			error: err => {
				this.submitting.set(false);
				this.insufficient.set(insufficientBalanceOf(err));
				this.error.set(err?.error?.message || 'تعذر إتمام العملية');
			}
		});
	}

	private startTimer(expiresAt?: string) {
		this.stopTimer();
		const end = expiresAt ? new Date(expiresAt).getTime() : Date.now() + 120000;
		const tick = () => this.secondsLeft.set(Math.max(0, Math.round((end - Date.now()) / 1000)));
		tick();
		this.timer = setInterval(() => { tick(); if (this.secondsLeft() === 0) this.stopTimer(); }, 1000);
	}
	private stopTimer() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
}
