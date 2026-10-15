import { isRateLimitError } from '../../../../core/utils/rate-limit.util';
import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { ACTIVITY_STATUS, DashboardActivityItem, DashboardCharts, DashboardSummary, SaDashboardService, relativeTimeAr } from "./supper-admin-overview.service";

@Component({
	selector: 'supper-admin-overview',
	templateUrl: './supper-admin-overview.html',
	styleUrl: './supper-admin-overview.css',
	standalone: true,
	imports: [CommonModule, RouterLink]
})
export class SupperAdminOverview implements OnInit {
	private api = inject(SaDashboardService);

	summary = signal<DashboardSummary | null>(null);
	charts = signal<DashboardCharts | null>(null);
	activity = signal<DashboardActivityItem[]>([]);
	loading = signal(true);
	error = signal('');
	chartDays = signal<7 | 30>(7);

	readonly queuesWithWork = computed(() => (this.summary()?.queues ?? []).filter(q => q.count > 0));
	readonly maxRegistrations = computed(() => Math.max(1, ...(this.charts()?.registrations ?? []).map(r => r.count)));
	readonly maxCommission = computed(() => Math.max(1, ...(this.charts()?.commission ?? []).map(r => r.amount)));

	ngOnInit() { this.load(); }

	load() {
		this.loading.set(true);
		this.error.set('');
		this.api.getSummary().subscribe({
			next: (res) => { this.summary.set(res.data); this.loading.set(false); },
			error: (err) => { this.error.set(err?.error?.message || 'تعذر تحميل مؤشرات لوحة التحكم، حاول مرة أخرى'); this.loading.set(false); }
		});
		this.loadCharts();
		this.api.getActivity(12).subscribe({ next: (res) => this.activity.set(res.data.items), error: (e) => { if (!isRateLimitError(e)) this.activity.set([]); } });
	}

	loadCharts() {
		this.api.getCharts(this.chartDays()).subscribe({ next: (res) => this.charts.set(res.data), error: (e) => { if (!isRateLimitError(e)) this.charts.set(null); } });
	}

	setDays(days: 7 | 30) { this.chartDays.set(days); this.loadCharts(); }

	barHeight(value: number, max: number): number { return Math.round((value / max) * 100); }
	money(n: number): string { return n.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
	status(s: string | null) { return (s && ACTIVITY_STATUS[s]) || { label: s ?? '—', cls: 'badge-amber' }; }
	when(iso: string) { return relativeTimeAr(iso); }
}
