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
							<span class="cbx-label" [attr.title]="item.label">{{ item.label }}</span>
							<span class="cbx-hint" [attr.title]="item.hint">{{ item.hint }}</span>
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
		.cbx{container-type:inline-size;margin:14px 0 18px;padding:14px 16px;border:1px solid var(--border,rgba(255,255,255,.1));border-radius:14px;background:var(--surface,rgba(255,255,255,.03))}
		.cbx-title{font-size:var(--font-size-label);font-weight:800;color:var(--txt,#fff);margin-bottom:10px}
		.cbx-list{list-style:none;margin:0;padding:0;display:grid;gap:10px;align-items:stretch;grid-template-columns:repeat(3,minmax(0,1fr))}
		@container (max-width:760px){.cbx-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
		@container (max-width:480px){.cbx-list{grid-template-columns:minmax(0,1fr)}}
		.cbx-item{min-width:0;display:flex}
		.cbx-link{flex:1;width:100%;min-width:0;min-height:76px;box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:10px;text-align:start;padding:12px 14px;border-radius:12px;border:1px solid rgba(245,158,11,.4);background:rgba(245,158,11,.08);color:var(--txt,#fff);cursor:pointer;font-family:inherit;transition:background .15s,border-color .15s}
		.cbx-link:hover{background:rgba(245,158,11,.16);border-color:rgba(245,158,11,.65)}
		.cbx-link:focus-visible{outline:2px solid #2B7FFF;outline-offset:2px}
		.cbx-item.is-pending .cbx-link{border-color:rgba(43,127,255,.4);background:rgba(43,127,255,.08)}
		.cbx-item.is-pending .cbx-link:hover{background:rgba(43,127,255,.16);border-color:rgba(43,127,255,.65)}
		.cbx-main{min-width:0;display:flex;flex-direction:column;gap:3px}
		.cbx-label,.cbx-hint{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden;overflow-wrap:anywhere}
		.cbx-label{font-size:var(--font-size-label);font-weight:800;line-height:1.5}
		.cbx-hint{font-size:var(--font-size-small);line-height:1.5;color:var(--txt-3,#94a3b8)}
		.cbx-badge{justify-self:end;font-size:var(--font-size-small);font-weight:800;padding:3px 9px;border-radius:999px;background:rgba(245,158,11,.2);color:#FBBF24;white-space:nowrap}
		.cbx-badge.is-pending{background:rgba(43,127,255,.2);color:#8DBBFF}
		.cbx-go{color:var(--txt-3,#94a3b8)}
		body.light-theme .cbx-badge,body.theme-light .cbx-badge,.light-theme .cbx-badge,.theme-light .cbx-badge{color:#92400E;background:rgba(245,158,11,.22)}
		body.light-theme .cbx-badge.is-pending,body.theme-light .cbx-badge.is-pending,.light-theme .cbx-badge.is-pending,.theme-light .cbx-badge.is-pending{color:#1D4ED8;background:rgba(43,127,255,.16)}
		@media (max-width:640px){.cbx{padding:12px}.cbx-link{padding:10px 12px;min-height:68px}}
	`],
})
export class CompletionBoxComponent {
	readonly items = input<CompletionBoxItem[]>([]);
	readonly select = output<CompletionBoxItem>();
	protected readonly hasMissing = computed(() => this.items().some(i => i.status === 'missing'));
}
