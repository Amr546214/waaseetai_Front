import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ForecastSummaryComponent } from './forecast-summary.component';
import { CsvColumn, exportCsv, printPage } from '../../../../core/utils/export.util';

type ReportTab = 'overview' | 'revenue' | 'expenses' | 'profit';

interface MonthPoint {
  label: string;
  v2026: number;
  v2025: number;
}

@Component({
  selector: 'app-sa-finance-reports',
  standalone: true,
  imports: [CommonModule, ForecastSummaryComponent],
  templateUrl: './sa-finance-reports.html',
  styleUrl: './sa-finance-reports.css',
})
export class SaFinanceReports {
  activeTab = signal<ReportTab>('overview');

  readonly tabs: { key: ReportTab; label: string }[] = [
    { key: 'overview', label: 'نظرة عامة' },
    { key: 'revenue', label: 'الإيرادات' },
    { key: 'expenses', label: 'المصروفات' },
    { key: 'profit', label: 'الأرباح' },
  ];

  setTab(t: ReportTab) {
    this.activeTab.set(t);
  }

  readonly months: MonthPoint[] = [
    { label: 'يناير', v2026: 920, v2025: 680 },
    { label: 'فبراير', v2026: 1100, v2025: 740 },
    { label: 'مارس', v2026: 980, v2025: 720 },
    { label: 'أبريل', v2026: 1340, v2025: 880 },
    { label: 'مايو', v2026: 1520, v2025: 960 },
    { label: 'يونيو', v2026: 1680, v2025: 1080 },
    { label: 'يوليو', v2026: 1840, v2025: 1240 },
  ];

  maxMonth = computed(() => Math.max(...this.months.map((m) => Math.max(m.v2026, m.v2025))));

  readonly revenueDistribution = [
    { label: 'رسوم الخدمة', pct: 72, color: '#2BD4C7' },
    { label: 'اشتراكات', pct: 20, color: '#5DA0FF' },
    { label: 'خدمات إضافية', pct: 8, color: '#D98A0B' },
  ];

  readonly expenseBreakdown = [
    { label: 'رواتب الفريق', value: '1.8M', pct: 42, color: '#FF8C69' },
    { label: 'بنية تقنية (IT)', value: '620K', pct: 15, color: '#5DA0FF' },
    { label: 'عمولات مدفوعة', value: '1.4M', pct: 33, color: '#59C1F5' },
    { label: 'تسويق ونمو', value: '430K', pct: 10, color: '#FFB400' },
  ];

  readonly profitTrend = [
    { month: 'مارس', profit: '6.8M', margin: '58%' },
    { month: 'أبريل', profit: '7.4M', margin: '59%' },
    { month: 'مايو', profit: '8.1M', margin: '60%' },
    { month: 'يونيو', profit: '8.7M', margin: '61%' },
    { month: 'يوليو', profit: '9.2M', margin: '62%' },
  ];

  /** Rows of the tab currently shown (whatever the page displays), for the CSV export. */
  exportSet(): { columns: CsvColumn<any>[]; rows: any[] } {
    switch (this.activeTab()) {
      case 'revenue':
        return { columns: [{ header: 'المصدر', value: 'label' }, { header: 'النسبة %', value: 'pct' }], rows: this.revenueDistribution };
      case 'expenses':
        return { columns: [{ header: 'البند', value: 'label' }, { header: 'القيمة', value: 'value' }, { header: 'النسبة %', value: 'pct' }], rows: this.expenseBreakdown };
      case 'profit':
        return { columns: [{ header: 'الشهر', value: 'month' }, { header: 'صافي الربح', value: 'profit' }, { header: 'هامش الربح', value: 'margin' }], rows: this.profitTrend };
      case 'overview':
      default:
        return { columns: [{ header: 'الشهر', value: 'label' }, { header: '2026', value: 'v2026' }, { header: '2025', value: 'v2025' }], rows: this.months };
    }
  }

  exportCsv() {
    const { columns, rows } = this.exportSet();
    if (rows.length) exportCsv(`finance-report-${this.activeTab()}`, columns, rows);
  }

  print() {
    printPage('التقارير المالية');
  }
}
