import { Component, OnInit, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AdminAiService, createAdminAiState } from '../../../../../core/services/admin-ai.service';
import { AiResultCardComponent } from '../../../../../shared/ai/ai-result-card.component';

/** 'ملخص آراء التقييمات': the AI summary card + the real rating distribution (database aggregates, labelled as data). */
@Component({
	selector: 'app-reviews-summary',
	standalone: true,
	imports: [AiResultCardComponent, DecimalPipe],
	template: `
		<div class="rs-wrap" data-testid="reviews-summary">
			<ws-ai-result-card title="ملخص آراء التقييمات" [result]="st.result()" [loading]="st.loading()" [requestFailed]="st.failed()" (retry)="st.load()" />
			@if (st.result()?.stats; as s) {
				<div class="rs-data" data-testid="reviews-stats">
					<div class="rs-ttl">بيانات فعلية — توزيع التقييمات</div>
					<div class="rs-kpis">
						<span data-testid="rs-total">إجمالي التقييمات: {{ s.totalReviews }}</span>
						<span data-testid="rs-avg">متوسط التقييم: {{ s.averageRating === null ? '—' : (s.averageRating | number:'1.0-2') }}</span>
						<span data-testid="rs-pos">إيجابية: {{ s.positivePercent | number:'1.0-1' }}%</span>
						<span data-testid="rs-neg">سلبية: {{ s.negativePercent | number:'1.0-1' }}%</span>
					</div>
					@for (b of s.distribution; track b.stars) {
						<div class="rs-row" data-testid="rs-bar">
							<span class="rs-lbl">{{ b.stars }}★</span>
							<div class="rs-track"><div class="rs-fill" [style.width.%]="b.percent"></div></div>
							<span class="rs-val">{{ b.count }} ({{ b.percent | number:'1.0-1' }}%)</span>
						</div>
					}
				</div>
			}
		</div>
	`,
	styles: [`
		.rs-wrap { margin-bottom: 16px; }
		.rs-data { padding: 14px; border-radius: 12px; border: 1px solid var(--sec-bd, rgba(255,255,255,.08)); }
		.rs-ttl { font-size: 12px; font-weight: 800; margin-bottom: 8px; }
		.rs-kpis { display: flex; flex-wrap: wrap; gap: 14px; font-size: 12.5px; margin-bottom: 10px; }
		.rs-row { display: flex; align-items: center; gap: 8px; font-size: 12px; margin: 4px 0; }
		.rs-lbl { width: 32px; }
		.rs-track { flex: 1; height: 8px; border-radius: 4px; background: rgba(255,255,255,.08); overflow: hidden; }
		.rs-fill { height: 100%; background: #2BD4C7; }
		.rs-val { min-width: 90px; text-align: end; color: var(--txt-3, #8892b0); }
	`],
})
export class ReviewsSummaryComponent implements OnInit {
	private readonly api = inject(AdminAiService);
	protected readonly st = createAdminAiState(() => this.api.getSentimentSummary());
	ngOnInit(): void { this.st.load(); }
}
