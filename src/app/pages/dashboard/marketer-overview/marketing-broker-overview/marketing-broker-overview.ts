import { MarketerLevelTagComponent } from '../../../../shared/levels/marketer-level-tag.component';
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiResultCardComponent } from '../../../../shared/ai/ai-result-card.component';
import { RouterLink } from '@angular/router';
import { channelLabel, commissionTypeLabel, commissionStatusLabel } from '../../../../core/utils/marketer-labels.util';
import { MarketerOverviewService, MarketerSummary, ChannelPerformance, CommissionLog, AiInsights }  from '../../../../core/services/marketer-overview.service';
import { handleLoadError } from '../../../../core/utils/rate-limit.util';

@Component({
	selector: 'app-marketing-broker-overview',
	standalone: true,
	imports: [MarketerLevelTagComponent, CommonModule, AiResultCardComponent, RouterLink],
	templateUrl: './marketing-broker-overview.html',
	styleUrl: './marketing-broker-overview.css',
})
export class MarketingBrokerOverview implements OnInit {
	private marketerOverviewService = inject(MarketerOverviewService);

	summary = signal<MarketerSummary | null>(null);
	channels = signal<ChannelPerformance[]>([]);
	commissions = signal<CommissionLog[]>([]);
	loadFailed = signal<boolean>(false);
	readonly channelLabel = channelLabel;
	readonly commissionTypeLabel = commissionTypeLabel;
	readonly commissionStatusLabel = commissionStatusLabel;
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
			error: (err) => handleLoadError(err, { hasData: () => this.summary() != null, onRateLimit: () => this.loadFailed.set(true), onOtherError: () => this.loadFailed.set(true) }),
		});

		// Channels
		this.marketerOverviewService.getChannelPerformance().subscribe({
			next: (res) => this.channels.set(res.data),
			error: (err) => handleLoadError(err, { hasData: () => this.channels().length > 0, onRateLimit: () => this.loadFailed.set(true), onOtherError: () => this.loadFailed.set(true) }),
		});

		// Commissions
		this.marketerOverviewService.getRecentCommissions(5).subscribe({
			next: (res) => this.commissions.set(res.data),
			error: (err) => handleLoadError(err, { hasData: () => this.commissions().length > 0, onRateLimit: () => this.loadFailed.set(true), onOtherError: () => this.loadFailed.set(true) }),
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
