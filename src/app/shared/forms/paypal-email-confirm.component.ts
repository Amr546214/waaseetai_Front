import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { ProviderProfileService } from '../../core/services/provider-profile.service';
import { mapHttpError } from '../../core/forms/http-error';
import { OtpInputComponent } from './otp-input.component';
import { AuthStore } from '../../core/store/auth.store';
import { WaitTimerService, waitScope } from '../../core/wait/wait-timer.service';
import { isRateLimitError } from '../../core/utils/rate-limit.util';

/**
 * Second step of adding / changing the PayPal payout email: the code was e-mailed to the ACCOUNT email (shown masked, so nobody thinks it went
 * to the PayPal address) and the new PayPal address is still pending. Confirming saves it at once (no manual review); PayPal withdrawals are
 * then frozen for 24 hours (said here, so nobody is surprised).
 */
@Component({
	selector: 'ws-paypal-email-confirm',
	standalone: true,
	imports: [OtpInputComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="paypal-confirm" data-testid="paypal-confirm" role="group" aria-label="تأكيد بريد PayPal"
			style="margin-top:14px;padding:16px;border:1px solid rgba(255,255,255,.12);border-radius:12px">
			<div style="font-weight:800;margin-bottom:8px;text-align:center" data-testid="paypal-confirm-title">تأكيد بريد PayPal</div>
			<p style="font-size:13px;margin-bottom:6px;text-align:center" data-testid="paypal-confirm-sent">
				أرسلنا رمزًا إلى بريد حسابك: <span dir="ltr" data-testid="paypal-account-email">{{ accountEmailHint() || 'بريد حسابك' }}</span>
			</p>
			<p style="font-size:12.5px;margin-bottom:4px;text-align:center;opacity:.85" data-testid="paypal-confirm-target">
				@if (mode() === 'add') { لتأكيد إضافة بريد PayPal } @else { لتأكيد تغيير بريد PayPal إلى }
				<span dir="ltr" data-testid="paypal-pending-email">{{ email() }}</span>
			</p>
			<p style="font-size:12.5px;margin-bottom:8px;text-align:center;opacity:.85" data-testid="paypal-confirm-freeze">بعد التأكيد، يتوقف السحب لمدة 24 ساعة لحماية الحساب.</p>
			<ws-otp-input idPrefix="pp-code" [(value)]="code" [invalid]="!!error()" describedBy="pp-code-err" [disabled]="busy()" (complete)="confirm()" />
			@if (error()) { <div id="pp-code-err" role="alert" data-testid="paypal-confirm-error" style="color:#f87171;font-size:13px;margin-top:2px;text-align:center">{{ error() }}</div> }
			@if (notice()) { <div role="status" data-testid="paypal-confirm-notice" style="font-size:13px;margin-top:2px;text-align:center">{{ notice() }}</div> }
			<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:12px">
				<button type="button" class="btn-primary" data-testid="paypal-confirm-btn" [disabled]="busy() || confirmWait.active()" (click)="confirm()">{{ busy() ? 'جارٍ التأكيد...' : 'تأكيد البريد' }} @if (confirmWait.active()) { <span data-testid="paypal-confirm-wait">{{ confirmWait.label() }}</span> }</button>
				<button type="button" class="btn-secondary pp-sec" data-testid="paypal-resend-btn" [disabled]="busy() || resendWait.active()" (click)="resend()">إعادة إرسال الرمز @if (resendWait.active()) { <span data-testid="paypal-resend-wait">{{ resendWait.label() }}</span> }</button>
				<button type="button" class="btn-secondary pp-sec" [disabled]="busy()" (click)="dismissed.emit()">إلغاء</button>
			</div>
		</div>
	`,
	styles: [`
		.pp-sec{background:none;border:1px solid rgba(43,212,199,.30);color:var(--teal);font-family:inherit;font-size:13px;font-weight:700;padding:9px 18px;border-radius:20px;cursor:pointer;transition:background .2s,opacity .2s}
		.pp-sec:hover:not(:disabled){background:rgba(43,212,199,.08)}
		.pp-sec:disabled{opacity:.4;cursor:default}
	`]
})
export class PaypalEmailConfirmComponent {
	private readonly api = inject(ProviderProfileService);
	private readonly waits = inject(WaitTimerService);
	private readonly identity = inject(AuthStore).currentUser()?.id ?? '';
	/** Next code may be requested (the server's resendAvailableAt / Retry-After); disables ONLY the resend button. */
	readonly resendWait = this.waits.track(waitScope('paypal-otp-resend', this.identity));
	/** The confirm step was throttled by the server (429 with a wait); disables ONLY the confirm button. A wrong code starts nothing. */
	readonly confirmWait = this.waits.track(waitScope('paypal-otp-confirm', this.identity));
	private waitMessageShown = false;
	readonly email = input.required<string>();
	/** 'add' when the account had no PayPal email before, 'change' otherwise. */
	readonly mode = input<'add' | 'change'>('change');
	/** The masked ACCOUNT email the code was sent to (from the server). */
	readonly accountEmailHint = input<string>('');
	readonly confirmed = output<string>();
	readonly dismissed = output<void>();
	readonly code = signal('');
	readonly busy = signal(false);
	readonly error = signal('');
	readonly notice = signal('');
	/** Seconds until another code may be requested (kept for callers/tests; the end timestamp lives in the wait service). */
	readonly cooldown = this.resendWait.remainingSeconds;

	constructor() {
		// A wait message ("try again after ...") must not outlive its wait.
		effect(() => {
			if (!this.resendWait.active() && !this.confirmWait.active() && this.waitMessageShown) { this.waitMessageShown = false; this.error.set(''); }
		});
	}

	confirm() {
		if (this.busy()) return;
		if (this.code().length !== 6) {
			// Never a dead button: say what is needed (under the boxes, marked invalid) and put the cursor on the first empty box.
			this.error.set('أدخل رمز التحقق المكوّن من 6 أرقام');
			document.getElementById(`pp-code-${Math.min(this.code().length, 5)}`)?.focus();
			return;
		}
		this.busy.set(true); this.error.set(''); this.notice.set('');
		this.api.confirmPaypalEmailChange(this.code()).subscribe({
			next: (r) => { this.busy.set(false); this.confirmed.emit(r.paypalPayoutEmail); },
			error: (err) => {
				this.busy.set(false);
				if (isRateLimitError(err) && this.confirmWait.startFromResponse(err) != null) this.waitMessageShown = true;
				this.error.set(mapHttpError(err, { fallback: 'تعذر تأكيد البريد، حاول مرة أخرى' }).message);
			}
		});
	}

	resend() {
		if (this.busy() || this.resendWait.active()) return;
		this.busy.set(true); this.error.set(''); this.notice.set('');
		this.api.requestPaypalEmailChange(this.email()).subscribe({
			next: (r) => { this.busy.set(false); if (r.emailSent) { this.resendWait.startFromResponse(r); this.code.set(''); this.notice.set('أرسلنا رمزًا جديدًا إلى بريد حسابك'); } else this.error.set('تعذر إرسال رمز التحقق، حاول مرة أخرى'); },
			error: (err) => {
				this.busy.set(false);
				// Only a 429 starts a wait, and only with the duration the server gave (Retry-After / retryAfterSeconds / retryAt).
				if (isRateLimitError(err) && this.resendWait.startFromResponse(err) != null) this.waitMessageShown = true;
				this.error.set(mapHttpError(err, { fallback: 'تعذر إرسال رمز التحقق، حاول مرة أخرى' }).message);
			}
		});
	}
}
