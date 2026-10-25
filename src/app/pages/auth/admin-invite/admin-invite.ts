import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminTeamService } from '../../../core/services/admin-team.service';

/** Public page behind an admin invitation link: shows who is invited (masked e-mail + role), asks for a password, creates the account. The one-time token is consumed server-side; nothing else is trusted. */
@Component({
	selector: 'app-admin-invite',
	standalone: true,
	imports: [FormsModule, RouterLink],
	template: `
	<section class="ai-wrap" dir="rtl">
		<h1 class="ai-ttl">دعوة إلى فريق إدارة وسيط AI</h1>
		@if (state() === 'loading') { <p class="ai-sub" role="status">جاري التحقق من الدعوة...</p> }
		@else if (state() === 'invalid') { <p class="ai-err" role="alert" data-testid="invite-invalid">هذه الدعوة غير صالحة أو انتهت أو استُخدمت. اطلب من Super Admin دعوة جديدة.</p> }
		@else if (state() === 'done') { <p class="ai-ok" role="status" data-testid="invite-done">أُنشئ حسابك. سجّل الدخول بالبريد وكلمة المرور؛ ستصلك رسالة تحقق بالبريد عند كل دخول.</p><a class="ai-btn" routerLink="/auth/login">تسجيل الدخول</a> }
		@else {
			<p class="ai-sub">دُعيت بالبريد <b dir="ltr">{{ info()?.email }}</b> بدور «{{ info()?.roleName }}». اختر كلمة مرور لحسابك. لا تُمنح أي صلاحية إلا ما يحدده الدور الذي منحك إياه Super Admin.</p>
			@if (!codeSent()) {
				<p class="ai-hint">للتأكد أنك صاحب هذا البريد، سنرسل إليه رمز تحقق من 6 أرقام. الرابط وحده لا يكفي لإنشاء الحساب.</p>
				@if (error()) { <p class="ai-err" role="alert" data-testid="invite-error">{{ error() }}</p> }
				<button type="button" class="ai-btn" [disabled]="busy()" (click)="requestCode()" data-testid="invite-send-code">إرسال رمز التحقق إلى بريدي</button>
			} @else {
			<p class="ai-ok" role="status" data-testid="invite-code-sent">أُرسل الرمز إلى {{ info()?.email }}. صالح 10 دقائق.</p>
			<label class="ai-lbl">رمز التحقق</label>
			<input class="ai-inp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr" [(ngModel)]="code" name="code" data-testid="invite-code">
			<label class="ai-lbl">كلمة المرور</label>
			<input class="ai-inp" type="password" autocomplete="new-password" [(ngModel)]="password" name="password" data-testid="invite-password">
			<p class="ai-hint">8 أحرف على الأقل، وفيها حرف كبير ورقم.</p>
			@if (error()) { <p class="ai-err" role="alert" data-testid="invite-error">{{ error() }}</p> }
			<button type="button" class="ai-btn" [disabled]="busy() || password.length < 8 || code.length !== 6" (click)="accept()" data-testid="invite-accept">قبول الدعوة وإنشاء الحساب</button>
			<button type="button" class="ai-link" [disabled]="busy()" (click)="requestCode()" data-testid="invite-resend-code">إعادة إرسال الرمز</button>
			}
		}
	</section>`,
	styles: [`.ai-wrap{max-width:460px;margin:40px auto;padding:24px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(11,20,55,.6);color:#fff}.ai-ttl{font-size:18px;font-weight:900;margin:0 0 12px}.ai-sub,.ai-hint{font-size:12.5px;color:#A8B2D1;line-height:1.7}.ai-lbl{display:block;font-size:12px;font-weight:700;margin:12px 0 6px}.ai-inp{width:100%;height:38px;border-radius:9px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#fff;padding:0 12px;font-family:inherit}.ai-link{background:none;border:0;color:#2BD4C7;font-size:12px;cursor:pointer;margin-top:10px;padding:0}.ai-btn{display:inline-flex;margin-top:14px;padding:9px 18px;border-radius:999px;border:0;background:linear-gradient(135deg,#2BD4C7,#2B7FFF);color:#070D24;font-weight:800;font-family:inherit;cursor:pointer;text-decoration:none}.ai-btn[disabled]{opacity:.5;cursor:not-allowed}.ai-err{color:#FF8C69;font-size:12.5px}.ai-ok{color:#0FA99A;font-size:13px}`],
})
export class AdminInvite implements OnInit {
	private api = inject(AdminTeamService);
	state = signal<'loading' | 'invalid' | 'ready' | 'done'>('loading'); info = signal<{ email: string; roleName: string } | null>(null); error = signal(''); busy = signal(false); password = ''; code = ''; codeSent = signal(false);
	private token = '';
	ngOnInit() {
		// the token lives in the URL FRAGMENT (never sent to a server); it is read once and removed from the address bar and history right away
		this.token = decodeURIComponent((typeof location !== 'undefined' ? location.hash : '').replace(/^#/, ''));
		try { history.replaceState(null, '', location.pathname); } catch { /* no history API */ }
		if (!this.token) { this.state.set('invalid'); return; }
		this.api.invitePreview(this.token).subscribe({ next: r => { this.info.set(r.data); this.state.set('ready'); }, error: () => this.state.set('invalid') });
	}
	requestCode() {
		if (this.busy()) return; this.busy.set(true); this.error.set('');
		this.api.inviteRequestCode(this.token).subscribe({
			next: () => { this.busy.set(false); this.codeSent.set(true); },
			error: e => { this.busy.set(false); const c = e?.error?.code; if (c === 'INVITE_INVALID') { this.state.set('invalid'); return; } this.error.set(c === 'INVITE_CODE_TOO_SOON' ? 'انتظر دقيقة قبل طلب رمز جديد.' : c === 'INVITE_CODE_LIMIT' ? 'استُهلكت رموز هذه الدعوة. اطلب من Super Admin إعادة إصدارها.' : (e?.error?.message || 'تعذّر إرسال الرمز، حاول مرة أخرى')); },
		});
	}
	accept() {
		if (this.busy()) return; this.busy.set(true); this.error.set('');
		this.api.inviteAccept(this.token, this.password, this.code).subscribe({
			next: () => { this.busy.set(false); this.password = ''; this.code = ''; this.token = ''; this.state.set('done'); },
			error: e => { this.busy.set(false); const code = e?.error?.code; if (code === 'INVITE_INVALID') { this.state.set('invalid'); return; } if (code === 'INVITE_CODE_INVALID') { this.error.set('رمز التحقق غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا.'); return; } this.error.set(e?.error?.errors?.[0]?.message || (code === 'ACCOUNT_EXISTS' ? 'يوجد حساب بهذا البريد. تواصل مع Super Admin.' : e?.error?.message || 'تعذّر قبول الدعوة')); },
		});
	}
}
