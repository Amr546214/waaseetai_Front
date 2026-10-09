import { Component, OnInit, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AdminAiService, createAdminAiState } from '../../../../core/services/admin-ai.service';
import { AiResultCardComponent } from '../../../../shared/ai/ai-result-card.component';

/** 'ملخص التدفق المالي': the AI summary card + the real monthly series (database aggregates, labelled as data). */
@Component({
	selector: 'app-forecast-summary',
	standalone: true,
	imports: [AiResultCardComponent, DecimalPipe],
	template: `
		<div class="fs-wrap" data-testid="forecast-summary">
			<ws-ai-result-card title="ملخص التدفق المالي" [result]="st.result()" [loading]="st.loading()" [requestFailed]="st.failed()" (retry)="st.load()" />
			@if (st.result()?.series; as s) {
				<div class="fs-data" data-testid="forecast-series">
					<div class="fs-ttl">بيانات فعلية — التدفق الشهري ({{ s.currency }})</div>
					<table class="fs-tbl">
						<thead><tr><th>الشهر</th><th>الوارد</th><th>الصادر</th><th>التغير %</th></tr></thead>
						<tbody>
							@for (m of s.months; track m.month) {
								<tr>
									<td>{{ m.month }}</td>
									<td>{{ m.inflow | number:'1.0-2' }}</td>
									<td>{{ m.outflow | number:'1.0-2' }}</td>
									<td>{{ m.inflowChangePercent === null || m.inflowChangePercent === undefined ? '—' : (m.inflowChangePercent | number:'1.0-1') + '%' }}</td>
								</tr>
							}
						</tbody>
					</table>
					@if (s.inflowNextMonthEstimate !== null && s.inflowNextMonthEstimate !== undefined) {
						<p class="fs-est" data-testid="forecast-estimate">تقدير الشهر القادم (اتجاه خطي بسيط من {{ s.inflowTrendBasedOnMonths }} شهر): {{ s.inflowNextMonthEstimate | number:'1.0-2' }} {{ s.currency }}</p>
					}
				</div>
			}
		</div>
	`,
	styles: [`
		.fs-wrap { margin-bottom: 16px; }
		.fs-data { padding: 14px; border-radius: 12px; border: 1px solid var(--sec-bd, rgba(255,255,255,.08)); }
		.fs-ttl { font-size: 12px; font-weight: 800; margin-bottom: 8px; }
		.fs-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
		.fs-tbl th, .fs-tbl td { text-align: start; padding: 6px 8px; border-bottom: 1px solid var(--sec-bd, rgba(255,255,255,.08)); }
		.fs-est { margin: 10px 0 0; font-size: 12px; color: var(--txt-3, #8892b0); }
	`],
})
export class ForecastSummaryComponent implements OnInit {
	private readonly api = inject(AdminAiService);
	protected readonly st = createAdminAiState(() => this.api.getForecastSummary());
	ngOnInit(): void { this.st.load(); }
}
