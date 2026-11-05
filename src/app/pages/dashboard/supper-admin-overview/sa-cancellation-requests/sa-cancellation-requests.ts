import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CancelRequest, MutualCancelService } from '../../../../core/services/mutual-cancel.service';

/**
 * «الإلغاء بالتراضي» — administration view. READ-ONLY on purpose: who in the administration approves a mutual cancellation and what happens to the money are not decided yet,
 * so there is no approve / refund button here (the page says so). Everything shown comes from GET /api/admin/cancellation-requests.
 */
@Component({
	selector: 'app-sa-cancellation-requests',
	standalone: true,
	imports: [DatePipe, RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
<section class="cr" dir="rtl">
	<div class="cr-hd"><div><h1>طلبات الإلغاء بالتراضي</h1><p>طلبات يفتحها أحد طرفي العقد النشط ويرد عليها الطرف الآخر. للاطلاع فقط: لم يُفعَّل بعد أي نقل للمبالغ.</p></div><a routerLink="/supper-admin-overview/disputes" class="cr-btn">النزاعات</a></div>
	<div class="cr-note" role="note" data-testid="cr-admin-note">اعتماد الإدارة وتسوية المبالغ لهذا النوع من الإلغاء غير مُفعَّلين حتى يُقرَّ القرار المالي؛ الموافقة بين الطرفين تُسجَّل فقط ولا تغيّر العقد أو الضمان.</div>
	<div class="cr-tabs">@for (f of filters; track f.key) { <button type="button" class="cr-tab" [class.on]="status() === f.key" (click)="setStatus(f.key)">{{ f.label }}@if (counts()[f.key] !== undefined) { <b>{{ counts()[f.key] }}</b> }</button> }</div>
	@if (loading()) { <p class="cr-muted" data-testid="cr-loading">جارٍ التحميل...</p> }
	@else if (error()) { <div class="cr-err" role="alert">{{ error() }} <button type="button" class="cr-btn" (click)="load()">إعادة المحاولة</button></div> }
	@else if (!items().length) { <p class="cr-muted" data-testid="cr-empty">لا توجد طلبات في هذا التصنيف</p> }
	@else {
		<div class="cr-list">@for (r of items(); track r.id) {
			<button type="button" class="cr-card" [class.sel]="selected()?.id === r.id" [attr.data-testid]="'cr-item'" (click)="open(r.id)">
				<div class="cr-top"><b>{{ r.projectTitle || r.contractRef }}</b><span class="cr-badge" [class.ok]="r.status === 'ACCEPTED'">{{ r.statusLabel }}</span></div>
				<div class="cr-meta">{{ r.clientName }} ↔ {{ r.providerName }} · {{ r.createdAt | date:'yyyy/MM/dd HH:mm' }}</div>
			</button> }
		</div>
	}
	@if (detailError()) { <div class="cr-err" role="alert" data-testid="cr-detail-error">{{ detailError() }}</div> }
	@if (selected(); as r) {
		<div class="cr-detail" data-testid="cr-detail">
			<h2>{{ r.projectTitle || r.contractRef }} <small>{{ r.contractRef }}</small></h2>
			<div class="cr-row"><span>الحالة</span><b>{{ r.statusLabel }}</b></div>
			<div class="cr-row"><span>العميل</span><b>{{ r.clientName }}</b></div><div class="cr-row"><span>مقدم الخدمة</span><b>{{ r.providerName }}</b></div>
			<div class="cr-row"><span>طلبه</span><b>{{ r.requestedByRole === 'CLIENT' ? 'العميل' : 'مقدم الخدمة' }}</b></div>
			<div class="cr-row"><span>حالة العقد</span><b>{{ r.contractStatus }}</b></div>
			<div class="cr-blk"><span>السبب</span><p>{{ r.reason }}</p></div>@if (r.note) { <div class="cr-blk"><span>ملاحظة</span><p>{{ r.note }}</p></div> }@if (r.responseNote) { <div class="cr-blk"><span>رد الطرف الآخر</span><p>{{ r.responseNote }}</p></div> }
			@if (r.respondedAt) { <div class="cr-row"><span>تاريخ الرد</span><b>{{ r.respondedAt | date:'yyyy/MM/dd HH:mm' }}</b></div> }
			@if (r.financial; as f) {
				<div class="cr-fin" data-testid="cr-financial"><div class="cr-row"><span>قيمة العقد</span><b>{{ f.contractPrice }} $</b></div>
				@if (f.escrowAmount !== null) { <div class="cr-row"><span>إجمالي الضمان</span><b>{{ f.escrowAmount }} $</b></div><div class="cr-row"><span>أُفرج</span><b>{{ f.escrowReleased }} $</b></div><div class="cr-row"><span>محتجز</span><b>{{ f.escrowHeld }} $</b></div> } @else { <p class="cr-muted">لا يوجد ضمان مسجّل لهذا العقد</p> }</div>
			}
			@if (r.settlementLabel) { <div class="cr-note" data-testid="cr-settlement">{{ r.settlementLabel }}</div> }
			<p class="cr-muted">{{ r.moneyNote }}</p>
		</div>
	}
</section>`,
	styles: [`
.cr{padding:8px 2px;color:var(--txt);max-width:900px}.cr-hd{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.cr-hd h1{margin:0 0 4px;font-size:var(--font-size-h3,20px)}.cr-hd p,.cr-muted{margin:0;color:var(--txt-2);font-size:var(--font-size-small)}
.cr-note{padding:10px 12px;margin:0 0 12px;border-radius:11px;border:1px solid rgba(255,180,0,.3);background:rgba(255,180,0,.07);font-size:var(--font-size-small);line-height:1.6}
.cr-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.cr-tab,.cr-btn{padding:8px 12px;border-radius:10px;border:1px solid var(--sec-bd);background:var(--sec-bg);color:var(--txt);font:inherit;font-weight:700;cursor:pointer;text-decoration:none}.cr-tab.on{border-color:var(--teal);color:var(--teal-txt)}.cr-tab b{margin-inline-start:6px;color:var(--txt-2)}
.cr-list{display:flex;flex-direction:column;gap:8px}.cr-card{text-align:right;padding:12px;border-radius:12px;border:1px solid var(--sec-bd);background:var(--sec-bg);color:var(--txt);font:inherit;cursor:pointer}.cr-card.sel{border-color:var(--teal)}
.cr-top{display:flex;justify-content:space-between;gap:8px}.cr-meta{color:var(--txt-2);font-size:var(--font-size-small);margin-top:4px}.cr-badge{font-size:var(--font-size-small);padding:2px 9px;border-radius:99px;background:rgba(255,180,0,.14)}.cr-badge.ok{background:rgba(43,212,199,.16);color:var(--teal-txt)}
.cr-detail{margin-top:14px;padding:14px;border-radius:14px;border:1px solid var(--sec-bd);background:var(--sec-bg)}.cr-detail h2{margin:0 0 8px;font-size:var(--font-size-body)}.cr-detail small{color:var(--txt-2)}
.cr-row{display:flex;justify-content:space-between;gap:10px;padding:4px 0;font-size:var(--font-size-small)}.cr-row span{color:var(--txt-2)}.cr-blk{padding:6px 0;font-size:var(--font-size-small)}.cr-blk span{color:var(--txt-2)}.cr-blk p{margin:3px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
.cr-fin{margin:8px 0;padding-top:6px;border-top:1px solid var(--sec-bd)}.cr-err{margin:8px 0;padding:9px 11px;border-radius:9px;border:1px solid rgba(255,107,107,.35);background:rgba(255,107,107,.08);font-size:var(--font-size-small)}
`]
})
export class SaCancellationRequests implements OnInit {
	private api = inject(MutualCancelService);
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	status = signal(''); items = signal<CancelRequest[]>([]); counts = signal<Record<string, number>>({}); loading = signal(true); error = signal('');
	selected = signal<CancelRequest | null>(null); detailError = signal('');
	readonly filters = [{ key: '', label: 'الكل' }, { key: 'PENDING_OTHER_PARTY', label: 'بانتظار الرد' }, { key: 'ACCEPTED', label: 'متفق عليها' }, { key: 'REJECTED', label: 'مرفوضة' }, { key: 'WITHDRAWN', label: 'مسحوبة' }];
	ngOnInit() { this.load(); const id = this.route.snapshot.paramMap.get('id'); if (id) this.open(id, false); }
	setStatus(s: string) { this.status.set(s); this.load(); }
	load() {
		this.loading.set(true); this.error.set('');
		this.api.adminList(this.status() || undefined).subscribe({
			next: r => { this.items.set(r.data.items); const c = r.data.counts ?? {}; this.counts.set({ ...c, '': Object.values<number>(c).reduce((a, b) => a + b, 0) }); this.loading.set(false); },
			error: e => { this.loading.set(false); this.error.set(e?.error?.message || 'تعذر تحميل الطلبات'); }
		});
	}
	open(id: string, navigate = true) {
		this.detailError.set('');
		this.api.adminGet(id).subscribe({ next: r => { this.selected.set(r.data); if (navigate) void this.router.navigate(['/supper-admin-overview/cancellation-requests', id], { replaceUrl: true }); }, error: e => this.detailError.set(e?.error?.message || 'تعذر فتح الطلب') });
	}
}
