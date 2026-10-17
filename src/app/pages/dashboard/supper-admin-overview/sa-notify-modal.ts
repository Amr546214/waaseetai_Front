import { Component, ElementRef, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { handleAdminError, reportAdminProblems, SubmitGuard } from './shared/admin-form-report';
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
				<textarea id="sa-notify-message" rows="4" style="width:100%" maxlength="500" aria-label="نص الرسالة" placeholder="اكتب الرسالة (5 أحرف على الأقل)" [value]="message()" (input)="message.set($any($event.target).value)"></textarea>
				@if (error()) { <p role="alert" style="color:#FF6B6B;font-size:12px">{{ error() }}</p> }
				<div style="display:flex;gap:8px;margin-top:12px">
					<button type="button" class="btn btn-primary" [disabled]="busy()" (click)="send()">{{ busy() ? 'جارٍ الإرسال...' : 'تأكيد الإرسال' }}</button>
					<button type="button" class="btn" [disabled]="busy()" (click)="close()">إلغاء</button>
				</div>
			</div>
		</div>`,
})
export class SaNotifyModal {
	private http = inject(HttpClient);
	private host = inject<ElementRef<HTMLElement>>(ElementRef);
	private guard = new SubmitGuard();

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
		if (this.busy()) return;
		this.error.set('');
		const text = this.message().trim();
		if (text.length < 5) {
			void reportAdminProblems(this.host.nativeElement, [{ field: 'sa-notify-message', message: text ? 'الرسالة قصيرة جدًا: اكتب 5 أحرف على الأقل' : 'نص الرسالة مطلوب (5 أحرف على الأقل)' }]);
			return;
		}
		if (!this.guard.enter()) return;
		this.busy.set(true);
		this.http.post(`${environment.url_api}/admin/users/${this.userId}/notify`, { message: text, ...(this.context ? { context: this.context } : {}) }).subscribe({
			next: () => { this.guard.release(); this.busy.set(false); this.sent.emit(); },
			error: (err) => {
				this.guard.release();
				this.busy.set(false);
				handleAdminError(this.host.nativeElement, err, { fallback: 'تعذر إرسال الرسالة', resolve: { message: 'sa-notify-message' } }, (m) => this.error.set(m));
			},
		});
	}
}
