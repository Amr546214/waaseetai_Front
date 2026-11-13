import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { mapHttpError } from '../../core/forms/http-error';

export interface InfraItem { label: string; value: string | number | boolean | null; unit?: string; note?: string }
export interface InfraSection { title: string; source: string; scope: string; measuredAt: string; items?: InfraItem[]; table?: { columns: string[]; rows: Array<Array<string | number | null>> }; unavailable?: { reason: string; requirement: string } }
export const SOURCE_LABELS: Record<string, string> = { process: 'عملية الخلفية', container: 'الحاوية', host: 'الخادم المضيف', database: 'قاعدة البيانات', config: 'إعدادات البيئة', filesystem: 'القرص', 'backup-dir': 'مجلد النسخ', provider: 'المزوّد', 'backup-agent': 'عامل النسخ' };

/** One renderer for the real measurements of «البنية التقنية»: every block says what measured it, over which scope and when; what has no source says so and names the missing requirement. Nothing is invented. */
@Component({
	selector: 'app-infra-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
	<section class="ip" dir="rtl" data-testid="infra-panel">
		<header class="ip-h"><h1 class="ip-t">{{ title }}</h1>
			<button type="button" class="ip-btn" data-testid="infra-refresh" [disabled]="loading()" (click)="load()">{{ loading() ? 'جارٍ القياس…' : 'قياس الآن' }}</button></header>
		@if (error()) { <div class="ip-err" role="alert" data-testid="infra-error">{{ error() }}</div> }
		@if (measuredAt()) { <p class="ip-sub" data-testid="infra-measured-at">آخر قياس: {{ measuredAt() }}</p> }
		@for (s of sections(); track s.title) {
			<article class="ip-card" [attr.data-testid]="'infra-section'">
				<h2 class="ip-ct">{{ s.title }} <span class="ip-tag" data-testid="infra-source">{{ sourceLabel(s.source) }}</span></h2>
				<p class="ip-scope">النطاق: {{ s.scope }} · وقت القياس: {{ s.measuredAt }}</p>
				@if (s.unavailable; as u) { <div class="ip-na" data-testid="infra-unavailable"><b>غير متاح:</b> {{ u.reason }}<br><b>المتطلب:</b> <span dir="ltr">{{ u.requirement }}</span></div> }
				@if (s.items?.length) { <dl class="ip-dl">@for (i of s.items; track i.label) { <div><dt>{{ i.label }}</dt><dd>{{ i.value === null ? '—' : i.value }}{{ i.unit ? ' ' + i.unit : '' }}@if (i.note) { <small> · {{ i.note }}</small> }</dd></div> }</dl> }
				@if (s.table; as t) { <div class="ip-tw"><table class="ip-tbl"><thead><tr>@for (c of t.columns; track c) { <th>{{ c }}</th> }</tr></thead><tbody>
					@for (r of t.rows; track $index) { <tr>@for (v of r; track $index) { <td>{{ v === null ? '—' : v }}</td> }</tr> } @empty { <tr><td [attr.colspan]="t.columns.length">لا بيانات ضمن النطاق.</td></tr> }
				</tbody></table></div> }
			</article>
		}
		<ng-content />
	</section>`,
	styles: [`.ip{padding:20px;max-width:1100px}.ip-h{display:flex;justify-content:space-between;align-items:center;gap:12px}.ip-t{margin:0;font-size:22px}.ip-btn{cursor:pointer;padding:7px 14px;border-radius:8px;border:1px solid var(--ws-border,rgba(255,255,255,.2));background:none;color:inherit}.ip-sub,.ip-scope{font-size:12px;opacity:.7;margin:4px 0 10px}.ip-err{color:#ff6b6b;margin:10px 0}.ip-card{margin:14px 0;padding:16px;border-radius:14px;border:1px solid var(--ws-border,rgba(255,255,255,.12));background:var(--ws-surface,rgba(255,255,255,.03))}.ip-ct{margin:0;font-size:16px}.ip-tag{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:rgba(43,212,199,.14);margin-inline-start:8px}.ip-na{padding:10px 12px;border-radius:10px;background:rgba(255,180,0,.1);font-size:13px;line-height:1.8}.ip-dl{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px 18px;margin:8px 0 0}.ip-dl div{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid rgba(255,255,255,.07);padding:4px 0}.ip-dl dt{opacity:.75}.ip-dl dd{margin:0;font-weight:700}.ip-tw{overflow:auto}.ip-tbl{width:100%;border-collapse:collapse;font-size:13px}.ip-tbl th,.ip-tbl td{text-align:right;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.07)}`],
})
export class InfraPanelComponent implements OnInit {
	@Input({ required: true }) endpoint = ''; @Input({ required: true }) title = '';
	private readonly http = inject(HttpClient); private readonly destroyRef = inject(DestroyRef);
	readonly sections = signal<InfraSection[]>([]); readonly measuredAt = signal(''); readonly loading = signal(false); readonly error = signal('');
	sourceLabel(s: string) { return SOURCE_LABELS[s] ?? s; }
	ngOnInit() { this.load(); }
	load() {
		this.loading.set(true); this.error.set('');
		this.http.get<{ data: { measuredAt: string; sections: InfraSection[] } }>(`${environment.url_api}/admin/infrastructure/${this.endpoint}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: r => { this.sections.set(r.data.sections); this.measuredAt.set(r.data.measuredAt); this.loading.set(false); },
			error: e => { this.error.set(mapHttpError(e, { fallback: 'تعذّر القياس. لم تُعرض أرقام بديلة.' }).message); this.loading.set(false); },
		});
	}
}
