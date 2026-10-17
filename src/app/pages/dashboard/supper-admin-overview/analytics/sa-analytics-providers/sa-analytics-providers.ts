import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { WsSelectComponent } from '../../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminAnalyticsService, AnalyticsOverview, ACCOUNT_TYPE_LABELS } from '../../../../../core/services/admin-analytics.service';
import { exportCsv, printPage } from '../../../../../core/utils/export.util';

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Provider intelligence — reads GET /admin/analytics/overview (real reviews, projects and provider profiles for the chosen window). */
@Component({
  selector: 'app-sa-analytics-providers',
  standalone: true,
  imports: [CommonModule, FormsModule, WsSelectComponent],
  templateUrl: './sa-analytics-providers.html',
  styleUrl: './sa-analytics-providers.css',
})
export class SaAnalyticsProviders implements OnInit {
  private readonly api = inject(AdminAnalyticsService);

  private readonly periodDays: Record<string, number | null> = { 'آخر 30 يوم': 30, 'آخر 90 يوم': 90, 'آخر سنة': 365, 'كل الفترات': null };
  readonly periods = Object.keys(this.periodDays);
  period = signal('آخر 30 يوم');

  loading = signal(false);
  failed = signal(false);
  data = signal<AnalyticsOverview | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  setPeriod(p: string) {
    this.period.set(p);
    this.reload();
  }

  range(): { from?: string; to?: string } {
    const days = this.periodDays[this.period()];
    if (!days) return {};
    const now = new Date();
    return { from: iso(new Date(now.getTime() - days * DAY)), to: iso(now) };
  }

  reload() {
    this.loading.set(true);
    this.failed.set(false);
    this.api.getOverview(this.range()).subscribe((r) => {
      this.data.set(r.data);
      this.failed.set(r.failed);
      this.loading.set(false);
    });
  }

  readonly kpis = computed(() => {
    const d = this.data();
    if (!d) return [];
    const completed = d.projects.byStatus.find((s) => s.status === 'COMPLETED')?.count ?? 0;
    return [
      { value: String(d.providers.totalProviderAccounts), label: 'حسابات مقدمي الخدمة', color: '#2BD4C7' },
      { value: d.reviews.average === null ? '—' : `${d.reviews.average}★`, label: `متوسط التقييم (${d.reviews.count} تقييم)`, color: '#0FA99A' },
      { value: String(completed), label: 'مشاريع مكتملة في الفترة', color: '#59C1F5' },
      { value: String(d.providers.atRisk.length), label: 'مقدمون تقييمهم أقل من 3.5', color: '#FFB400' },
    ];
  });

  readonly topRated = computed(() => {
    const rows = this.data()?.providers.topRated ?? [];
    return rows.map((r, i) => ({
      ...r,
      rank: i + 1,
      initial: (r.name || '؟').charAt(0),
      typeLabel: r.accountType ? ACCOUNT_TYPE_LABELS[r.accountType] ?? r.accountType : '—',
      barPct: Math.round((r.averageRating / 5) * 100),
    }));
  });

  readonly atRisk = computed(() => this.data()?.providers.atRisk ?? []);

  /** Rule on real counts: no providers for demanded projects, or 3+ projects per provider, is a shortage. */
  readonly gaps = computed(() =>
    (this.data()?.specialties ?? [])
      .filter((s) => s.projects > 0)
      .map((s) => {
        const ratio = s.providers === 0 ? Infinity : s.projects / s.providers;
        const status = s.providers === 0 ? 'لا يوجد مقدمون' : ratio >= 3 ? 'نقص ← فرصة' : 'وفرة كافية';
        const color = s.providers === 0 ? '#FF6B6B' : ratio >= 3 ? '#FFB400' : '#0FA99A';
        return { name: s.specialty, status: `${status} (${s.projects} مشروع / ${s.providers} مقدم)`, color };
      }),
  );

  exportCsv() {
    const rows = this.topRated();
    if (!rows.length) return;
    exportCsv('provider-intelligence', [
      { header: 'الترتيب', value: 'rank' },
      { header: 'المقدم', value: 'name' },
      { header: 'نوع الحساب', value: 'typeLabel' },
      { header: 'متوسط التقييم', value: 'averageRating' },
      { header: 'عدد التقييمات', value: 'reviewCount' },
      { header: 'مشاريع مكتملة', value: 'completedProjects' },
    ], rows);
  }

  print() {
    printPage('تحليلات مقدمي الخدمة');
  }
}
