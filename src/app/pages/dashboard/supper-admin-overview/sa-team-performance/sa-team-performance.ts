import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { AdminTeamService, PerformanceReport } from '../../../../core/services/admin-team.service';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const PERIOD_LABEL: Record<string, string> = { month: 'هذا الشهر', quarter: 'هذا الربع', year: 'هذه السنة' };
const COLORS = ['#A56BE0', '#2BD4C7', '#FF8C69', '#FFB400', '#5DA0FF', '#0FA99A'];

/** P-AD-026: team performance computed ONLY from recorded task events. What nothing records (SLA target, users' rating of staff, the overall score) shows «لا تتوفر بيانات» with the decision needed, never 0 % or a sample number. */
@Component({
	selector: 'app-sa-team-performance',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './sa-team-performance.html',
	styleUrl: './sa-team-performance.css',
})
export class SaTeamPerformance implements OnInit {
	private api = inject(AdminTeamService);
	readonly access = inject(AdminAccessService);
	readonly months = MONTHS; readonly periodLabel = PERIOD_LABEL;

	loading = signal(true); error = signal(''); report = signal<PerformanceReport | null>(null); period = signal<'month' | 'quarter' | 'year'>('month'); exporting = signal(false); exportError = signal('');
	canExport = computed(() => this.access.can('performance.export'));
	trend = computed(() => {
		const t = this.report()?.trend ?? []; const max = Math.max(1, ...t.map(x => Math.max(x.thisYear, x.lastYear)));
		return t.map(x => ({ label: MONTHS[x.month - 1].slice(0, 3), cur: x.thisYear, prev: x.lastYear, curH: Math.round((x.thisYear / max) * 100), prevH: Math.round((x.lastYear / max) * 100) }));
	});
	hasTrend = computed(() => this.trend().some(t => t.cur > 0 || t.prev > 0));

	ngOnInit() { this.load(); }
	load() {
		this.loading.set(true); this.error.set('');
		this.api.performance(this.period()).subscribe({ next: r => { this.report.set(r.data); this.loading.set(false); }, error: e => { this.error.set(e?.error?.message || 'تعذّر تحميل التقرير، حاول مرة أخرى'); this.loading.set(false); } });
	}
	setPeriod(p: 'month' | 'quarter' | 'year') { this.period.set(p); this.load(); }
	color(i: number) { return COLORS[i % COLORS.length]; }
	initial(n: string) { return (n || '?').trim().charAt(0); }
	export() {
		if (this.exporting()) return; this.exporting.set(true); this.exportError.set('');
		this.api.exportPerformance(this.period()).subscribe({
			next: blob => { const a = document.createElement('a'); const url = URL.createObjectURL(blob); a.href = url; a.download = `team-performance-${this.period()}.csv`; a.click(); URL.revokeObjectURL(url); this.exporting.set(false); },
			error: e => { this.exporting.set(false); this.exportError.set(e?.status === 403 ? 'ليست لديك صلاحية تصدير الأداء' : 'تعذّر التصدير، حاول مرة أخرى'); },
		});
	}
}
