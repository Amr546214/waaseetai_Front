import { ReportPrintService } from '../../../../core/reports/report-print.service';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { AdminTeamService, PerformanceReport, SupportResponseMetrics } from '../../../../core/services/admin-team.service';

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
  private readonly reportPrinter = inject(ReportPrintService);
	private readonly destroyRef = inject(DestroyRef);
	private api = inject(AdminTeamService);
	readonly access = inject(AdminAccessService);
	readonly months = MONTHS; readonly periodLabel = PERIOD_LABEL;

	readonly support = signal<SupportResponseMetrics | null>(null);
	readonly supportLoading = signal(false);
	readonly supportError = signal('');
	private supportRequest = 0;
	loadSupport() {
		const request = ++this.supportRequest;
		this.supportLoading.set(true); this.supportError.set(''); this.support.set(null);
		this.api.supportPerformance(this.period()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: r => { if (request !== this.supportRequest) return; this.support.set(r.data); this.supportLoading.set(false); },
			error: () => { if (request !== this.supportRequest) return; this.supportError.set('تعذّر تحميل أوقات الرد.'); this.supportLoading.set(false); },
		});
	}
	loading = signal(true); error = signal(''); report = signal<PerformanceReport | null>(null); period = signal<'month' | 'quarter' | 'year'>('month'); exporting = signal(false); exportError = signal('');
	canExport = computed(() => this.access.can('performance.export'));
	trend = computed(() => {
		const t = this.report()?.trend ?? []; const max = Math.max(1, ...t.map(x => Math.max(x.thisYear, x.lastYear)));
		return t.map(x => ({ label: MONTHS[x.month - 1].slice(0, 3), cur: x.thisYear, prev: x.lastYear, curH: Math.round((x.thisYear / max) * 100), prevH: Math.round((x.lastYear / max) * 100) }));
	});
	hasTrend = computed(() => this.trend().some(t => t.cur > 0 || t.prev > 0));

	ngOnInit() { this.load(); }
  private reportSeq=0;
	load() {
    const seq=++this.reportSeq;
		this.loading.set(true); this.error.set('');
		this.api.performance(this.period()).subscribe({ next: r => { if(seq!==this.reportSeq)return; this.report.set(r.data); this.loading.set(false); }, error: e => { if(seq!==this.reportSeq)return; this.error.set(e?.error?.message || 'تعذّر تحميل التقرير، حاول مرة أخرى'); this.loading.set(false); } });
	}
	setPeriod(p: 'month' | 'quarter' | 'year') { ++this.supportRequest; this.support.set(null); this.supportLoading.set(false); this.supportError.set(''); this.period.set(p); this.load(); }
	color(i: number) { return COLORS[i % COLORS.length]; }
	initial(n: string) { return (n || '?').trim().charAt(0); }
	/** PDF = the browser's print dialog (Save as PDF) on exactly what this page shows, i.e. the same data, scope and permission as the CSV; the same helper the other admin reports use. */
	exportPdf() {
    const r=this.report();if(!this.canExport()||!r||this.loading()||this.error())return;
    this.reportPrinter.print({title:'تقرير أداء الفريق',metadata:[['الفترة',this.periodLabel[this.period()]],['من',r.from],['إلى',r.to]],sections:[{title:'المؤشرات المسجلة',facts:[['عدد الأعضاء',r.team.members],['المهام المنجزة',r.team.completed],['متوسط الإنجاز بالساعات',r.team.avgCompletionHours],['الإنجاز في الموعد %',r.team.onTimeRate]]},{title:'أداء الأعضاء',columns:['الاسم','الدور','المهام المنجزة','المهام المفتوحة','متوسط ساعات الإنجاز','الإنجاز في الموعد %','الالتزام بـ SLA %','تقييم المستخدمين','الدرجة الكلية'],rows:r.members.map(m=>[m.name,m.role,m.completed,m.openTasks,m.avgCompletionHours,m.onTimeRate,m.slaRate,m.userRating,m.overallScore])},{title:'حدود البيانات',text:(r.definitions.unavailable??[]).join('\n')}]});
  }
	export() {
		if (this.exporting()) return; this.exporting.set(true); this.exportError.set('');
		this.api.exportPerformance(this.period()).subscribe({
			next: blob => { const a = document.createElement('a'); const url = URL.createObjectURL(blob); a.href = url; a.download = `team-performance-${this.period()}.csv`; a.click(); URL.revokeObjectURL(url); this.exporting.set(false); },
			error: e => { this.exporting.set(false); this.exportError.set(e?.status === 403 ? 'ليست لديك صلاحية تصدير الأداء' : 'تعذّر التصدير، حاول مرة أخرى'); },
		});
	}
}
