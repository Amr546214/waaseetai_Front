import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { CancelRequest, CancelSide, MutualCancelService } from '../../core/services/mutual-cancel.service';

/**
 * «الإلغاء بالتراضي» — the tile (in the project's quick-action row), the request modal and the state card, shared by the client and the provider project pages.
 * Everything shown comes from the server (POST/GET /…/cancellation-requests): the state is stored, visible to both parties and to the administration.
 * MONEY IS OFF: accepting records the agreement only; the text says so on purpose (no refund / settlement rule is approved yet).
 * Variants (`variant`): 'tile' = the button + the modal; 'card' = the state card (only while a request is open or agreed), which opens the same modal.
 */
@Component({
	selector: 'app-mutual-cancel',
	standalone: true,
	imports: [DatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
@if (variant() === 'tile') {
	<button type="button" class="mc-tile" data-testid="open-mutual-cancel" (click)="open()" [disabled]="!!blockedReason()" [attr.title]="blockedReason()">
		<span class="qi"><svg data-ws-icon="ws-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>
		إلغاء بالتراضي@if (openRequest(); as r) { <span class="mc-dot" data-testid="mutual-cancel-dot" [attr.title]="r.statusLabel"></span> }
	</button>
}
@if (modal()) {
		<div class="mc-ov" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="mc-title" data-testid="mutual-cancel-modal" (click)="backdrop($event)">
			<div class="mc-box">
				<div class="mc-hd">
					<span class="mi"><svg data-ws-icon="ws-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>
					<div><h3 id="mc-title">إلغاء المشروع بالتراضي</h3><p>يُفتح طلب إلغاء ويتحوّل للشات والإدارة للاتفاق والموافقة من الطرفين</p></div>
					<button type="button" class="mc-x" aria-label="إغلاق" data-testid="mutual-cancel-close" [disabled]="busy()" (click)="close()"><svg data-ws-icon="ws-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
				</div>
				<ol class="mc-flow" aria-label="خطوات الإلغاء بالتراضي"><li [class.on]="step() === 1"><b>1</b> طلب إلغاء</li><li [class.on]="step() === 2"><b>2</b> شات وإدارة</li><li [class.on]="step() === 3"><b>3</b> موافقة الطرفين</li></ol>
				<div class="mc-warn" role="note" data-testid="mutual-cancel-money-note"><svg data-ws-icon="pl-client-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg><span>{{ moneyNote() }}</span></div>

				@if (loading()) { <p class="mc-muted" data-testid="mutual-cancel-loading">جارٍ التحميل...</p> }
				@else if (loadError()) { <div class="mc-err" role="alert" data-testid="mutual-cancel-load-error">{{ loadError() }} <button type="button" class="mc-btn mc-gh" (click)="reload()">إعادة المحاولة</button></div> }
				@else if (openRequest(); as r) {
					<div class="mc-state" data-testid="mutual-cancel-state">
						<div class="mc-row"><span>الحالة</span><b data-testid="mutual-cancel-status" [class.ok]="r.status === 'ACCEPTED'">{{ r.statusLabel }}</b></div>
						<div class="mc-row"><span>طلبه</span><b>{{ r.requestedByRole === 'CLIENT' ? r.clientName : r.providerName }} ({{ r.requestedByRole === 'CLIENT' ? 'العميل' : 'مقدم الخدمة' }})</b></div>
						<div class="mc-row"><span>التاريخ</span><b>{{ r.createdAt | date:'yyyy/MM/dd HH:mm' }}</b></div>
						<div class="mc-blk"><span>سبب الإلغاء</span><p data-testid="mutual-cancel-reason">{{ r.reason }}</p></div>
						@if (r.note) { <div class="mc-blk"><span>ملاحظة</span><p>{{ r.note }}</p></div> }
						@if (r.responseNote) { <div class="mc-blk"><span>رد الطرف الآخر</span><p>{{ r.responseNote }}</p></div> }
						@if (r.settlementLabel) { <div class="mc-warn" role="note" data-testid="mutual-cancel-settlement">{{ r.settlementLabel }}</div> }
					</div>
					@if (error()) { <div class="mc-err" role="alert" data-testid="mutual-cancel-error">{{ error() }}</div> }
					@if (r.canRespond) {
						<label class="mc-lb" for="mc-resp">ملاحظة على ردك (اختياري)</label>
						<textarea id="mc-resp" class="mc-in" rows="2" maxlength="2000" [value]="responseNote()" (input)="responseNote.set($any($event.target).value)" [disabled]="busy()"></textarea>
						<div class="mc-act"><button type="button" class="mc-btn mc-pri" data-testid="mutual-cancel-accept" [disabled]="busy()" (click)="answer('accept')">{{ busy() ? 'جارٍ الإرسال...' : 'موافقة على الإلغاء' }}</button><button type="button" class="mc-btn mc-gh" data-testid="mutual-cancel-reject" [disabled]="busy()" (click)="answer('reject')">رفض</button></div>
					} @else if (r.canWithdraw) {
						<div class="mc-act"><button type="button" class="mc-btn mc-gh" data-testid="mutual-cancel-withdraw" [disabled]="busy()" (click)="withdraw()">{{ busy() ? 'جارٍ السحب...' : 'سحب الطلب' }}</button><button type="button" class="mc-btn mc-pri" data-testid="mutual-cancel-chat" (click)="toChat()">فتح الشات</button></div>
					} @else { <div class="mc-act"><button type="button" class="mc-btn mc-pri" data-testid="mutual-cancel-chat" (click)="toChat()">فتح الشات</button></div> }
				} @else if (!eligibility().canRequest) {
					<div class="mc-err" role="note" data-testid="mutual-cancel-ineligible">{{ eligibility().reason }}</div>
					@if (last(); as p) { <p class="mc-muted" data-testid="mutual-cancel-last">آخر طلب: {{ p.statusLabel }} — {{ p.reason }}</p> }
				} @else {
					@if (last(); as p) { <p class="mc-muted" data-testid="mutual-cancel-last">آخر طلب: {{ p.statusLabel }} — {{ p.reason }}</p> }
					<label class="mc-lb" for="mc-reason">سبب الإلغاء <em>مطلوب</em></label>
					<input id="mc-reason" class="mc-in" type="text" maxlength="200" data-testid="mutual-cancel-reason-input" placeholder="مثال: تغيّرت احتياجات المشروع" [attr.aria-invalid]="reasonError() ? 'true' : null" [value]="reason()" (input)="reason.set($any($event.target).value); reasonError.set('')" [disabled]="busy()">
					@if (reasonError()) { <div class="mc-err" role="alert" data-testid="mutual-cancel-reason-error">{{ reasonError() }}</div> }
					<label class="mc-lb" for="mc-note">{{ side() === 'client' ? 'ملاحظة لمقدم الخدمة' : 'ملاحظة للعميل' }}</label>
					<textarea id="mc-note" class="mc-in" rows="3" maxlength="2000" data-testid="mutual-cancel-note-input" placeholder="اكتب ملاحظة وديّة توضّح سبب الإلغاء" [value]="note()" (input)="note.set($any($event.target).value)" [disabled]="busy()"></textarea>
					@if (error()) { <div class="mc-err" role="alert" data-testid="mutual-cancel-error">{{ error() }}</div> }
					<div class="mc-act"><button type="button" class="mc-btn mc-warnbtn" data-testid="mutual-cancel-submit" [disabled]="busy()" (click)="submit()">{{ busy() ? 'جارٍ الإرسال...' : 'إرسال الطلب وفتح الشات' }}</button><button type="button" class="mc-btn mc-gh" data-testid="mutual-cancel-back" [disabled]="busy()" (click)="close()">تراجع</button></div>
				}
			</div>
		</div>
}
@if (variant() === 'card') {
	@if (openRequest(); as r) {
		<div class="mc-card" dir="rtl" role="status" data-testid="mutual-cancel-card">
			<div><b>إلغاء بالتراضي — {{ r.statusLabel }}</b><span>{{ r.canRespond ? 'بانتظار ردك على الطلب' : (r.status === 'ACCEPTED' ? 'اتفق الطرفان؛ لم يُنقل أي مبلغ' : 'بانتظار رد الطرف الآخر') }}</span></div>
			<button type="button" class="mc-btn mc-gh" data-testid="mutual-cancel-card-open" (click)="open()">عرض الطلب</button>
		</div>
	}
}`,
	styles: [`
:host{display:contents}
.mc-tile{position:relative;display:flex;flex-direction:column;align-items:center;gap:7px;padding:14px 8px;border-radius:12px;background:var(--sec-bg);border:1px solid var(--sec-bd);color:var(--txt);font-size:var(--font-size-small);font-weight:700;font-family:inherit;cursor:pointer;transition:transform .16s,border-color .16s}
.mc-tile:hover:not(:disabled){transform:translateY(-2px);border-color:var(--txt-3)}.mc-tile:disabled{opacity:.55;cursor:not-allowed}
:host-context(.light-theme) .mc-tile,:host-context(.theme-light) .mc-tile{background:#fff;border-color:#E7EAF1;box-shadow:0 2px 10px rgba(15,23,42,.05);color:#0F172A}
.mc-tile .qi{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:rgba(255,140,105,.14);color:#FF8C69}.mc-tile .qi svg{width:16px;height:16px}
.mc-dot{position:absolute;top:8px;inset-inline-end:8px;width:9px;height:9px;border-radius:50%;background:#FFB400}
.mc-ov{position:fixed;inset:0;z-index:600;background:rgba(7,13,36,.7);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px}
.mc-box{width:100%;max-width:520px;max-height:92vh;overflow-y:auto;background:var(--modal-bg,#0B1437);color:var(--txt);border:1px solid var(--sec-bd);border-radius:18px;padding:22px;box-shadow:0 25px 80px rgba(0,0,0,.5);text-align:right}
:host-context(.light-theme) .mc-box,:host-context(.theme-light) .mc-box{background:#fff}
.mc-hd{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px}.mc-hd>div{flex:1}
.mc-hd h3{margin:0 0 3px;font-size:var(--font-size-body);font-weight:900}.mc-hd p{margin:0;font-size:var(--font-size-small);color:var(--txt-2);line-height:1.5}
.mi{width:38px;height:38px;border-radius:11px;background:rgba(255,140,105,.12);color:#FF8C69;display:flex;align-items:center;justify-content:center;flex-shrink:0}.mi svg{width:18px;height:18px}
.mc-x{width:30px;height:30px;border-radius:8px;background:var(--sec-bg);border:1px solid var(--sec-bd);color:var(--txt-2);cursor:pointer;display:flex;align-items:center;justify-content:center}.mc-x svg{width:15px;height:15px}
.mc-flow{list-style:none;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:0 0 14px;padding:11px;border:1px solid var(--sec-bd);border-radius:11px;background:var(--sec-bg);font-size:var(--font-size-small);font-weight:700;color:var(--txt-2)}
.mc-flow li b{display:inline-flex;width:20px;height:20px;border-radius:50%;align-items:center;justify-content:center;background:rgba(43,127,255,.16);color:var(--blue-txt);margin-inline-end:4px}.mc-flow li.on{color:var(--txt)}
.mc-warn{display:flex;gap:8px;align-items:flex-start;padding:11px 12px;margin-bottom:14px;border-radius:11px;border:1px solid rgba(255,180,0,.3);background:rgba(255,180,0,.07);color:#E0A100;font-size:var(--font-size-small);line-height:1.6}
:host-context(.light-theme) .mc-warn,:host-context(.theme-light) .mc-warn{color:var(--kahr)}
.mc-warn svg{width:16px;height:16px;flex-shrink:0;margin-top:2px}
.mc-lb{display:block;margin:10px 0 6px;font-size:var(--font-size-small);font-weight:800}.mc-lb em{font-style:normal;color:#FF8C69;font-size:var(--font-size-small)}
.mc-in{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:11px;border:1px solid var(--sec-bd);background:var(--sec-bg);color:var(--txt);font:inherit}.mc-in:focus{outline:none;border-color:var(--teal)}
.mc-in[aria-invalid="true"]{border-color:var(--red,#B42318)}
.mc-err{margin:8px 0;padding:9px 11px;border-radius:9px;border:1px solid rgba(255,107,107,.35);background:rgba(255,107,107,.08);color:#FF8F8F;font-size:var(--font-size-small)}
:host-context(.light-theme) .mc-err,:host-context(.theme-light) .mc-err{color:var(--red)}
.mc-muted{color:var(--txt-2);font-size:var(--font-size-small);margin:6px 0}
.mc-act{display:flex;gap:9px;margin-top:14px}.mc-act .mc-btn{flex:1}
.mc-btn{padding:12px 14px;border-radius:11px;font:inherit;font-weight:800;cursor:pointer;border:1px solid var(--sec-bd);color:var(--txt);background:var(--sec-bg)}
.mc-btn:disabled{opacity:.55;cursor:not-allowed}
.mc-pri{background:linear-gradient(135deg,#2BD4C7,#2B7FFF);border-color:transparent;color:#04101f}
.mc-warnbtn{background:linear-gradient(135deg,#FFB02E,#FF8C69);border-color:transparent;color:#2a1600}
.mc-state{border:1px solid var(--sec-bd);border-radius:12px;padding:12px;background:var(--sec-bg)}
.mc-row{display:flex;justify-content:space-between;gap:10px;padding:5px 0;font-size:var(--font-size-small)}.mc-row span{color:var(--txt-2)}.mc-row b.ok{color:var(--teal-txt)}
.mc-blk{padding:6px 0;font-size:var(--font-size-small)}.mc-blk span{color:var(--txt-2)}.mc-blk p{margin:3px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
.mc-card{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;padding:12px 14px;border-radius:13px;border:1px solid rgba(255,180,0,.3);background:rgba(255,180,0,.07);color:var(--txt)}
.mc-card div{display:flex;flex-direction:column;gap:2px;font-size:var(--font-size-small)}.mc-card span{color:var(--txt-2)}
@media(max-width:520px){.mc-box{padding:16px}.mc-act{flex-direction:column-reverse}}
`]
})
export class MutualCancelComponent implements OnInit {
	private api = inject(MutualCancelService);
	private router = inject(Router);
	private destroy = inject(DestroyRef);

	side = input.required<CancelSide>();
	projectKey = input.required<string>();
	variant = input<'tile' | 'card'>('tile');
	/** why the tile is disabled (e.g. the contract is not active); null = enabled */
	blockedReason = input<string | null>(null);

	modal = signal(false); loading = signal(true); loadError = signal(''); busy = signal(false); error = signal('');
	requests = signal<CancelRequest[]>([]);
	eligibility = signal<{ canRequest: boolean; reason: string | null }>({ canRequest: true, reason: null });
	moneyNote = signal('لا يُنقل أو يُردّ أي مبلغ بمجرد الموافقة، ولا يتغيّر العقد أو الضمان أو المراحل. تسوية المبالغ في الإلغاء بالتراضي لم تُفعَّل بعد.');
	reason = signal(''); note = signal(''); responseNote = signal(''); reasonError = signal('');
	/** one key per opened form: a double click or a retry after a timeout can never create a second request */
	private requestKey = '';
	openRequest = computed(() => this.requests().find(r => r.status === 'PENDING_OTHER_PARTY' || r.status === 'ACCEPTED') ?? null);
	last = computed(() => this.requests().find(r => r.status === 'REJECTED' || r.status === 'WITHDRAWN') ?? null);
	step = computed(() => { const r = this.openRequest(); return !r ? 1 : r.status === 'ACCEPTED' ? 3 : 2; });

	ngOnInit() { this.reload(); const t = setInterval(() => { if (!this.modal() && !this.busy()) this.reload(true); }, 30000); this.destroy.onDestroy(() => clearInterval(t)); }

	reload(silent = false) {
		if (!silent) { this.loading.set(true); this.loadError.set(''); }
		this.api.list(this.side(), this.projectKey()).subscribe({
			next: res => { const d = res?.data; this.requests.set(Array.isArray(d?.requests) ? d.requests : []); this.eligibility.set(d?.eligibility ?? { canRequest: true, reason: null }); if (d?.moneyNote) this.moneyNote.set(d.moneyNote); this.loading.set(false); },
			error: err => { if (!silent) { this.loading.set(false); this.loadError.set(err?.error?.message || 'تعذر تحميل حالة طلب الإلغاء'); } }
		});
	}
	open() { this.error.set(''); this.reasonError.set(''); this.requestKey = crypto.randomUUID(); this.modal.set(true); this.reload(); }
	close() { if (!this.busy()) this.modal.set(false); }
	backdrop(e: Event) { if (e.target === e.currentTarget) this.close(); }

	private fail(err: any, fallback: string) {
		this.busy.set(false);
		const field = err?.error?.errors?.find?.((x: any) => x?.field === 'reason');
		if (field) this.reasonError.set(field.message);
		else this.error.set(err?.error?.message || fallback);
		// a conflict means the server state moved on (answered / withdrawn / dispute): show the real current state
		if (err?.status === 409 || err?.status === 404) this.reload(true);
	}
	toChat() {
		const base = this.side() === 'client' ? ['/client-overview/projects', this.projectKey()] : ['/provider-overview/projects/active/progress', this.projectKey()];
		this.modal.set(false); void this.router.navigate(base, { queryParams: { tab: 'messages' } });
	}
	submit() {
		if (this.busy()) return;
		const reason = this.reason().trim();
		if (reason.length < 3) { this.reasonError.set('اكتب سبب الإلغاء'); return; }
		this.busy.set(true); this.error.set('');
		this.api.create(this.side(), this.projectKey(), { reason, note: this.note().trim() || undefined, requestKey: this.requestKey }).subscribe({
			next: res => { this.busy.set(false); this.requests.set([res.data, ...this.requests().filter(r => r.id !== res.data.id)]); this.reason.set(''); this.note.set(''); this.toChat(); },
			error: err => this.fail(err, 'تعذر إرسال طلب الإلغاء')
		});
	}
	answer(decision: 'accept' | 'reject') {
		const r = this.openRequest(); if (!r || this.busy()) return;
		this.busy.set(true); this.error.set('');
		this.api.respond(this.side(), r.id, decision, this.responseNote().trim() || undefined).subscribe({
			next: res => { this.busy.set(false); this.responseNote.set(''); this.requests.set(this.requests().map(x => x.id === res.data.id ? res.data : x)); },
			error: err => this.fail(err, 'تعذر إرسال ردك')
		});
	}
	withdraw() {
		const r = this.openRequest(); if (!r || this.busy()) return;
		this.busy.set(true); this.error.set('');
		this.api.withdraw(this.side(), r.id).subscribe({
			next: res => { this.busy.set(false); this.requests.set(this.requests().map(x => x.id === res.data.id ? res.data : x)); },
			error: err => this.fail(err, 'تعذر سحب الطلب')
		});
	}
}
