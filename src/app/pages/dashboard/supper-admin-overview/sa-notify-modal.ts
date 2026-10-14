import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

/**
 * Confirmation dialog for an admin message to ONE user (POST /admin/users/:id/notify). The message is delivered as a notification through the user's
 * saved channels and audit-logged on the account; an optional context ties it to the user's own request / offer so the notification opens the right page.
 */
@Component({
	selector: 'sa-notify-modal',
	standalone: true,
	template: `
		<div class="modal-overlay" (click)="close()" style="position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:950">
			<div class="modal-card" (click)="$event.stopPropagation()" style="background:var(--crd-bg,#0f1530);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:20px;max-width:440px;width:92%" role="dialog" aria-modal="true">
				<h3 style="margin:0 0 6px;font-size:16px">إرسال رسالة إلى {{ userName }}</h3>
				<p style="font-size:12px;opacity:.75;margin:0 0 10px">تصل الرسالة كإشعار داخل المنصة (وعبر قنوات المستخدم المفعّلة) ويُسجَّل الإرسال في سجل التدقيق.</p>
				<textarea rows="4" style="width:100%" maxlength="500" aria-label="نص الرسالة" placeholder="اكتب الرسالة (5 أحرف على الأقل)" [value]="message()" (input)="message.set($any($event.target).value)"></textarea>
				@if (error()) { <p role="alert" style="color:#FF6B6B;font-size:12px">{{ error() }}</p> }
				<div style="display:flex;gap:8px;margin-top:12px">
					<button type="button" class="btn btn-primary" [disabled]="busy() || message().trim().length < 5" (click)="send()">{{ busy() ? 'جارٍ الإرسال...' : 'تأكيد الإرسال' }}</button>
					<button type="button" class="btn" [disabled]="busy()" (click)="close()">إلغاء</button>
				</div>
			</div>
		</div>`,
})
export class SaNotifyModal {
	private http = inject(HttpClient);

	@Input({ required: true }) userId!: string;
	@Input() userName = 'المستخدم';
	@Input() context: { type: 'REQUEST' | 'OFFER'; id: string } | null = null;
	@Output() closed = new EventEmitter<void>();
	@Output() sent = new EventEmitter<void>();

	message = signal('');
	busy = signal(false);
	error = signal('');

	close() { if (!this.busy()) this.closed.emit(); }

	send() {
		if (this.busy() || this.message().trim().length < 5) return;
		this.busy.set(true);
		this.error.set('');
		this.http.post(`${environment.url_api}/admin/users/${this.userId}/notify`, { message: this.message().trim(), ...(this.context ? { context: this.context } : {}) }).subscribe({
			next: () => { this.busy.set(false); this.sent.emit(); },
			error: (err) => { this.busy.set(false); this.error.set(err?.error?.message || 'تعذر إرسال الرسالة'); },
		});
	}
}
