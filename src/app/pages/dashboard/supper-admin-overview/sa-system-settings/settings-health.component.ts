import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { WsDatePipe } from '../../../../shared/ws-date/ws-date.pipe';
import { firstValueFrom } from 'rxjs';
import { mapHttpError } from '../../../../core/forms/http-error';
import { HealthItem, SystemSettingsApi } from '../../../../core/services/system-settings.store';

const STATUS: Record<HealthItem['status'], { text: string; color: string }> = {
	ok: { text: 'يعمل', color: '#0FA99A' }, down: { text: 'لا يستجيب', color: '#FF5C5C' }, configured: { text: 'مهيّأ', color: '#5DA0FF' }, unconfigured: { text: 'غير مهيّأ', color: '#FFB400' }, unavailable: { text: 'غير متاح', color: '#6B7699' },
};

/** «صحة النظام»: only facts the server can really measure (process, database round-trip, configuration state). Loading, failure and success are separate states; nothing is a sample number. */
@Component({
	selector: 'app-settings-health',
	standalone: true,
	imports: [WsDatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
	<div class="sh-card" data-testid="health-card">
	  <div class="sh-hdr"><div class="sh-ttl"><svg data-ws-icon="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>صحة النظام</div><button type="button" class="sh-btn" data-testid="health-refresh" [disabled]="loading()" (click)="load()">{{ loading() ? 'جارٍ الفحص…' : 'إعادة الفحص' }}</button></div>
	  @if (error()) { <div class="sh-err" role="alert" data-testid="health-error">{{ error() }} <button type="button" class="sh-btn" (click)="load()">إعادة المحاولة</button></div> }
	  @else if (loading() && !items().length) { <div class="sh-empty" role="status">جارٍ فحص المكوّنات…</div> }
	  @else {
	    @for (h of items(); track h.key) {
	      <div class="sh-row" [attr.data-testid]="'health-' + h.key"><span class="sh-dot" [style.background]="st(h).color"></span><span class="sh-name">{{ h.label }}@if (h.detail && h.detail.length > 34) { <button type="button" class="sh-help-btn" [attr.data-testid]="'health-help-btn-' + h.key" [attr.aria-label]="'تفاصيل: ' + h.label" [attr.aria-expanded]="open().has(h.key)" (click)="toggle(h.key)"><svg data-ws-icon="ws-info" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></button> }</span>@if (h.detail && h.detail.length <= 34) { <span class="sh-detail-s">{{ h.detail }}</span> }<span class="sh-val" [style.color]="st(h).color">{{ st(h).text }}</span>@if (open().has(h.key) && h.detail && h.detail.length > 34) { <div class="sh-detail" [attr.data-testid]="'health-detail-' + h.key">{{ h.detail }}</div> }</div>
	    }
	    @if (checkedAt()) { <div class="sh-foot">آخر فحص: {{ checkedAt() | wsDate:'datetime':'yyyy-MM-dd HH:mm' }}</div> }
	  }
	</div>`,
	styles: [`
	:host{display:block}
	.sh-card{background:linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:18px 20px;margin-bottom:14px}
	.sh-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:10px}.sh-ttl{font-size:14px;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px}.sh-ttl svg{width:15px;height:15px;color:#2BD4C7;flex-shrink:0}
	.sh-row{display:flex;align-items:center;gap:10px;padding:11px 14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:9px;margin-bottom:6px;flex-wrap:wrap}.sh-row:last-of-type{margin-bottom:0}
	.sh-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}.sh-name{font-size:13px;color:#A8B2D1;flex:1;margin-inline-start:0;display:flex;align-items:center;gap:6px}.sh-detail{flex-basis:100%;order:3;font-size:11px;line-height:1.7;color:#6B7699;padding-top:6px;border-top:1px solid rgba(255,255,255,.05)}@media(max-width:700px){.sh-detail-s{flex-basis:100%;order:3}}.sh-detail-s{font-size:11px;color:#6B7699}.sh-help-btn{display:inline-flex;width:14px;height:14px;padding:0;border:0;background:transparent;color:#6B7699;cursor:pointer}.sh-help-btn:hover,.sh-help-btn[aria-expanded=true]{color:#2BD4C7}.sh-val{font-size:12px;font-weight:700}
	.sh-btn{background:none;border:1px solid rgba(43,212,199,.35);color:#2BD4C7;border-radius:8px;padding:5px 12px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer}.sh-btn:disabled{opacity:.5;cursor:default}
	.sh-err{font-size:12.5px;color:#FF8C69;display:flex;gap:10px;align-items:center;flex-wrap:wrap}.sh-empty{font-size:12px;color:#6B7699}.sh-foot{font-size:10.5px;color:#6B7699;margin-top:8px}
	:host-context(.light-theme) .sh-card,:host-context(.theme-light) .sh-card{background:#fff;border-color:#E7EAF1}:host-context(.light-theme) .sh-ttl svg,:host-context(.theme-light) .sh-ttl svg{color:#0F8A7F}
	:host-context(.light-theme) .sh-ttl,:host-context(.theme-light) .sh-ttl{color:#0F172A}
	:host-context(.light-theme) .sh-row,:host-context(.theme-light) .sh-row{background:#F8FAFC;border-color:#E2E8F0}
	:host-context(.light-theme) .sh-name,:host-context(.theme-light) .sh-name{color:#334155}
	:host-context(.light-theme) .sh-detail,:host-context(.theme-light) .sh-detail{border-top-color:#E7EAF1}:host-context(.light-theme) .sh-help-btn,:host-context(.theme-light) .sh-help-btn{color:#64748B}
	`],
})
export class SettingsHealthComponent implements OnInit {
	private api = inject(SystemSettingsApi);
	readonly items = signal<HealthItem[]>([]); readonly loading = signal(false); readonly error = signal(''); readonly checkedAt = signal('');
	ngOnInit() { void this.load(); }
	readonly open = signal<ReadonlySet<string>>(new Set());
	toggle(k: string) { this.open.update(o => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; }); }
	st(h: HealthItem) { return STATUS[h.status] ?? STATUS.unavailable; }
	async load() {
		this.loading.set(true); this.error.set('');
		try { const r = await firstValueFrom(this.api.health()); this.items.set(r.data.items); this.checkedAt.set(r.data.checkedAt); }
		catch (e) { this.error.set(mapHttpError(e, { fallback: 'تعذّر فحص صحة النظام.' }).message); }
		finally { this.loading.set(false); }
	}
}
