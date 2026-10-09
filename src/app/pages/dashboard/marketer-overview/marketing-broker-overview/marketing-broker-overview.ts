import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiResultCardComponent } from '../../../../shared/ai/ai-result-card.component';
import { MarketerOverviewService, MarketerSummary, ChannelPerformance, CommissionLog, AiInsights }  from '../../../../core/services/marketer-overview.service';

@Component({
	selector: 'app-marketing-broker-overview',
	standalone: true,
	imports: [CommonModule, AiResultCardComponent],
	templateUrl: './marketing-broker-overview.html',
	styleUrl: './marketing-broker-overview.css',
})
export class MarketingBrokerOverview implements OnInit {
	private marketerOverviewService = inject(MarketerOverviewService);

	summary = signal<MarketerSummary | null>(null);
	channels = signal<ChannelPerformance[]>([]);
	commissions = signal<CommissionLog[]>([]);
	insights = signal<AiInsights | null>(null);
	insightsLoading = signal<boolean>(true);
	insightsFailed = signal<boolean>(false);
	private insightsSeq = 0;

	ngOnInit() {
		this.fetchDashboardData();
	}

	private fetchDashboardData() {
		// Summary
		this.marketerOverviewService.getSummary().subscribe({
			next: (res) => this.summary.set(res.data),
			error: (err) => console.error('Failed to load summary', err),
		});

		// Channels
		this.marketerOverviewService.getChannelPerformance().subscribe({
			next: (res) => this.channels.set(res.data),
			error: (err) => console.error('Failed to load channels', err),
		});

		// Commissions
		this.marketerOverviewService.getRecentCommissions(5).subscribe({
			next: (res) => this.commissions.set(res.data),
			error: (err) => console.error('Failed to load commissions', err),
		});

		this.loadInsights();
	}

	loadInsights() {
		const seq = ++this.insightsSeq;
		this.insightsLoading.set(true);
		this.insightsFailed.set(false);
		this.insights.set(null);
		this.marketerOverviewService.getAiInsights().subscribe({
			next: (res) => {
				if (seq !== this.insightsSeq) return;
				this.insightsLoading.set(false);
				if (res?.success && res.data && !Array.isArray(res.data)) this.insights.set(res.data);
				else this.insightsFailed.set(true);
			},
			error: () => {
				if (seq !== this.insightsSeq) return;
				this.insightsLoading.set(false);
				this.insightsFailed.set(true);
			},
		});
	}
}
