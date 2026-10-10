import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProviderProfileService } from '../../core/services/provider-profile.service';
import { mapHttpError } from '../../core/forms/http-error';

/**
 * Second step of a PayPal payout email change: the code was e-mailed to the ACCOUNT email, the new address is still pending.
 * Confirming it saves the address; PayPal withdrawals are then frozen for 24 hours (said here, so nobody is surprised).
 */
@Component({
	selector: 'ws-paypal-email-confirm',
	standalone: true,
	imports: [FormsModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="paypal-confirm" data-testid="paypal-confirm" role="group" aria-label="تأكيد تغيير بريد PayPal"
			style="margin-top:14px;padding:14px;border:1px solid rgba(255,255,255,.12);border-radius:10px">
			<div style="font-weight:700;margin-bottom:6px">تأكيد بريد PayPal</div>
			<p style="font-size:13px;margin-bottom:10px">
				أرسلنا رمزًا من 6 أرقام إلى بريد حسابك الإلكتروني لتأكيد البريد <span dir="ltr" data-testid="paypal-pending-email">{{ email() }}</span>.
				بعد التأكيد يتوقف السحب عبر PayPal لمدة 24 ساعة، ولا يحتاج التغيير إلى مراجعة يدوية.
			</p>
			<input type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" dir="ltr" class="inp-field" id="pp-code"
				placeholder="000000" aria-label="رمز التحقق" [ngModel]="code()" (ngModelChange)="code.set($event)" data-testid="paypal-code">
			@if (error()) { <div role="alert" data-testid="paypal-confirm-error" style="color:#f87171;font-size:13px;margin-top:6px">{{ error() }}</div> }
			@if (notice()) { <div role="status" style="font-size:13px;margin-top:6px">{{ notice() }}</div> }
			<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
				<button type="button" class="btn-primary" data-testid="paypal-confirm-btn" [disabled]="busy() || code().length !== 6" (click)="confirm()">{{ busy() ? 'جاري التأكيد...' : 'تأكيد البريد' }}</button>
				<button type="button" class="btn-secondary" [disabled]="busy()" (click)="resend()">إعادة إرسال الرمز</button>
				<button type="button" class="btn-secondary" [disabled]="busy()" (click)="dismissed.emit()">إلغاء</button>
			</div>
		</div>
	`
})
export class PaypalEmailConfirmComponent {
	private readonly api = inject(ProviderProfileService);
	readonly email = input.required<string>();
	readonly confirmed = output<string>();
	readonly dismissed = output<void>();
	readonly code = signal('');
	readonly busy = signal(false);
	readonly error = signal('');
	readonly notice = signal('');

	confirm() {
		if (this.busy() || this.code().length !== 6) return;
		this.busy.set(true); this.error.set(''); this.notice.set('');
		this.api.confirmPaypalEmailChange(this.code()).subscribe({
			next: (r) => { this.busy.set(false); this.confirmed.emit(r.paypalPayoutEmail); },
			error: (err) => { this.busy.set(false); this.error.set(mapHttpError(err, { fallback: 'تعذر تأكيد البريد، حاول مرة أخرى' }).message); }
		});
	}

	resend() {
		if (this.busy()) return;
		this.busy.set(true); this.error.set(''); this.notice.set('');
		this.api.requestPaypalEmailChange(this.email()).subscribe({
			next: (r) => { this.busy.set(false); if (r.emailSent) this.notice.set('أرسلنا رمزًا جديدًا إلى بريد حسابك'); else this.error.set('تعذر إرسال الرمز الآن، حاول بعد قليل'); },
			error: (err) => { this.busy.set(false); this.error.set(mapHttpError(err, { fallback: 'تعذر إرسال الرمز، حاول مرة أخرى' }).message); }
		});
	}
}
