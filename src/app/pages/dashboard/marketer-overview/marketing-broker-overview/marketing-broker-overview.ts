import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarketerOverviewService, MarketerSummary, ChannelPerformance, CommissionLog, AiInsight } from '../../../../core/services/marketer-overview.service';

@Component({
	selector: 'app-marketing-broker-overview',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './marketing-broker-overview.html',
	styleUrl: './marketing-broker-overview.css',
})
export class MarketingBrokerOverview implements OnInit {
	private marketerOverviewService = inject(MarketerOverviewService);

	summary = signal<MarketerSummary | null>(null);
	channels = signal<ChannelPerformance[]>([]);
	commissions = signal<CommissionLog[]>([]);
	insights = signal<AiInsight[]>([]);
	loading = signal<boolean>(true);

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

		// Insights
		this.marketerOverviewService.getAiInsights().subscribe({
			next: (res) => {
				this.insights.set(res.data);
				this.loading.set(false);
			},
			error: (err) => {
				console.error('Failed to load insights', err);
				this.loading.set(false);
			},
		});
	}
}
