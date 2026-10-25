import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { WsDatePipe } from '../../../../shared/ws-date/ws-date.pipe';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { reportAdminProblems } from '../shared/admin-form-report';
import { AdminAnalyticsService, AnalyticsOverview, ACCOUNT_TYPE_LABELS, STATUS_LABELS } from '../../../../core/services/admin-analytics.service';
import { CsvColumn, exportCsv, printPage } from '../../../../core/utils/export.util';

type SectionKey = 'overview' | 'users' | 'projects' | 'finance' | 'specialties' | 'affiliates' | 'performance';
type PeriodKey = '7d' | '30d' | '3m' | '6m' | '1y' | 'custom';

interface KpiCard { icon: string; color: string; bg: string; val: string; lbl: string; sub: string; }
interface ExportSet { filename: string; columns: CsvColumn<any>[]; rows: any[]; }

const PERIOD_DAYS: Record<Exclude<PeriodKey, 'custom'>, number> = { '7d': 7, '30d': 30, '3m': 90, '6m': 182, '1y': 365 };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const DAY = 86400000;

/** Reports & analytics hub — every figure comes from GET /admin/analytics/overview (real database aggregates for the chosen date window). */
@Component({
  selector: 'app-sa-analytics-hub',
  standalone: true,
  imports: [WsDatePipe, CommonModule, FormsModule],
  templateUrl: './sa-analytics-hub.html',
  styleUrl: './sa-analytics-hub.css',
})
export class SaAnalyticsHub implements OnInit {
  private readonly api = inject(AdminAnalyticsService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  activeSection = signal<SectionKey>('overview');
  activePeriod = signal<PeriodKey>('30d');
  compareEnabled = signal(true);
  customFrom = signal('');
  customTo = signal('');

  loading = signal(false);
  failed = signal(false);
  data = signal<AnalyticsOverview | null>(null);
  previous = signal<AnalyticsOverview | null>(null);
  loadedAt = signal<Date | null>(null);

  readonly periods: { key: PeriodKey; label: string }[] = [
    { key: '7d', label: '7 أيام' },
    { key: '30d', label: '30 يوم' },
    { key: '3m', label: '3 أشهر' },
    { key: '6m', label: '6 أشهر' },
    { key: '1y', label: 'سنة' },
  ];

  readonly sections: { key: SectionKey; label: string }[] = [
    { key: 'overview', label: 'نظرة عامة' },
    { key: 'users', label: 'المستخدمون' },
    { key: 'projects', label: 'المشاريع والسوق' },
    { key: 'finance', label: 'المالية' },
    { key: 'specialties', label: 'التخصصات' },
    { key: 'affiliates', label: 'الوسطاء' },
    { key: 'performance', label: 'الأداء العام' },
  ];

  readonly accountLabels = ACCOUNT_TYPE_LABELS;
  readonly statusLabels = STATUS_LABELS;

  /** The window actually requested (undefined bounds are sent as no filter). */
  readonly range = computed(() => {
    const p = this.activePeriod();
    if (p === 'custom') return { from: this.customFrom() || undefined, to: this.customTo() || undefined };
    const now = new Date();
    return { from: iso(new Date(now.getTime() - PERIOD_DAYS[p] * DAY)), to: iso(now) };
  });

  ngOnInit(): void {
    this.reload();
  }

  setSection(s: SectionKey) { this.activeSection.set(s); }

  setPeriod(p: PeriodKey) {
    this.activePeriod.set(p);
    this.reload();
  }

  setCustomRange(from: string, to: string) {
    this.customFrom.set(from);
    this.customTo.set(to);
    if (from && to && from > to) {
      // An inverted range is explained next to the end date instead of silently loading nothing.
      void reportAdminProblems(this.host.nativeElement, [{ field: 'ah-to', message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو مساويًا له' }]);
      return;
    }
    this.activePeriod.set('custom');
    this.reload();
  }

  toggleCompare() {
    this.compareEnabled.update((v) => !v);
    this.reload();
  }

  reload() {
    const r = this.range();
    this.loading.set(true);
    this.failed.set(false);
    this.api.getOverview(r).subscribe((res) => {
      this.data.set(res.data);
      this.failed.set(res.failed);
      this.loading.set(false);
      if (res.data) this.loadedAt.set(new Date());
    });
    this.previous.set(null);
    const prev = this.previousRange();
    if (this.compareEnabled() && prev) {
      this.api.getOverview(prev).subscribe((res) => this.previous.set(res.data));
    }
  }

  /** The equally long window right before the current one (only when both bounds are known). */
  previousRange(): { from: string; to: string } | null {
    const { from, to } = this.range();
    if (!from || !to) return null;
    const f = new Date(from).getTime();
    const t = new Date(to).getTime();
    if (Number.isNaN(f) || Number.isNaN(t) || t < f) return null;
    const span = t - f + DAY;
    return { from: iso(new Date(f - span)), to: iso(new Date(f - DAY)) };
  }

  /* ── view helpers over the real payload ── */
  private sumStatus(rows: { status: string; count: number }[] | undefined, ...statuses: string[]): number {
    return (rows ?? []).filter((r) => statuses.includes(r.status)).reduce((s, r) => s + r.count, 0);
  }

  private prevNote(current: number, prev: number | undefined): string {
    if (!this.compareEnabled()) return 'ضمن الفترة المحددة';
    return prev === undefined ? 'الفترة السابقة: غير متاحة' : `الفترة السابقة: ${prev}`;
  }

  userTypes = computed(() => {
    const d = this.data();
    if (!d) return [];
    const colors = ['#2BD4C7', '#FFB400', '#5DA0FF', '#59C1F5', '#0FA99A', '#FF8C69', '#A8B2D1', '#6B7699'];
    return d.users.byAccountType.map((u, i) => ({
      key: u.accountType,
      label: this.accountLabels[u.accountType] ?? u.accountType,
      count: u.count,
      newCount: u.newInRange,
      pct: d.users.total ? Number(((u.count / d.users.total) * 100).toFixed(1)) : 0,
      color: colors[i % colors.length],
    }));
  });

  userGrowth = computed(() => (this.data()?.users.newByMonth ?? []).map((m) => ({ m: m.month, v: m.count })));
  maxUserGrowth = computed(() => Math.max(1, ...this.userGrowth().map((u) => u.v)));

  statusRows(rows: { status: string; count: number }[] | undefined) {
    return (rows ?? []).map((r) => ({ status: r.status, label: this.statusLabels[r.status] ?? r.status, count: r.count }));
  }

  specialtyRows = computed(() => {
    const rows = this.data()?.specialties ?? [];
    const maxP = Math.max(1, ...rows.map((r) => r.projects));
    const maxS = Math.max(1, ...rows.map((r) => r.providers));
    return rows.map((r) => ({ ...r, demandPct: Math.round((r.projects / maxP) * 100), supplyPct: Math.round((r.providers / maxS) * 100) }));
  });

  kpiFor(section: SectionKey): KpiCard[] {
    const d = this.data();
    if (!d) return [];
    const p = this.previous();
    const card = (icon: string, color: string, bg: string, val: string, lbl: string, sub: string): KpiCard => ({ icon, color, bg, val, lbl, sub });
    const providerNew = d.users.byAccountType.filter((u) => u.accountType.startsWith('PROVIDER')).reduce((s, u) => s + u.newInRange, 0);
    switch (section) {
      case 'users':
        return [
          card('person', '#2BD4C7', 'rgba(43,212,199,.12)', String(d.users.total), 'إجمالي الحسابات', 'كل الحسابات حتى الآن'),
          card('person', '#5DA0FF', 'rgba(93,160,255,.12)', String(d.users.newInRange), 'حسابات جديدة', this.prevNote(d.users.newInRange, p?.users.newInRange)),
          card('person', '#FFB400', 'rgba(255,180,0,.12)', String(providerNew), 'مقدمو خدمة جدد', 'ضمن الفترة المحددة'),
        ];
      case 'projects':
        return [
          card('market', '#2BD4C7', 'rgba(43,212,199,.12)', String(d.projects.total), 'مشاريع في الفترة', this.prevNote(d.projects.total, p?.projects.total)),
          card('check', '#0FA99A', 'rgba(15,169,154,.12)', String(this.sumStatus(d.projects.byStatus, 'COMPLETED')), 'مشاريع مكتملة', 'ضمن الفترة المحددة'),
          card('warn', '#FF8C69', 'rgba(255,140,105,.12)', String(d.disputes.total), 'نزاعات', this.prevNote(d.disputes.total, p?.disputes.total)),
        ];
      case 'finance':
        return [card('wallet', '#2BD4C7', 'rgba(43,212,199,.12)', String(d.orders.total), 'طلبات شراء (عدد)', 'العدد فقط — المبالغ في التقارير المالية')];
      case 'specialties':
        return [card('chart', '#2BD4C7', 'rgba(43,212,199,.12)', String(d.specialties.length), 'تخصصات ظاهرة في البيانات', 'مشاريع أو مقدمو خدمة')];
      case 'affiliates':
        return [
          card('person', '#2BD4C7', 'rgba(43,212,199,.12)', String(d.referrals.total), 'إحالات في الفترة', this.prevNote(d.referrals.total, p?.referrals.total)),
          card('check', '#0FA99A', 'rgba(15,169,154,.12)', String(this.sumStatus(d.referrals.byStatus, 'CONVERTED')), 'إحالات تحوّلت لعميل', 'ضمن الفترة المحددة'),
        ];
      case 'performance':
        return [
          card('star', '#FFB400', 'rgba(255,180,0,.12)', d.reviews.average === null ? '—' : String(d.reviews.average), 'متوسط التقييم', `من ${d.reviews.count} تقييم`),
          card('warn', '#FF8C69', 'rgba(255,140,105,.12)', String(d.reviews.negativeCount), 'تقييمات سلبية (≤ 2)', 'ضمن الفترة المحددة'),
          card('warn', '#FF6B6B', 'rgba(255,107,107,.12)', String(d.disputes.total), 'نزاعات', 'ضمن الفترة المحددة'),
        ];
      case 'overview':
      default:
        return [
          card('person', '#2BD4C7', 'rgba(43,212,199,.12)', String(d.users.total), 'إجمالي الحسابات', `جديد في الفترة: ${d.users.newInRange}`),
          card('market', '#5DA0FF', 'rgba(93,160,255,.12)', String(d.projects.total), 'مشاريع في الفترة', this.prevNote(d.projects.total, p?.projects.total)),
          card('chart', '#59C1F5', 'rgba(89,193,245,.12)', String(d.requests.total), 'طلبات في الفترة', this.prevNote(d.requests.total, p?.requests.total)),
          card('star', '#FFB400', 'rgba(255,180,0,.12)', d.reviews.average === null ? '—' : String(d.reviews.average), 'متوسط التقييم', `من ${d.reviews.count} تقييم`),
        ];
    }
  }

  /* ── export / print: the CSV holds exactly what the active section shows for the active window ── */
  exportSet(): ExportSet | null {
    const d = this.data();
    if (!d) return null;
    const rangeTag = `${this.range().from ?? 'all'}_${this.range().to ?? 'all'}`;
    const statusCols: CsvColumn<any>[] = [{ header: 'الحالة', value: 'label' }, { header: 'العدد', value: 'count' }];
    switch (this.activeSection()) {
      case 'users':
        return { filename: `analytics-users-${rangeTag}`, columns: [{ header: 'نوع الحساب', value: 'label' }, { header: 'الإجمالي', value: 'count' }, { header: 'جديد في الفترة', value: 'newCount' }, { header: 'النسبة من الإجمالي %', value: 'pct' }], rows: this.userTypes() };
      case 'projects':
        return {
          filename: `analytics-projects-${rangeTag}`,
          columns: [{ header: 'المجال', value: 'group' }, ...statusCols],
          rows: [
            ...this.statusRows(d.projects.byStatus).map((r) => ({ group: 'مشاريع', ...r })),
            ...this.statusRows(d.requests.byStatus).map((r) => ({ group: 'طلبات', ...r })),
            ...this.statusRows(d.disputes.byStatus).map((r) => ({ group: 'نزاعات', ...r })),
          ],
        };
      case 'finance':
        return { filename: `analytics-orders-${rangeTag}`, columns: statusCols, rows: this.statusRows(d.orders.byStatus) };
      case 'specialties':
        return { filename: `analytics-specialties-${rangeTag}`, columns: [{ header: 'التخصص', value: 'specialty' }, { header: 'مشاريع (الطلب)', value: 'projects' }, { header: 'مقدمو خدمة (العرض)', value: 'providers' }], rows: this.specialtyRows() };
      case 'affiliates':
        return { filename: `analytics-referrals-${rangeTag}`, columns: statusCols, rows: this.statusRows(d.referrals.byStatus) };
      case 'performance':
        return { filename: `analytics-ratings-${rangeTag}`, columns: [{ header: 'النجوم', value: 'stars' }, { header: 'عدد التقييمات', value: 'count' }, { header: 'النسبة %', value: 'percent' }], rows: d.reviews.distribution };
      case 'overview':
      default:
        return {
          filename: `analytics-overview-${rangeTag}`,
          columns: [{ header: 'المؤشر', value: 'k' }, { header: 'القيمة', value: 'v' }],
          rows: [
            { k: 'إجمالي الحسابات', v: d.users.total },
            { k: 'حسابات جديدة في الفترة', v: d.users.newInRange },
            { k: 'مشاريع في الفترة', v: d.projects.total },
            { k: 'طلبات في الفترة', v: d.requests.total },
            { k: 'عدد التقييمات', v: d.reviews.count },
            { k: 'متوسط التقييم', v: d.reviews.average ?? '' },
          ],
        };
    }
  }

  canExport(): boolean {
    const s = this.exportSet();
    return !!s && s.rows.length > 0;
  }

  exportCsv() {
    const s = this.exportSet();
    if (!s || !s.rows.length) return;
    exportCsv(s.filename, s.columns, s.rows);
  }

  print() {
    printPage('التقارير والتحليلات');
  }
}
