import { Component, computed, input, output } from '@angular/core';
import { AiResult, MetricSummaryDetails, isRealAi } from '../../core/models/ai-result.model';

/**
 * One honest card for any backend-backed AI summary (client reports, marketer insights, admin cards).
 *  - loading                 -> neutral "جارٍ التحليل…"
 *  - READY + Gemini/WaseetAI -> the official AI mark, summary, observations, recommendations, advisory note
 *  - NOT_ENOUGH_DATA         -> neutral "لا توجد بيانات كافية للتحليل"
 *  - FAILED / PENDING        -> neutral "تعذر تشغيل التحليل حاليًا" (+ retry) — the host page keeps working
 *  - null (nothing yet)      -> renders nothing
 * No score, percentage or confidence is ever rendered; the AI icon appears only for a real READY result.
 */
@Component({
	selector: 'ws-ai-result-card',
	standalone: true,
	template: `
		@if (mode() !== 'none') {
			<section class="ws-arc" [class.ws-arc-ai]="mode() === 'ai'" [attr.data-testid]="'ai-card-' + mode()" [attr.aria-busy]="mode() === 'loading' ? 'true' : null">
				<span class="ws-arc-ico" [class.ws-arc-neutral]="mode() !== 'ai'" aria-hidden="true">
					@if (mode() === 'ai') {
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="2"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="6" r="1.5"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="18" r="1.5"/><circle cx="12" cy="3" r="1.5"/><circle cx="12" cy="21" r="1.5"/>
							<path d="M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5"/>
						</svg>
					} @else {
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>
					}
				</span>
				<div class="ws-arc-body">
					<div class="ws-arc-ttl">{{ title() }}</div>
					@switch (mode()) {
						@case ('loading') { <p class="ws-arc-txt" data-testid="ai-card-loading-text">جارٍ التحليل…</p> }
						@case ('empty') { <p class="ws-arc-txt" data-testid="ai-card-empty-text">لا توجد بيانات كافية للتحليل</p> }
						@case ('failed') {
							<p class="ws-arc-txt" data-testid="ai-card-failed-text">تعذر تشغيل التحليل حاليًا</p>
							@if (retryable()) { <button type="button" class="ws-arc-retry" data-testid="ai-card-retry" (click)="retry.emit()">إعادة المحاولة</button> }
						}
						@case ('ai') {
							@if (result()?.summary) { <p class="ws-arc-txt" data-testid="ai-card-summary">{{ result()?.summary }}</p> }
							@if (observations().length) {
								<ul class="ws-arc-list" data-testid="ai-card-observations">@for (o of observations(); track $index) { <li>{{ o }}</li> }</ul>
							}
							@if (recommendations().length) {
								<div class="ws-arc-sub">اقتراحات</div>
								<ul class="ws-arc-list" data-testid="ai-card-recommendations">@for (r of recommendations(); track $index) { <li>{{ r }}</li> }</ul>
							}
							<div class="ws-arc-note">تحليل استشاري مبني على بياناتك الفعلية</div>
						}
					}
				</div>
			</section>
		}
	`,
	styles: [`
		:host { display: block; }
		.ws-arc { display: flex; gap: 10px; padding: 14px; border-radius: 12px; margin-bottom: 16px; background: var(--crd-bg, rgba(255,255,255,.03)); border: 1px solid var(--sec-bd, rgba(255,255,255,.08)); }
		.ws-arc-ai { background: rgba(123,47,190,.08); border-color: rgba(123,47,190,.2); }
		.ws-arc-ico { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(123,47,190,.15); color: #A56BE0; }
		.ws-arc-neutral { background: rgba(255,255,255,.06); color: var(--txt-3, #8892b0); }
		.ws-arc-body { flex: 1; min-width: 0; }
		.ws-arc-ttl { font-size: 11px; font-weight: 900; letter-spacing: .04em; margin-bottom: 4px; color: var(--txt, inherit); }
		.ws-arc-ai .ws-arc-ttl { color: #A56BE0; }
		.ws-arc-txt { margin: 0 0 4px; font-size: 12.5px; line-height: 1.75; color: var(--txt-3, #8892b0); }
		.ws-arc-list { margin: 4px 0; padding-inline-start: 18px; font-size: 12.5px; line-height: 1.75; color: var(--txt-3, #8892b0); list-style: disc; }
		.ws-arc-sub { margin-top: 6px; font-size: 11px; font-weight: 800; color: var(--txt, inherit); }
		.ws-arc-note { margin-top: 6px; font-size: 10.5px; font-weight: 700; color: var(--txt-3, #8892b0); opacity: .8; }
		.ws-arc-retry { margin-top: 4px; font-size: 11.5px; font-weight: 800; padding: 4px 12px; border-radius: 8px; border: 1px solid var(--sec-bd, rgba(255,255,255,.15)); background: transparent; color: inherit; cursor: pointer; }
	`],
})
export class AiResultCardComponent {
	readonly title = input<string>('ملخص ذكي');
	readonly result = input<AiResult<MetricSummaryDetails> | null | undefined>(null);
	readonly loading = input<boolean>(false);
	/** The host sets this when the request itself failed (HTTP error) and there is no result object. */
	readonly requestFailed = input<boolean>(false);
	readonly retryable = input<boolean>(true);
	readonly retry = output<void>();

	protected readonly mode = computed<'none' | 'loading' | 'ai' | 'empty' | 'failed'>(() => {
		if (this.loading()) return 'loading';
		const r = this.result();
		if (isRealAi(r)) return 'ai';
		if (r?.status === 'NOT_ENOUGH_DATA') return 'empty';
		if (r?.status === 'FAILED' || r?.status === 'PENDING' || this.requestFailed()) return 'failed';
		return 'none';
	});
	protected readonly observations = computed(() => (this.result()?.details?.observations ?? []).map(o => o.text).filter(Boolean));
	protected readonly recommendations = computed(() => (this.result()?.details?.recommendations ?? []).map(o => o.text).filter(Boolean));
}
