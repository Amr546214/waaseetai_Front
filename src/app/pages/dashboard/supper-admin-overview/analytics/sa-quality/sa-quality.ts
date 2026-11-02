import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { WsDatePipe } from '../../../../../shared/ws-date/ws-date.pipe';
import { CommonModule } from '@angular/common';
import { AdminAnalyticsService, AnalyticsOverview } from '../../../../../core/services/admin-analytics.service';
import { exportCsv, printPage } from '../../../../../core/utils/export.util';
import { ReviewsSummaryComponent } from './reviews-summary.component';

interface ScoreItem { label: string; value: number; display: string; color: string; }

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Service quality board — reads GET /admin/analytics/overview (real reviews, disputes and projects for the chosen window). */
@Component({
  selector: 'app-sa-quality',
  standalone: true,
  imports: [WsDatePipe, CommonModule, ReviewsSummaryComponent],
  templateUrl: './sa-quality.html',
  styleUrl: './sa-quality.css',
})
export class SaQuality implements OnInit {
  private readonly api = inject(AdminAnalyticsService);

  readonly periods: { key: string; label: string; days: number | null }[] = [
    { key: '30', label: 'آخر 30 يوم', days: 30 },
    { key: '90', label: 'آخر 90 يوم', days: 90 },
    { key: '365', label: 'آخر سنة', days: 365 },
    { key: 'all', label: 'كل الفترات', days: null },
  ];
  period = signal('90');
  loading = signal(false);
  failed = signal(false);
  data = signal<AnalyticsOverview | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  setPeriod(key: string) {
    this.period.set(key);
    this.reload();
  }

  range(): { from?: string; to?: string } {
    const days = this.periods.find((p) => p.key === this.period())?.days;
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

  private pct(n: number, d: number): number { return d ? Number(((n / d) * 100).toFixed(1)) : 0; }

  readonly kpis = computed(() => {
    const d = this.data();
    if (!d) return [];
    const positive = d.reviews.distribution.filter((b) => b.stars >= 4).reduce((s, b) => s + b.count, 0);
    return [
      { value: d.reviews.average === null ? '—' : `${d.reviews.average}★`, label: 'متوسط التقييم العام', color: '#2BD4C7' },
      { value: String(d.reviews.count), label: 'عدد التقييمات', color: '#0FA99A' },
      { value: d.reviews.count ? `${this.pct(positive, d.reviews.count)}%` : '—', label: 'تقييمات إيجابية (4★ وأكثر)', color: '#FFB400' },
      { value: String(d.reviews.negativeCount), label: 'تقييمات سلبية (2★ وأقل)', color: '#FF8C69' },
    ];
  });

  readonly scoreItems = computed<ScoreItem[]>(() => {
    const d = this.data();
    if (!d) return [];
    const items: ScoreItem[] = [];
    const rc = d.reviews.count;
    if (rc) {
      const pos = d.reviews.distribution.filter((b) => b.stars >= 4).reduce((s, b) => s + b.count, 0);
      items.push({ label: 'تقييمات إيجابية', value: this.pct(pos, rc), display: `${this.pct(pos, rc)}%`, color: '#0FA99A' });
      items.push({ label: 'تقييمات سلبية (≤ 2★)', value: this.pct(d.reviews.negativeCount, rc), display: `${this.pct(d.reviews.negativeCount, rc)}%`, color: '#FF8C69' });
    }
    const pTotal = d.projects.total;
    if (pTotal) {
      const done = d.projects.byStatus.find((s) => s.status === 'COMPLETED')?.count ?? 0;
      items.push({ label: 'معدل إتمام المشاريع', value: this.pct(done, pTotal), display: `${this.pct(done, pTotal)}%`, color: '#5DA0FF' });
    }
    if (d.disputes.total) {
      const resolved = d.disputes.byStatus.find((s) => s.status === 'RESOLVED')?.count ?? 0;
      items.push({ label: 'نزاعات تم حلها', value: this.pct(resolved, d.disputes.total), display: `${this.pct(resolved, d.disputes.total)}%`, color: '#59C1F5' });
    }
    return items;
  });

  /** Monthly average rating, only months that have reviews. */
  readonly trend = computed(() => {
    const months = this.data()?.reviews.byMonth ?? [];
    const n = months.length;
    return months.map((m, i) => ({ ...m, x: n === 1 ? 300 : (i / (n - 1)) * 560 + 20, y: 90 - (m.average / 5) * 80 }));
  });
  readonly trendPoints = computed(() => this.trend().map((p) => `${p.x},${p.y}`).join(' '));

  readonly recent = computed(() => (this.data()?.reviews.recent ?? []).map((r) => ({ ...r, tone: r.rating >= 4 ? 'good' : r.rating >= 3 ? 'ok' : 'bad' })));
  readonly lowRated = computed(() => this.data()?.reviews.lowRated ?? []);
  readonly atRisk = computed(() => this.data()?.providers.atRisk ?? []);

  exportCsv() {
    const rows = this.data()?.reviews.byMonth ?? [];
    const recent = this.data()?.reviews.recent ?? [];
    if (!rows.length && !recent.length) return;
    exportCsv('service-quality-reviews', [
      { header: 'التاريخ', value: 'createdAt' },
      { header: 'التقييم', value: 'rating' },
      { header: 'مقدم الخدمة', value: 'providerName' },
      { header: 'العميل', value: (r: any) => r.clientName ?? '' },
      { header: 'التعليق', value: (r: any) => r.comment ?? '' },
    ], recent);
  }

  print() {
    printPage('لوحة جودة الخدمة');
  }
}
