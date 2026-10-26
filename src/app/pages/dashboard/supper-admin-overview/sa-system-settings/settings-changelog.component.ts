import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { WsDatePipe } from '../../../../shared/ws-date/ws-date.pipe';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { mapHttpError } from '../../../../core/forms/http-error';
import { SettingsHistoryItem, SystemSettingsApi, SystemSettingsStore } from '../../../../core/services/system-settings.store';
import { AdminAccessService } from '../../../../core/services/admin-access.service';

const show = (v: unknown) => (v === true ? 'مفعّل' : v === false ? 'غير مفعّل' : v === null || v === undefined || v === '' ? '—' : String(v));

/** «سجل تغييرات الإعدادات»: the real events (who, when, from which address, before → after). Reloads after every successful save; empty, loading and failed are different states. */
@Component({
	selector: 'app-settings-changelog',
	standalone: true,
	imports: [WsDatePipe, DatePipe, RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
	<div class="cl-card" data-testid="changelog">
	  <div class="cl-ttl">سجل تغييرات الإعدادات (Change Log)</div>
	  @if (error()) { <div class="cl-err" role="alert" data-testid="changelog-error">{{ error() }} <button type="button" class="cl-link" (click)="load()">إعادة المحاولة</button></div> }
	  @else if (loading() && !rows().length) { <div class="cl-empty" role="status">جارٍ تحميل السجل…</div> }
	  @else if (!rows().length) { <div class="cl-empty" data-testid="changelog-empty">لا توجد تغييرات مسجّلة بعد.</div> }
	  @else {
	    <div class="cl-list">
	      @for (r of rows(); track r.id) {
	        <div class="cl-row" [class.warn]="r.severity === 'WARNING'" data-testid="changelog-row">
	          <span class="cl-time">{{ r.at | wsDate:'datetime':'yyyy-MM-dd HH:mm' }}</span>
	          <span class="cl-msg"><b>{{ r.actor || 'حساب إداري' }}</b> غيّر @for (c of r.changes; track c.key; let last = $last) { <span class="cl-chg">{{ c.label }}: من {{ fmt(c.from) }} ← {{ fmt(c.to) }}</span>@if (!last) { ، } }</span>
	          @if (r.ip) { <span class="cl-ip" [class.warn]="r.severity === 'WARNING'">IP: {{ r.ip }}@if (r.severity === 'WARNING') { ⚠ }</span> }
	        </div>
	      }
	    </div>
	  }
	  @if (access.can('audit.view')) { <a class="cl-link" routerLink="/supper-admin-overview/audit-trail">عرض السجل الكامل في Audit Trail ←</a> }
	</div>`,
	styles: [`
	:host{display:block}
	.cl-card{background:rgba(43,127,255,.05);border:1px solid rgba(43,127,255,.16);border-radius:12px;padding:14px 18px;margin:0 0 14px}
	.cl-ttl{font-size:13px;font-weight:800;color:#5DA0FF;margin-bottom:12px}.cl-list{display:flex;flex-direction:column;gap:6px;font-size:12px}
	.cl-row{display:flex;gap:10px;padding:8px 10px;background:rgba(43,127,255,.04);border:1px solid rgba(43,127,255,.12);border-radius:8px;flex-wrap:wrap}.cl-row.warn{background:rgba(255,180,0,.04);border-color:rgba(255,180,0,.12)}
	.cl-time{font-family:monospace;color:#6B7699;flex-shrink:0}.cl-msg{flex:1;color:#A8B2D1;min-width:180px}.cl-ip{color:#5DA0FF;flex-shrink:0;font-weight:700}.cl-chg{color:#E7EAF1}
	.cl-ip.warn{color:#FFB400}
	.cl-link{display:inline-block;margin-top:10px;background:none;border:none;color:#5DA0FF;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;padding:0;text-decoration:none}
	.cl-empty{font-size:12px;color:#6B7699}.cl-err{font-size:12.5px;color:#FF8C69}
	:host-context(.light-theme) .cl-time,:host-context(.theme-light) .cl-time{color:#64748B}:host-context(.light-theme) .cl-card,:host-context(.theme-light) .cl-card{background:rgba(43,127,255,.05)}
	:host-context(.light-theme) .cl-msg,:host-context(.theme-light) .cl-msg{color:#475569}:host-context(.light-theme) .cl-chg,:host-context(.theme-light) .cl-chg{color:#0F172A}
	`],
})
export class SettingsChangelogComponent implements OnInit {
	private api = inject(SystemSettingsApi); private store = inject(SystemSettingsStore); readonly access = inject(AdminAccessService);
	readonly rows = signal<SettingsHistoryItem[]>([]); readonly loading = signal(false); readonly error = signal('');
	readonly limit = input<number>(10);
	private seen: unknown = null;
	ngOnInit() { void this.load(); }
	fmt = show;
	/** called by the page after a successful save */
	refresh() { return this.load(); }
	async load() {
		this.loading.set(true); this.error.set('');
		try { this.rows.set((await firstValueFrom(this.api.history(this.limit()))).data); }
		catch (e) { this.error.set(mapHttpError(e, { fallback: 'تعذّر تحميل سجل التغييرات.' }).message); }
		finally { this.loading.set(false); }
	}
}
