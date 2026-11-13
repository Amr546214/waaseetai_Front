import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { mapHttpError } from '../../core/forms/http-error';
import { ConfirmModalService } from '../../core/services/confirm-modal.service';
import { SystemSettingsStore } from '../../core/services/system-settings.store';
import { WsDatePipe } from '../ws-date/ws-date.pipe';

interface Block { id: string; scope: 'PAIR' | 'IP' | 'ACCOUNT'; ip: string; account: string | null; fails: number; blockedUntil: string; lastFailAt: string }
interface Impact { current: Record<string, number>; candidate: Record<string, number>; activeBlocks: { pair: number; ip: number; account: number }; wouldBlockNextFailure: { pair: number; ip: number }; note: string }
const LIMIT_KEYS = { maxFails: 'loginMaxFailedAttempts', windowMin: 'loginAttemptWindowMinutes', blockMin: 'loginBlockMinutes', ipMaxFails: 'loginIpMaxFailedAttempts' } as const;

/** Under the login-protection settings: what the new limits would do (before saving), the blocks that exist right now, and the documented way to lift one (SUPER_ADMIN; audited by the server). */
@Component({
	selector: 'app-login-protection',
	standalone: true,
	imports: [WsDatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
	<section class="lp" dir="rtl" data-testid="login-protection">
		<h3 class="lp-h">حظر محاولات الدخول القائم</h3>
		<p class="lp-note">حظر «عنوان + حساب» يمنع ذلك العنوان فقط عن ذلك الحساب، ولا يقفل الحساب على صاحبه من عنوان آخر. حظر «عنوان IP» يمنع العنوان لكل الحسابات بعد تجربة حسابات متعددة.</p>
		<div class="lp-actions">
			<button type="button" class="lp-btn" data-testid="lp-impact" (click)="previewImpact()" [disabled]="busy()">أثر الحدود الحالية في الحقول</button>
			<button type="button" class="lp-btn" data-testid="lp-refresh" (click)="load()" [disabled]="busy()">تحديث القائمة</button>
		</div>
		@if (impact(); as i) { <div class="lp-impact" role="status" data-testid="lp-impact-result">
			حظر فعّال الآن: {{ i.activeBlocks.pair }} (عنوان+حساب) · {{ i.activeBlocks.ip }} (عنوان IP) · {{ i.activeBlocks.account }} تأخير حساب. سيُحظر عند المحاولة الفاشلة التالية بالحدود المكتوبة: {{ i.wouldBlockNextFailure.pair }} · {{ i.wouldBlockNextFailure.ip }}. {{ i.note }}</div> }
		@if (error()) { <div class="lp-err" role="alert">{{ error() }}</div> }
		@if (!blocks().length) { <div class="lp-empty" data-testid="lp-empty">لا يوجد حظر فعّال حاليًا.</div> }
		@else { <table class="lp-tbl" data-testid="lp-table"><thead><tr><th>النطاق</th><th>العنوان</th><th>الحساب</th><th>محاولات</th><th>ينتهي</th><th></th></tr></thead><tbody>
			@for (b of blocks(); track b.id) { <tr><td>{{ b.scope === 'IP' ? 'عنوان IP' : b.scope === 'ACCOUNT' ? 'تأخير الحساب عبر الأجهزة غير المعروفة' : 'عنوان + حساب' }}</td><td dir="ltr">{{ b.ip }}</td><td dir="ltr">{{ b.account ?? '—' }}</td><td>{{ b.fails }}</td><td>{{ b.blockedUntil | wsDate:'datetime':'yyyy-MM-dd HH:mm' }}</td><td><button type="button" class="lp-btn" data-testid="lp-unblock" [disabled]="busy()" (click)="unblock(b)">فك الحظر</button></td></tr> }
		</tbody></table> }
	</section>`,
	styles: [`.lp{margin-top:16px}.lp-h{margin:0 0 6px;font-size:15px}.lp-note{font-size:12px;opacity:.75;margin:0 0 10px}.lp-actions{display:flex;gap:8px;margin-bottom:10px}.lp-btn{cursor:pointer;padding:6px 12px;border-radius:8px;border:1px solid var(--ws-border,rgba(255,255,255,.2));background:none;color:inherit}.lp-impact{font-size:13px;margin:8px 0;padding:8px 10px;border-radius:8px;background:rgba(43,212,199,.1)}.lp-err{color:#ff6b6b;font-size:13px}.lp-empty{font-size:13px;opacity:.7}.lp-tbl{width:100%;border-collapse:collapse;font-size:13px}.lp-tbl th,.lp-tbl td{text-align:right;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.08)}`],
})
export class LoginProtectionComponent implements OnInit {
	private readonly http = inject(HttpClient); private readonly store = inject(SystemSettingsStore); private readonly confirmModal = inject(ConfirmModalService);
	readonly blocks = signal<Block[]>([]); readonly impact = signal<Impact | null>(null); readonly error = signal(''); readonly busy = signal(false);
	private base = `${environment.url_api}/admin/security`;
	ngOnInit() { void this.load(); }
	async load() {
		this.busy.set(true); this.error.set('');
		try { this.blocks.set((await firstValueFrom(this.http.get<{ data: Block[] }>(`${this.base}/login-blocks`))).data); } catch (e) { this.error.set(mapHttpError(e, { fallback: 'تعذّر تحميل الحظر القائم.' }).message); } finally { this.busy.set(false); }
	}
	async previewImpact() {
		this.busy.set(true); this.error.set('');
		try {
			const params: Record<string, number> = {}; for (const [q, key] of Object.entries(LIMIT_KEYS)) { const v = Number(this.store.value(key)); if (Number.isFinite(v)) params[q] = v; }
			this.impact.set((await firstValueFrom(this.http.get<{ data: Impact }>(`${environment.url_api}/admin/system-settings/login-protection/impact`, { params }))).data);
		} catch (e) { this.error.set(mapHttpError(e, { fallback: 'تعذّر حساب الأثر.' }).message); } finally { this.busy.set(false); }
	}
	async unblock(b: Block) {
		if (!(await this.confirmModal.confirm({ title: 'فك حظر الدخول', type: 'warning', size: 'sm', confirmText: 'فك الحظر', message: `سيُفك حظر ${b.scope === 'IP' ? 'العنوان' : 'العنوان على هذا الحساب'} ${b.ip}${b.account ? ' / ' + b.account : ''} فورًا، ويُسجَّل الإجراء في سجل التدقيق.` }))) return;
		this.busy.set(true); this.error.set('');
		try { await firstValueFrom(this.http.post(`${this.base}/login-blocks/unblock`, { id: b.id })); await this.load(); } catch (e) { this.error.set(mapHttpError(e, { fallback: 'تعذّر فك الحظر.' }).message); this.busy.set(false); }
	}
}
