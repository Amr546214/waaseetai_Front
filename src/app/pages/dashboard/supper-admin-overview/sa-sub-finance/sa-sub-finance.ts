import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface RevenueMonth {
  label: string;
  value: number;
}

interface RevenueBreakdown {
  name: string;
  amount: string;
  percent: number;
  color: string;
}

interface FinanceTransaction {
  type: string;
  typeClass: string;
  amount: string;
  positive: boolean;
  party: string;
  date: string;
  status: 'sent' | 'pending';
}

@Component({
  selector: 'app-sa-sub-finance',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-sub-finance.html',
  styleUrl: './sa-sub-finance.css',
})
export class SaSubFinance {
  toast = signal<string | null>(null);

  readonly months: RevenueMonth[] = [
    { label: 'يناير', value: 920 },
    { label: 'فبراير', value: 1100 },
    { label: 'مارس', value: 980 },
    { label: 'أبريل', value: 1340 },
    { label: 'مايو', value: 1520 },
    { label: 'يونيو', value: 1680 },
    { label: 'يوليو', value: 1840 },
  ];

  readonly maxMonthValue = Math.max(...this.months.map((m) => m.value));

  readonly barHeights = computed(() =>
    this.months.map((m) => ({
      label: m.label.slice(0, 3),
      valueLabel: `${Math.round(m.value / 100) / 10}k`,
      heightPct: Math.round((m.value / this.maxMonthValue) * 100),
    })),
  );

  readonly breakdown: RevenueBreakdown[] = [
    { name: 'رسوم إتمام الصفقات (72%)', amount: '10.7M $', percent: 72, color: 'linear-gradient(90deg,#2BD4C7,#2B7FFF)' },
    { name: 'اشتراكات الباقات (20%)', amount: '2.96M $', percent: 20, color: '#5DA0FF' },
    { name: 'خدمات إضافية (8%)', amount: '1.18M $', percent: 8, color: '#D98A0B' },
  ];

  readonly transactions: FinanceTransaction[] = [
    { type: 'رسوم خدمة', typeClass: 'tag-teal', amount: '+3,200 $', positive: true, party: 'مشروع PR-4521', date: 'اليوم', status: 'sent' },
    { type: 'اشتراك Pro', typeClass: 'tag-blue', amount: '+299 $', positive: true, party: 'هيثم القرني', date: 'اليوم', status: 'sent' },
    { type: 'عمولة وسيط', typeClass: 'tag-green', amount: '+840 $', positive: true, party: 'وسيط #112', date: 'أمس', status: 'pending' },
    { type: 'سحب', typeClass: 'tag-orange', amount: '-12,000 $', positive: false, party: 'سارة القحطاني', date: 'أمس', status: 'sent' },
    { type: 'رسوم خدمة', typeClass: 'tag-teal', amount: '+5,800 $', positive: true, party: 'مشروع PR-4498', date: '12 يوليو', status: 'sent' },
  ];

  showToast(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(null), 2500);
  }

  exportPdf() {
    this.showToast('تم إنشاء ملف PDF بنجاح');
  }

  generateMonthlyReport() {
    this.showToast('جاري تجهيز التقرير الشهري…');
  }
}
