import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type PeriodKey = '7d' | '30d' | '3m' | '6m' | '1y';
type TxnTab = 'all' | 'fees' | 'subs' | 'comm' | 'invoicing';

interface Transaction {
  id: string;
  type: string;
  typeKey: TxnTab;
  party: string;
  amount: string;
  invoice: string;
  status: 'paid' | 'pending' | 'refunded';
  date: string;
}

interface RevenueSource {
  label: string;
  pct: number;
  value: string;
  color: string;
  dashArray?: string;
  dashOffset?: number;
}

@Component({
  selector: 'app-sa-revenues',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-revenues.html',
  styleUrl: './sa-revenues.css',
})
export class SaRevenues {
  readonly periods: { key: PeriodKey; label: string }[] = [
    { key: '7d', label: '7 أيام' },
    { key: '30d', label: '30 يوم' },
    { key: '3m', label: '3 أشهر' },
    { key: '6m', label: '6 أشهر' },
    { key: '1y', label: 'سنة' },
  ];

  activePeriod = signal<PeriodKey>('30d');
  compareEnabled = signal(true);
  activeTxnTab = signal<TxnTab>('all');

  setPeriod(p: PeriodKey) {
    this.activePeriod.set(p);
  }

  toggleCompare() {
    this.compareEnabled.update((v) => !v);
  }

  setTxnTab(t: TxnTab) {
    this.activeTxnTab.set(t);
  }

  readonly dailyRevenue = [
    { day: '1', thisMonth: 62, lastMonth: 48 },
    { day: '5', thisMonth: 74, lastMonth: 55 },
    { day: '9', thisMonth: 58, lastMonth: 60 },
    { day: '13', thisMonth: 91, lastMonth: 64 },
    { day: '17', thisMonth: 100, lastMonth: 70 },
    { day: '21', thisMonth: 82, lastMonth: 66 },
    { day: '25', thisMonth: 95, lastMonth: 78 },
    { day: '29', thisMonth: 88, lastMonth: 72 },
  ];

  maxBar = computed(() => Math.max(...this.dailyRevenue.map((d) => Math.max(d.thisMonth, d.lastMonth))));

  readonly revenueSources: RevenueSource[] = this.withDonutOffsets([
    { label: 'رسوم المشاريع', pct: 58, value: '1.65M', color: '#2BD4C7' },
    { label: 'رسوم الباقات', pct: 22, value: '624K', color: '#5DA0FF' },
    { label: 'عمولات الوسطاء', pct: 12, value: '341K', color: '#59C1F5' },
    { label: 'نماذج الأعمال', pct: 5, value: '142K', color: '#FFB400' },
    { label: 'Boost + إعلانات', pct: 3, value: '77K', color: '#FF8C69' },
  ]);

  private withDonutOffsets(sources: RevenueSource[]): RevenueSource[] {
    const circumference = 238.8;
    let cumulative = 0;
    return sources.map((s) => {
      const dashArray = `${(s.pct / 100) * circumference} ${circumference}`;
      const dashOffset = -1 * (cumulative / 100) * circumference;
      cumulative += s.pct;
      return { ...s, dashArray, dashOffset };
    });
  }

  readonly monthlyComparison = [
    { metric: 'إجمالي الإيرادات', jan: '2.84M', dec: '2.40M', nov: '2.18M', oct: '1.95M', change: '+18.4%' },
    { metric: 'رسوم النظام', jan: '284K', dec: '240K', nov: '218K', oct: '195K', change: '+18.4%' },
    { metric: 'عمولات الوسطاء', jan: '142K', dec: '132K', nov: '121K', oct: '108K', change: '+7.2%' },
    { metric: 'مشاريع مكتملة', jan: '284', dec: '241', nov: '218', oct: '196', change: '+17.8%' },
    { metric: 'صافي الربح', jan: '2.43M', dec: '2.03M', nov: '1.84M', oct: '1.64M', change: '+19.7%' },
  ];

  readonly transactions: Transaction[] = [
    { id: 'TXN-9821', type: 'رسوم مشروع', typeKey: 'fees', party: 'محمد العمري', amount: '4,200 ر.س', invoice: 'INV-2841', status: 'paid', date: '2025-01-29' },
    { id: 'TXN-9814', type: 'اشتراك باقة Pro', typeKey: 'subs', party: 'شركة الخليج', amount: '999 ر.س', invoice: 'INV-2840', status: 'paid', date: '2025-01-28' },
    { id: 'TXN-9802', type: 'عمولة وسيط', typeKey: 'comm', party: 'خالد المطيري', amount: '312 ر.س', invoice: 'INV-2836', status: 'paid', date: '2025-01-27' },
    { id: 'TXN-9791', type: 'رسوم مشروع', typeKey: 'fees', party: 'سارة القحطاني', amount: '1,850 ر.س', invoice: 'INV-2828', status: 'pending', date: '2025-01-26' },
    { id: 'TXN-9780', type: 'فوترة رسمية B2B', typeKey: 'invoicing', party: 'شركة التقنية المتقدمة', amount: '7,400 ر.س', invoice: 'INV-2815', status: 'paid', date: '2025-01-24' },
    { id: 'TXN-9772', type: 'اشتراك باقة Business', typeKey: 'subs', party: 'مؤسسة الرواد', amount: '399 ر.س', invoice: 'INV-2801', status: 'refunded', date: '2025-01-22' },
  ];

  filteredTransactions = computed(() => {
    const tab = this.activeTxnTab();
    return tab === 'all' ? this.transactions : this.transactions.filter((t) => t.typeKey === tab);
  });

  readonly txnStatusLabels: Record<Transaction['status'], string> = {
    paid: 'مدفوع',
    pending: 'قيد التحصيل',
    refunded: 'مُسترجع',
  };

  exportReport(kind: string) {
    // mock export action — no backend for finance exports yet
    alert(`سيتم تصدير التقرير بصيغة ${kind}`);
  }
}
