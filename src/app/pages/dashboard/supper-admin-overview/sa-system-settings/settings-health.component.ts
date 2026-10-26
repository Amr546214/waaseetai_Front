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
	  <div class="sh-hdr"><div class="sh-ttl">صحة النظام</div><button type="button" class="sh-btn" data-testid="health-refresh" [disabled]="loading()" (click)="load()">{{ loading() ? 'جارٍ الفحص…' : 'إعادة الفحص' }}</button></div>
	  @if (error()) { <div class="sh-err" role="alert" data-testid="health-error">{{ error() }} <button type="button" class="sh-btn" (click)="load()">إعادة المحاولة</button></div> }
	  @else if (loading() && !items().length) { <div class="sh-empty" role="status">جارٍ فحص المكوّنات…</div> }
	  @else {
	    @for (h of items(); track h.key) {
	      <div class="sh-row" [attr.data-testid]="'health-' + h.key"><span class="sh-dot" [style.background]="st(h).color"></span><span class="sh-name">{{ h.label }}</span><span class="sh-detail">{{ h.detail }}</span><span class="sh-val" [style.color]="st(h).color">{{ st(h).text }}</span></div>
	    }
	    @if (checkedAt()) { <div class="sh-foot">آخر فحص: {{ checkedAt() | wsDate:'datetime' }}</div> }
	  }
	</div>`,
	styles: [`
	:host{display:block}
	.sh-card{background:linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:18px 20px;margin-bottom:14px}
	.sh-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:10px}.sh-ttl{font-size:14px;font-weight:800;color:#fff}
	.sh-row{display:flex;align-items:center;gap:10px;padding:11px 14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:9px;margin-bottom:6px;flex-wrap:wrap}
	.sh-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}.sh-name{font-size:13px;color:#A8B2D1;min-width:150px}.sh-detail{font-size:11px;color:#6B7699;flex:1;min-width:160px}.sh-val{font-size:12px;font-weight:700}
	.sh-btn{background:none;border:1px solid rgba(43,212,199,.35);color:#2BD4C7;border-radius:8px;padding:5px 12px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer}.sh-btn:disabled{opacity:.5;cursor:default}
	.sh-err{font-size:12.5px;color:#FF8C69;display:flex;gap:10px;align-items:center;flex-wrap:wrap}.sh-empty{font-size:12px;color:#6B7699}.sh-foot{font-size:10.5px;color:#6B7699;margin-top:8px}
	:host-context(.light-theme) .sh-card,:host-context(.theme-light) .sh-card{background:#fff;border-color:#E2E8F0}
	:host-context(.light-theme) .sh-ttl,:host-context(.theme-light) .sh-ttl{color:#0F172A}
	:host-context(.light-theme) .sh-row,:host-context(.theme-light) .sh-row{background:#F8FAFC;border-color:#E2E8F0}
	:host-context(.light-theme) .sh-name,:host-context(.theme-light) .sh-name{color:#334155}
	`],
})
export class SettingsHealthComponent implements OnInit {
	private api = inject(SystemSettingsApi);
	readonly items = signal<HealthItem[]>([]); readonly loading = signal(false); readonly error = signal(''); readonly checkedAt = signal('');
	ngOnInit() { void this.load(); }
	st(h: HealthItem) { return STATUS[h.status] ?? STATUS.unavailable; }
	async load() {
		this.loading.set(true); this.error.set('');
		try { const r = await firstValueFrom(this.api.health()); this.items.set(r.data.items); this.checkedAt.set(r.data.checkedAt); }
		catch (e) { this.error.set(mapHttpError(e, { fallback: 'تعذّر فحص صحة النظام.' }).message); }
		finally { this.loading.set(false); }
	}
}
