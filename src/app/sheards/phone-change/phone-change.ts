import { ChangeDetectionStrategy, Component, OnDestroy, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { inject } from '@angular/core';
import { PhoneChangeService } from '../../core/services/phone-change.service';
import { mapHttpError } from '../../core/forms/http-error';

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;
export const normalizeDigits = (value: string): string =>
	value.replace(ARABIC_DIGITS, d => String('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹'.indexOf(d) % 10)).replace(/[^0-9]/g, '');
export const RESEND_SECONDS = 60;

/**
 * "تغيير الرقم": a button + dialog. Step 1 asks for the new number, the backend emails a code to the ACCOUNT email (never to the new number);
 * step 2 takes the 6-digit code. All messages are the backend's Arabic text (wrong / expired / too many attempts / generic conflict / throttle).
 * Emits `changed` after the backend confirmed, so the host reloads its profile.
 */
@Component({
	selector: 'app-phone-change',
	standalone: true,
	imports: [CommonModule, FormsModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './phone-change.html',
	styleUrl: './phone-change.css',
})
export class PhoneChange implements OnDestroy {
	private readonly api = inject(PhoneChangeService);

	readonly changed = output<string>();

	readonly open = signal(false);
	readonly step = signal<1 | 2 | 3>(1);
	readonly phone = signal('');
	readonly code = signal('');
	readonly busy = signal(false);
	readonly error = signal('');
	readonly emailHint = signal('');
	readonly emailSent = signal(true);
	readonly countdown = signal(0);
	private timer: ReturnType<typeof setInterval> | null = null;

	readonly phoneValid = computed(() => /^\d{9,15}$/.test(this.phone()));
	readonly codeValid = computed(() => /^\d{6}$/.test(this.code()));

	show(): void { this.reset(); this.open.set(true); }
	close(): void { this.open.set(false); this.stopTimer(); }

	onPhoneInput(value: string): void { this.phone.set(normalizeDigits(value)); this.error.set(''); }
	onCodeInput(value: string): void { this.code.set(normalizeDigits(value).slice(0, 6)); this.error.set(''); }
	onCodePaste(event: ClipboardEvent): void { event.preventDefault(); this.onCodeInput(event.clipboardData?.getData('text') ?? ''); }

	sendCode(): void {
		if (!this.phoneValid() || this.busy()) { if (!this.phoneValid()) this.error.set('رقم الجوال غير صحيح (أرقام فقط، من 9 إلى 15 رقمًا)'); return; }
		this.busy.set(true); this.error.set('');
		this.api.request(this.phone()).subscribe({
			next: res => {
				this.busy.set(false);
				this.emailHint.set(res.emailHint);
				this.emailSent.set(res.emailSent);
				if (res.emailSent) { this.step.set(2); this.code.set(''); this.startTimer(); }
				else this.error.set('تعذر إرسال رمز التحقق إلى بريدك الآن، حاول مرة أخرى بعد قليل');
			},
			error: err => { this.busy.set(false); this.error.set(mapHttpError(err, { fallback: 'تعذر إرسال رمز التحقق، حاول مرة أخرى' }).message); },
		});
	}

	resend(): void { if (this.countdown() === 0) this.sendCode(); }

	confirm(): void {
		if (!this.codeValid() || this.busy()) { if (!this.codeValid()) this.error.set('رمز التحقق يتكون من 6 أرقام'); return; }
		this.busy.set(true); this.error.set('');
		this.api.confirm(this.code()).subscribe({
			next: res => { this.busy.set(false); this.step.set(3); this.stopTimer(); this.changed.emit(res.phoneNumber); },
			error: err => {
				this.busy.set(false);
				this.error.set(mapHttpError(err, { fallback: 'تعذر تأكيد الرمز، حاول مرة أخرى' }).message);
				// locked / expired / spent: the code is gone, go back to ask for a new one
				const status = (err as { status?: number })?.status;
				if (status === 429 || status === 409 || (status === 400 && /انتهت|اطلب رمزًا جديدًا/.test(this.error()))) { this.step.set(1); this.code.set(''); this.stopTimer(); }
			},
		});
	}

	back(): void { this.step.set(1); this.code.set(''); this.error.set(''); this.stopTimer(); }

	private startTimer(): void {
		this.stopTimer();
		this.countdown.set(RESEND_SECONDS);
		this.timer = setInterval(() => { this.countdown.update(n => Math.max(0, n - 1)); if (this.countdown() === 0) this.stopTimer(); }, 1000);
	}
	private stopTimer(): void { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
	private reset(): void { this.step.set(1); this.phone.set(''); this.code.set(''); this.error.set(''); this.busy.set(false); this.countdown.set(0); this.stopTimer(); }
	ngOnDestroy(): void { this.stopTimer(); }
}
