import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { IdentityCheckAdmin, IdentityCheckService, IdentityFieldResult, IdentityParty } from '../../../../core/services/identity-check.service';

const FIELD_LABELS: { key: 'fullName' | 'birthDate' | 'nationalId'; label: string }[] = [
	{ key: 'fullName', label: 'الاسم الكامل' },
	{ key: 'birthDate', label: 'تاريخ الميلاد' },
	{ key: 'nationalId', label: 'رقم الوثيقة' },
];
const STATUS_LABELS: Record<string, string> = { MATCH: 'مطابق', MISMATCH: 'غير مطابق', COULD_NOT_VERIFY: 'تعذّر التحقق' };
const STATUS_CLASS: Record<string, string> = { MATCH: 'ok', MISMATCH: 'bad', COULD_NOT_VERIFY: 'unk' };

/** Advisory per-field result of the automatic ID check. It decides nothing: approve / reject stay manual. */
@Component({
	selector: 'app-identity-check-panel',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
	<section class="icp" data-testid="id-check-panel" aria-label="الفحص الآلي للهوية">
		<div class="icp-head"><strong>الفحص الآلي لبيانات الهوية</strong><span class="icp-adv">استرشادي</span></div>
		@if (loading()) { <p class="icp-note" data-testid="id-check-loading">جاري التحميل...</p> }
		@else if (error()) { <p class="icp-note" data-testid="id-check-error" role="alert">{{ error() }}</p> }
		@else if (c(); as d) {
			@if (inProgress()) {
				<p class="icp-state" data-testid="id-check-state" data-state="IN_PROGRESS">قيد الفحص الآلي</p>
			} @else if (d.state === 'DONE' && d.fields) {
				<ul class="icp-list" data-testid="id-check-fields">
					@for (f of rows(); track f.key) {
						<li class="icp-row" [attr.data-testid]="'id-check-' + f.key" [attr.data-status]="f.res.status">
							<span class="icp-k">{{ f.label }}</span>
							<span class="icp-chip" [class]="'icp-chip ' + f.cls">{{ f.text }}</span>
							@if (f.res.reason) { <small class="icp-reason" dir="ltr">{{ f.res.reason }}</small> }
						</li>
					}
				</ul>
			} @else {
				<p class="icp-state" data-testid="id-check-state" data-state="MANUAL">لم يُفحص آليًا — راجعها يدويًا</p>
			}
			<ul class="icp-list icp-notex" data-testid="id-check-not-examined">
				<li class="icp-row"><span class="icp-k">مطابقة الوجه</span><span class="icp-chip na">لم تُفحص</span></li>
				<li class="icp-row"><span class="icp-k">الحيوية (liveness)</span><span class="icp-chip na">لم تُفحص</span></li>
				<li class="icp-row"><span class="icp-k">أصالة المستند</span><span class="icp-chip na">لم تُفحص</span></li>
			</ul>
			<p class="icp-note" data-testid="id-check-advisory">النتائج استرشادية فقط ولا تُعتمد أو تُرفض تلقائيًا؛ المراجعة اليدوية مطلوبة دائمًا. «تعذّر التحقق» ليس نجاحًا.</p>
		}
	</section>`,
	styles: [`
	:host { display: block; }
	.icp { --b: rgba(255,255,255,.14); --t: #e8ecf8; --m: #a9b3d1; --bg: rgba(255,255,255,.04);
		margin: 12px 0; padding: 12px 14px; border: 1px solid var(--b); border-radius: 12px; background: var(--bg); color: var(--t); direction: rtl; }
	:host-context(body.light-theme) .icp { --b: #cfd6e6; --t: #1b2236; --m: #4d5878; --bg: #f5f7fc; }
	.icp-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
	.icp-adv { font-size: 11px; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--b); color: var(--m); }
	.icp-list { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
	.icp-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
	.icp-k { min-width: 110px; color: var(--m); font-size: 13px; }
	.icp-chip { font-size: 12px; font-weight: 700; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--b); }
	.icp-chip.ok { background: rgba(15,169,154,.18); color: #0fa99a; border-color: rgba(15,169,154,.5); }
	.icp-chip.bad { background: rgba(255,140,105,.16); color: #e0613c; border-color: rgba(255,140,105,.55); }
	.icp-chip.unk { background: rgba(255,180,0,.14); color: #b37a00; border-color: rgba(255,180,0,.5); }
	.icp-chip.na { color: var(--m); }
	:host-context(body:not(.light-theme)) .icp-chip.bad { color: #ff9a7c; }
	:host-context(body:not(.light-theme)) .icp-chip.unk { color: #ffc940; }
	.icp-reason { color: var(--m); font-size: 11px; }
	.icp-state { margin: 0 0 8px; font-weight: 700; }
	.icp-note { margin: 0; font-size: 12px; color: var(--m); line-height: 1.7; }
	`],
})
export class IdentityCheckPanel {
	private api = inject(IdentityCheckService);
	userId = input.required<string>();
	party = input.required<IdentityParty>();
	c = signal<IdentityCheckAdmin | null>(null);
	loading = signal(false);
	error = signal('');
	inProgress = computed(() => { const s = this.c(); return !!s && (s.state === 'QUEUED' || s.state === 'RUNNING'); });
	rows = computed(() => {
		const f = this.c()?.fields;
		if (!f) return [];
		return FIELD_LABELS.map(({ key, label }) => {
			const res: IdentityFieldResult = f[key] ?? { status: 'COULD_NOT_VERIFY' };
			return { key, label, res, text: STATUS_LABELS[res.status] ?? STATUS_LABELS['COULD_NOT_VERIFY'], cls: STATUS_CLASS[res.status] ?? 'unk' };
		});
	});
	constructor() {
		effect(() => {
			const id = this.userId(); const party = this.party();
			this.c.set(null); this.error.set(''); this.loading.set(true);
			this.api.getAdminCheck(id, party).subscribe({
				next: (r) => { this.c.set(r); this.loading.set(false); },
				error: (e) => { this.loading.set(false); this.error.set(e?.status === 403 ? 'ليست لديك صلاحية عرض نتيجة الفحص الآلي' : 'لم يُفحص آليًا — راجعها يدويًا'); },
			});
		});
	}
}
