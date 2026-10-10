import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input, output } from '@angular/core';

/** One thing still needed to reach 100% (computed by the backend, so the percentage and this list always agree). */
export interface CompletionBoxItem {
	key: string;
	label: string;
	points: number;
	/** 'pending_review' = submitted and waiting for the review: shown as "قيد المراجعة", never as missing. */
	status: 'missing' | 'pending_review' | 'rejected';
	/** Where it is fixed (the page maps it to a tab / route). */
	tab: string;
	hint: string;
}

/**
 * "لإكمال ملفك إلى 100%، أكمل التالي:" box. Presentational only: it renders the backend `missingItems` and tells the page which
 * item was chosen, so every item can open the right tab. Renders nothing when there are no items.
 */
@Component({
	selector: 'ws-completion-box',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	encapsulation: ViewEncapsulation.None,
	template: `
		@if (items().length) {
		<div class="cbx" data-testid="missing-items" role="region" aria-label="ما ينقص ملفك">
			<div class="cbx-title">{{ hasMissing() ? 'لإكمال ملفك إلى 100%، أكمل التالي:' : 'قيد المراجعة:' }}</div>
			<ul class="cbx-list">
				@for (item of items(); track item.key) {
				<li class="cbx-item" [class.is-pending]="item.status === 'pending_review'" [attr.data-status]="item.status" [attr.data-key]="item.key">
					<button type="button" class="cbx-link" [attr.data-tab]="item.tab" (click)="select.emit(item)">
						<span class="cbx-main">
							<span class="cbx-label">{{ item.label }}</span>
							<span class="cbx-hint">{{ item.hint }}</span>
						</span>
						@if (item.status === 'pending_review') {
						<span class="cbx-badge is-pending" data-testid="miss-pending">قيد المراجعة</span>
						} @else if (item.status === 'rejected') {
						<span class="cbx-badge" data-testid="miss-rejected">مرفوض — يحتاج تعديل</span>
						} @else {
						<span class="cbx-badge" data-testid="miss-missing">ناقص · +{{ item.points }}%</span>
						}
						<span class="cbx-go" aria-hidden="true">←</span>
					</button>
				</li>
				}
			</ul>
		</div>
		}
	`,
	styles: [`
		.cbx{margin:14px 0 18px;padding:14px 16px;border:1px solid var(--border,rgba(255,255,255,.1));border-radius:14px;background:var(--surface,rgba(255,255,255,.03))}
		.cbx-title{font-size:14px;font-weight:800;color:var(--txt,#fff);margin-bottom:10px}
		.cbx-list{list-style:none;margin:0;padding:0;display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
		.cbx-item{min-width:0}
		.cbx-link{width:100%;display:flex;align-items:center;gap:10px;text-align:start;padding:10px 12px;border-radius:12px;border:1px solid rgba(245,158,11,.35);background:rgba(245,158,11,.07);color:var(--txt,#fff);cursor:pointer;font-family:inherit;transition:background .15s}
		.cbx-link:hover{background:rgba(245,158,11,.14)}
		.cbx-item.is-pending .cbx-link{border-color:rgba(43,127,255,.35);background:rgba(43,127,255,.07)}
		.cbx-item.is-pending .cbx-link:hover{background:rgba(43,127,255,.14)}
		.cbx-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
		.cbx-label{font-size:13px;font-weight:800}
		.cbx-hint{font-size:11.5px;color:var(--txt-3,#94a3b8)}
		.cbx-badge{flex-shrink:0;font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;background:rgba(245,158,11,.18);color:#B45309;white-space:nowrap}
		.cbx-badge.is-pending{background:rgba(43,127,255,.16);color:#2B6CDE}
		.cbx-go{flex-shrink:0;color:var(--txt-3,#94a3b8)}
		@media (max-width:640px){.cbx-list{grid-template-columns:1fr}.cbx-link{padding:10px}}
	`],
})
export class CompletionBoxComponent {
	readonly items = input<CompletionBoxItem[]>([]);
	readonly select = output<CompletionBoxItem>();
	protected readonly hasMissing = computed(() => this.items().some(i => i.status === 'missing'));
}
