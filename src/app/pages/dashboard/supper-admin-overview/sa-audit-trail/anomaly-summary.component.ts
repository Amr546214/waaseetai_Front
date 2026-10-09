import { Component, OnInit, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AdminAiService, createAdminAiState } from '../../../../core/services/admin-ai.service';
import { AiResultCardComponent } from '../../../../shared/ai/ai-result-card.component';

const METRIC_LABELS: Record<string, string> = {
	withdrawalRequestsPerDay: 'طلبات السحب اليومية',
	disputesOpenedPerDay: 'النزاعات المفتوحة يوميًا',
	failedLoginsPerDay: 'محاولات الدخول المرفوضة يوميًا',
	securityWarningEventsPerDay: 'أحداث الأمان التحذيرية يوميًا',
};

/** 'ملخص العمليات غير الاعتيادية (آخر 30 يومًا)': the AI summary card + the real per-metric statistics (database aggregates). */
@Component({
	selector: 'app-anomaly-summary',
	standalone: true,
	imports: [AiResultCardComponent, DecimalPipe],
	template: `
		<div class="an-wrap" data-testid="anomaly-summary">
			<ws-ai-result-card title="ملخص العمليات غير الاعتيادية (آخر 30 يومًا)" [result]="st.result()" [loading]="st.loading()" [requestFailed]="st.failed()" (retry)="st.load()" />
			@if (st.result()?.anomalies; as a) {
				<div class="an-data" data-testid="anomaly-stats">
					<div class="an-ttl">بيانات فعلية — إحصاءات آخر {{ a.windowDays }} يومًا</div>
					<p class="an-count" data-testid="anomaly-count">عدد الأيام غير الاعتيادية: {{ a.anomalyCount }}</p>
					<table class="an-tbl">
						<thead><tr><th>المؤشر</th><th>إجمالي الأحداث</th><th>المتوسط اليومي</th><th>الأيام غير الاعتيادية</th></tr></thead>
						<tbody>
							@for (m of a.metrics; track m.key) {
								<tr data-testid="anomaly-row">
									<td>{{ label(m.key) }}</td>
									<td>{{ m.totalEvents }}</td>
									<td>{{ m.mean === null ? '—' : (m.mean | number:'1.0-2') }}</td>
									<td>
										@if (!m.evaluated) { <span>بيانات غير كافية</span> }
										@else if (m.anomalyDays.length === 0) { <span>لا يوجد</span> }
										@else { @for (d of m.anomalyDays; track d.date) { <div>{{ d.date }} — {{ d.count }}</div> } }
									</td>
								</tr>
							}
						</tbody>
					</table>
				</div>
			}
		</div>
	`,
	styles: [`
		.an-wrap { margin-bottom: 16px; }
		.an-data { padding: 14px; border-radius: 12px; border: 1px solid var(--sec-bd, rgba(255,255,255,.08)); }
		.an-ttl { font-size: 12px; font-weight: 800; margin-bottom: 8px; }
		.an-count { margin: 0 0 8px; font-size: 12.5px; font-weight: 700; }
		.an-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
		.an-tbl th, .an-tbl td { text-align: start; padding: 6px 8px; border-bottom: 1px solid var(--sec-bd, rgba(255,255,255,.08)); vertical-align: top; }
	`],
})
export class AnomalySummaryComponent implements OnInit {
	private readonly api = inject(AdminAiService);
	protected readonly st = createAdminAiState(() => this.api.getAnomalySummary());
	protected label(key: string): string { return METRIC_LABELS[key] ?? key; }
	ngOnInit(): void { this.st.load(); }
}
