import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
		@else if (state() === 'invalid') { <p class="ai-err" role="alert" data-testid="invite-invalid">هذه الدعوة غير صالحة أو انتهت أو استُخدمت. اطلب من مالك المنصة دعوة جديدة.</p> }
		@else if (state() === 'done') { <p class="ai-ok" role="status" data-testid="invite-done">أُنشئ حسابك. سجّل الدخول بالبريد وكلمة المرور؛ ستصلك رسالة تحقق بالبريد عند كل دخول.</p><a class="ai-btn" routerLink="/auth/login">تسجيل الدخول</a> }
		@else {
			<p class="ai-sub">دُعيت بالبريد <b dir="ltr">{{ info()?.email }}</b> بدور «{{ info()?.roleName }}». اختر كلمة مرور لحسابك. لا تُمنح أي صلاحية إلا ما يحدده الدور الذي منحك إياه مالك المنصة.</p>
			<label class="ai-lbl">كلمة المرور</label>
			<input class="ai-inp" type="password" autocomplete="new-password" [(ngModel)]="password" name="password" data-testid="invite-password">
			<p class="ai-hint">8 أحرف على الأقل، وفيها حرف كبير ورقم.</p>
			@if (error()) { <p class="ai-err" role="alert" data-testid="invite-error">{{ error() }}</p> }
			<button type="button" class="ai-btn" [disabled]="busy() || password.length < 8" (click)="accept()" data-testid="invite-accept">قبول الدعوة وإنشاء الحساب</button>
		}
	</section>`,
	styles: [`.ai-wrap{max-width:460px;margin:40px auto;padding:24px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(11,20,55,.6);color:#fff}.ai-ttl{font-size:18px;font-weight:900;margin:0 0 12px}.ai-sub,.ai-hint{font-size:12.5px;color:#A8B2D1;line-height:1.7}.ai-lbl{display:block;font-size:12px;font-weight:700;margin:12px 0 6px}.ai-inp{width:100%;height:38px;border-radius:9px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#fff;padding:0 12px;font-family:inherit}.ai-btn{display:inline-flex;margin-top:14px;padding:9px 18px;border-radius:999px;border:0;background:linear-gradient(135deg,#2BD4C7,#2B7FFF);color:#070D24;font-weight:800;font-family:inherit;cursor:pointer;text-decoration:none}.ai-btn[disabled]{opacity:.5;cursor:not-allowed}.ai-err{color:#FF8C69;font-size:12.5px}.ai-ok{color:#0FA99A;font-size:13px}`],
})
export class AdminInvite implements OnInit {
	private api = inject(AdminTeamService);
	private route = inject(ActivatedRoute);
	state = signal<'loading' | 'invalid' | 'ready' | 'done'>('loading'); info = signal<{ email: string; roleName: string } | null>(null); error = signal(''); busy = signal(false); password = '';
	private token = '';
	ngOnInit() {
		this.token = this.route.snapshot.paramMap.get('token') ?? '';
		this.api.invitePreview(this.token).subscribe({ next: r => { this.info.set(r.data); this.state.set('ready'); }, error: () => this.state.set('invalid') });
	}
	accept() {
		if (this.busy()) return; this.busy.set(true); this.error.set('');
		this.api.inviteAccept(this.token, this.password).subscribe({
			next: () => { this.busy.set(false); this.password = ''; this.state.set('done'); },
			error: e => { this.busy.set(false); const code = e?.error?.code; if (code === 'INVITE_INVALID') { this.state.set('invalid'); return; } this.error.set(e?.error?.errors?.[0]?.message || (code === 'ACCOUNT_EXISTS' ? 'يوجد حساب بهذا البريد. تواصل مع مالك المنصة.' : e?.error?.message || 'تعذّر قبول الدعوة')); },
		});
	}
}
