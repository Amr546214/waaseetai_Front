import { ChangeDetectionStrategy, Component, ElementRef, inject, input, model, output } from '@angular/core';

/**
 * The platform's six-box one-time-code input (same look and behaviour as the login / verification page: LTR digits inside RTL pages,
 * auto-advance, backspace goes back, paste fills all boxes, one-time-code autofill, mobile-sized boxes).
 * `value` is two-way; `complete` fires when all six digits are present.
 */
@Component({
	selector: 'ws-otp-input',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="otp-group" dir="ltr" role="group" aria-label="خانات رمز التحقق" data-testid="otp-group" (paste)="onPaste($event)">
			@for (i of indexes; track i) {
				<input class="otp-box" [class.filled]="!!digit(i)" [class.has-error]="invalid()" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1"
					autocomplete="one-time-code" [id]="idPrefix() + '-' + i" [attr.aria-label]="'الرقم ' + (i + 1)" [attr.aria-invalid]="invalid() ? 'true' : null"
					[value]="digit(i)" [disabled]="disabled()" (input)="onInput(i, $event)" (keydown)="onKeydown(i, $event)" (focus)="$any($event.target).select()">
			}
		</div>
	`,
	styles: [`
		.otp-group{display:flex;gap:10px;justify-content:center;direction:ltr;margin:6px 0 12px}
		.otp-box{width:52px;height:60px;border-radius:12px;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:var(--txt);font-size:24px;font-weight:800;text-align:center;outline:none;transition:border-color .2s,box-shadow .2s,background .2s;caret-color:#2BD4C7;font-family:'Tajawal',system-ui,sans-serif;-moz-appearance:textfield;appearance:textfield}
		.otp-box::-webkit-outer-spin-button,.otp-box::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
		.otp-box:focus{border-color:rgba(43,212,199,.45);box-shadow:0 0 0 3px rgba(43,212,199,.10);background:rgba(43,212,199,.04)}
		.otp-box.filled{border-color:rgba(43,212,199,.35);background:rgba(43,212,199,.06)}
		.otp-box.has-error{border-color:rgba(248,113,113,.65);background:rgba(248,113,113,.06)}
		.otp-box:disabled{opacity:.5}
		@media(max-width:767px){.otp-box{width:42px;height:50px;font-size:20px}.otp-group{gap:7px}}
	`]
})
export class OtpInputComponent {
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
	readonly value = model<string>('');
	readonly invalid = input(false);
	readonly disabled = input(false);
	readonly idPrefix = input('otp');
	readonly complete = output<string>();
	readonly indexes = [0, 1, 2, 3, 4, 5];

	digit(i: number): string { return this.value()[i] ?? ''; }

	private set(digits: string[]): void {
		const v = digits.join('').replace(/\D/g, '').slice(0, 6);
		this.value.set(v);
		if (v.length === 6) this.complete.emit(v);
	}

	private focus(i: number): void {
		(this.host.nativeElement.querySelector(`#${this.idPrefix()}-${Math.max(0, Math.min(5, i))}`) as HTMLInputElement | null)?.focus();
	}

	onInput(i: number, event: Event): void {
		const el = event.target as HTMLInputElement;
		const typed = el.value.replace(/\D/g, '');
		const digits = Array.from({ length: 6 }, (_, k) => this.digit(k));
		if (typed.length > 1) {
			// several digits landed in one box (autofill / IME): spread them from this box on
			typed.split('').slice(0, 6 - i).forEach((d, k) => { digits[i + k] = d; });
			this.set(digits); this.focus(Math.min(5, i + typed.length));
			return;
		}
		digits[i] = typed;
		el.value = typed;
		this.set(digits);
		if (typed && i < 5) this.focus(i + 1);
	}

	onKeydown(i: number, event: KeyboardEvent): void {
		if (event.key === 'Backspace' && !this.digit(i) && i > 0) {
			const digits = Array.from({ length: 6 }, (_, k) => this.digit(k));
			digits[i - 1] = '';
			this.set(digits); this.focus(i - 1); event.preventDefault();
		} else if (event.key === 'ArrowLeft') { this.focus(i - 1); event.preventDefault(); }
		else if (event.key === 'ArrowRight') { this.focus(i + 1); event.preventDefault(); }
	}

	onPaste(event: ClipboardEvent): void {
		const text = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, 6);
		if (!text) return;
		event.preventDefault();
		this.set(text.split(''));
		this.focus(Math.min(5, text.length));
	}
}
