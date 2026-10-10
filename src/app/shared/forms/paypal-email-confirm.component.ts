import { ChangeDetectionStrategy, Component, OnDestroy, inject, input, output, signal } from '@angular/core';
import { ProviderProfileService } from '../../core/services/provider-profile.service';
import { mapHttpError } from '../../core/forms/http-error';
import { OtpInputComponent } from './otp-input.component';

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
			<ws-otp-input idPrefix="pp-code" [(value)]="code" [invalid]="!!error()" [disabled]="busy()" (complete)="confirm()" />
			@if (error()) { <div role="alert" data-testid="paypal-confirm-error" style="color:#f87171;font-size:13px;margin-top:2px;text-align:center">{{ error() }}</div> }
			@if (notice()) { <div role="status" data-testid="paypal-confirm-notice" style="font-size:13px;margin-top:2px;text-align:center">{{ notice() }}</div> }
			<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:12px">
				<button type="button" class="btn-primary" data-testid="paypal-confirm-btn" [disabled]="busy() || code().length !== 6" (click)="confirm()">{{ busy() ? 'جارٍ التأكيد...' : 'تأكيد البريد' }}</button>
				<button type="button" class="btn-secondary" data-testid="paypal-resend-btn" [disabled]="busy() || cooldown() > 0" (click)="resend()">{{ cooldown() > 0 ? 'إعادة إرسال الرمز (' + cooldown() + ' ث)' : 'إعادة إرسال الرمز' }}</button>
				<button type="button" class="btn-secondary" [disabled]="busy()" (click)="dismissed.emit()">إلغاء</button>
			</div>
		</div>
	`
})
export class PaypalEmailConfirmComponent implements OnDestroy {
	private readonly api = inject(ProviderProfileService);
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
	/** Seconds until another code may be requested (set from a 429 answer). */
	readonly cooldown = signal(0);
	private timer: ReturnType<typeof setInterval> | null = null;

	ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }

	private startCooldown(seconds: number): void {
		if (this.timer) clearInterval(this.timer);
		this.cooldown.set(Math.max(0, Math.ceil(seconds)));
		if (this.cooldown() <= 0) return;
		this.timer = setInterval(() => {
			this.cooldown.update(s => s - 1);
			if (this.cooldown() <= 0 && this.timer) { clearInterval(this.timer); this.timer = null; }
		}, 1000);
	}

	confirm() {
		if (this.busy() || this.code().length !== 6) return;
		this.busy.set(true); this.error.set(''); this.notice.set('');
		this.api.confirmPaypalEmailChange(this.code()).subscribe({
			next: (r) => { this.busy.set(false); this.confirmed.emit(r.paypalPayoutEmail); },
			error: (err) => { this.busy.set(false); this.error.set(mapHttpError(err, { fallback: 'تعذر تأكيد البريد، حاول مرة أخرى' }).message); }
		});
	}

	resend() {
		if (this.busy() || this.cooldown() > 0) return;
		this.busy.set(true); this.error.set(''); this.notice.set('');
		this.api.requestPaypalEmailChange(this.email()).subscribe({
			next: (r) => { this.busy.set(false); if (r.emailSent) { this.code.set(''); this.notice.set('أرسلنا رمزًا جديدًا إلى بريد حسابك'); } else this.error.set('تعذر إرسال رمز التحقق، حاول مرة أخرى'); },
			error: (err) => {
				this.busy.set(false);
				const wait = Number(err?.error?.retryAfterSeconds);
				if (err?.status === 429 && Number.isFinite(wait) && wait > 0) this.startCooldown(wait);
				this.error.set(mapHttpError(err, { fallback: 'تعذر إرسال رمز التحقق، حاول مرة أخرى' }).message);
			}
		});
	}
}
