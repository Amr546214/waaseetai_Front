import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type ReportTab = 'overview' | 'revenue' | 'expenses' | 'profit';

interface MonthComparison {
  label: string;
  v2026: number;
  v2025: number;
}

interface DonutSlice {
  name: string;
  percent: number;
  color: string;
}

@Component({
  selector: 'app-sa-sub-finance-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-sub-finance-reports.html',
  styleUrl: './sa-sub-finance-reports.css',
})
export class SaSubFinanceReports {
  toast = signal<string | null>(null);
  activeTab = signal<ReportTab>('overview');

  readonly tabs: { key: ReportTab; label: string }[] = [
    { key: 'overview', label: 'نظرة عامة' },
    { key: 'revenue', label: 'الإيرادات' },
    { key: 'expenses', label: 'المصروفات' },
    { key: 'profit', label: 'الأرباح' },
  ];

  readonly months: MonthComparison[] = [
    { label: 'يناير', v2026: 920, v2025: 680 },
    { label: 'فبراير', v2026: 1100, v2025: 740 },
    { label: 'مارس', v2026: 980, v2025: 720 },
    { label: 'أبريل', v2026: 1340, v2025: 880 },
    { label: 'مايو', v2026: 1520, v2025: 960 },
    { label: 'يونيو', v2026: 1680, v2025: 1080 },
    { label: 'يوليو', v2026: 1840, v2025: 1240 },
  ];

  readonly maxValue = Math.max(...this.months.flatMap((m) => [m.v2026, m.v2025]));

  readonly chartBars = computed(() =>
    this.months.map((m) => ({
      label: m.label.slice(0, 3),
      valueLabel: `${Math.round(m.v2026 / 100) / 10}k`,
      h2026: Math.round((m.v2026 / this.maxValue) * 100),
      h2025: Math.round((m.v2025 / this.maxValue) * 100),
    })),
  );

  readonly donut: DonutSlice[] = [
    { name: 'رسوم الخدمة', percent: 72, color: '#2BD4C7' },
    { name: 'اشتراكات', percent: 20, color: '#5DA0FF' },
    { name: 'خدمات إضافية', percent: 8, color: '#D98A0B' },
  ];

  setTab(tab: ReportTab) {
    this.activeTab.set(tab);
  }

  showToast(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(null), 2500);
  }

  exportExcel() {
    this.showToast('تم تصدير التقرير بصيغة Excel');
  }

  exportPdf() {
    this.showToast('تم تصدير التقرير بصيغة PDF');
  }
}
