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

  private readonly dailyRevenueByPeriod: Record<PeriodKey, { day: string; thisMonth: number; lastMonth: number }[]> = {
    '7d': [
      { day: 'السبت', thisMonth: 68, lastMonth: 52 },
      { day: 'الأحد', thisMonth: 74, lastMonth: 58 },
      { day: 'الاثنين', thisMonth: 61, lastMonth: 55 },
      { day: 'الثلاثاء', thisMonth: 88, lastMonth: 70 },
      { day: 'الأربعاء', thisMonth: 95, lastMonth: 78 },
      { day: 'الخميس', thisMonth: 92, lastMonth: 74 },
      { day: 'الجمعة', thisMonth: 88, lastMonth: 72 },
    ],
    '30d': [
      { day: '1', thisMonth: 62, lastMonth: 48 },
      { day: '5', thisMonth: 74, lastMonth: 55 },
      { day: '9', thisMonth: 58, lastMonth: 60 },
      { day: '13', thisMonth: 91, lastMonth: 64 },
      { day: '17', thisMonth: 100, lastMonth: 70 },
      { day: '21', thisMonth: 82, lastMonth: 66 },
      { day: '25', thisMonth: 95, lastMonth: 78 },
      { day: '29', thisMonth: 88, lastMonth: 72 },
    ],
    '3m': [
      { day: 'نوفمبر', thisMonth: 78, lastMonth: 62 },
      { day: 'ديسمبر', thisMonth: 86, lastMonth: 71 },
      { day: 'يناير', thisMonth: 100, lastMonth: 80 },
    ],
    '6m': [
      { day: 'أغسطس', thisMonth: 58, lastMonth: 46 },
      { day: 'سبتمبر', thisMonth: 64, lastMonth: 51 },
      { day: 'أكتوبر', thisMonth: 71, lastMonth: 57 },
      { day: 'نوفمبر', thisMonth: 78, lastMonth: 62 },
      { day: 'ديسمبر', thisMonth: 86, lastMonth: 71 },
      { day: 'يناير', thisMonth: 100, lastMonth: 80 },
    ],
    '1y': [
      { day: 'فبراير', thisMonth: 40, lastMonth: 34 },
      { day: 'أبريل', thisMonth: 48, lastMonth: 39 },
      { day: 'يونيو', thisMonth: 55, lastMonth: 44 },
      { day: 'أغسطس', thisMonth: 58, lastMonth: 46 },
      { day: 'أكتوبر', thisMonth: 71, lastMonth: 57 },
      { day: 'ديسمبر', thisMonth: 86, lastMonth: 71 },
      { day: 'يناير', thisMonth: 100, lastMonth: 80 },
    ],
  };

  readonly dailyRevenue = computed(() => this.dailyRevenueByPeriod[this.activePeriod()]);

  maxBar = computed(() => Math.max(...this.dailyRevenue().map((d) => Math.max(d.thisMonth, d.lastMonth))));

  private readonly revenueSourcesByPeriod: Record<PeriodKey, RevenueSource[]> = {
    '7d': [
      { label: 'رسوم المشاريع', pct: 54, value: '312K', color: '#2BD4C7' },
      { label: 'رسوم الباقات', pct: 24, value: '138K', color: '#5DA0FF' },
      { label: 'عمولات الوسطاء', pct: 13, value: '75K', color: '#59C1F5' },
      { label: 'نماذج الأعمال', pct: 6, value: '35K', color: '#FFB400' },
      { label: 'Boost + إعلانات', pct: 3, value: '17K', color: '#FF8C69' },
    ],
    '30d': [
      { label: 'رسوم المشاريع', pct: 58, value: '1.65M', color: '#2BD4C7' },
      { label: 'رسوم الباقات', pct: 22, value: '624K', color: '#5DA0FF' },
      { label: 'عمولات الوسطاء', pct: 12, value: '341K', color: '#59C1F5' },
      { label: 'نماذج الأعمال', pct: 5, value: '142K', color: '#FFB400' },
      { label: 'Boost + إعلانات', pct: 3, value: '77K', color: '#FF8C69' },
    ],
    '3m': [
      { label: 'رسوم المشاريع', pct: 56, value: '4.62M', color: '#2BD4C7' },
      { label: 'رسوم الباقات', pct: 23, value: '1.9M', color: '#5DA0FF' },
      { label: 'عمولات الوسطاء', pct: 13, value: '1.07M', color: '#59C1F5' },
      { label: 'نماذج الأعمال', pct: 5, value: '412K', color: '#FFB400' },
      { label: 'Boost + إعلانات', pct: 3, value: '247K', color: '#FF8C69' },
    ],
    '6m': [
      { label: 'رسوم المشاريع', pct: 55, value: '9.1M', color: '#2BD4C7' },
      { label: 'رسوم الباقات', pct: 24, value: '3.97M', color: '#5DA0FF' },
      { label: 'عمولات الوسطاء', pct: 12, value: '1.98M', color: '#59C1F5' },
      { label: 'نماذج الأعمال', pct: 6, value: '992K', color: '#FFB400' },
      { label: 'Boost + إعلانات', pct: 3, value: '496K', color: '#FF8C69' },
    ],
    '1y': [
      { label: 'رسوم المشاريع', pct: 53, value: '18.4M', color: '#2BD4C7' },
      { label: 'رسوم الباقات', pct: 25, value: '8.68M', color: '#5DA0FF' },
      { label: 'عمولات الوسطاء', pct: 13, value: '4.51M', color: '#59C1F5' },
      { label: 'نماذج الأعمال', pct: 6, value: '2.08M', color: '#FFB400' },
      { label: 'Boost + إعلانات', pct: 3, value: '1.04M', color: '#FF8C69' },
    ],
  };

  readonly revenueSources = computed(() => this.withDonutOffsets(this.revenueSourcesByPeriod[this.activePeriod()]));

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

  private readonly monthlyComparisonByPeriod: Record<PeriodKey, { metric: string; jan: string; dec: string; nov: string; oct: string; change: string }[]> = {
    '7d': [
      { metric: 'إجمالي الإيرادات', jan: '486K', dec: '412K', nov: '378K', oct: '340K', change: '+18.0%' },
      { metric: 'رسوم النظام', jan: '48.6K', dec: '41.2K', nov: '37.8K', oct: '34K', change: '+18.0%' },
      { metric: 'عمولات الوسطاء', jan: '24.3K', dec: '22.6K', nov: '20.8K', oct: '18.4K', change: '+7.5%' },
      { metric: 'مشاريع مكتملة', jan: '48', dec: '41', nov: '37', oct: '33', change: '+17.1%' },
      { metric: 'صافي الربح', jan: '415K', dec: '350K', nov: '318K', oct: '282K', change: '+18.6%' },
    ],
    '30d': [
      { metric: 'إجمالي الإيرادات', jan: '2.84M', dec: '2.40M', nov: '2.18M', oct: '1.95M', change: '+18.4%' },
      { metric: 'رسوم النظام', jan: '284K', dec: '240K', nov: '218K', oct: '195K', change: '+18.4%' },
      { metric: 'عمولات الوسطاء', jan: '142K', dec: '132K', nov: '121K', oct: '108K', change: '+7.2%' },
      { metric: 'مشاريع مكتملة', jan: '284', dec: '241', nov: '218', oct: '196', change: '+17.8%' },
      { metric: 'صافي الربح', jan: '2.43M', dec: '2.03M', nov: '1.84M', oct: '1.64M', change: '+19.7%' },
    ],
    '3m': [
      { metric: 'إجمالي الإيرادات', jan: '8.12M', dec: '6.85M', nov: '6.21M', oct: '5.58M', change: '+18.5%' },
      { metric: 'رسوم النظام', jan: '812K', dec: '685K', nov: '621K', oct: '558K', change: '+18.5%' },
      { metric: 'عمولات الوسطاء', jan: '406K', dec: '378K', nov: '345K', oct: '309K', change: '+7.4%' },
      { metric: 'مشاريع مكتملة', jan: '812', dec: '689', nov: '624', oct: '561', change: '+17.9%' },
      { metric: 'صافي الربح', jan: '6.94M', dec: '5.80M', nov: '5.26M', oct: '4.69M', change: '+19.7%' },
    ],
    '6m': [
      { metric: 'إجمالي الإيرادات', jan: '15.9M', dec: '13.4M', nov: '12.1M', oct: '10.9M', change: '+18.7%' },
      { metric: 'رسوم النظام', jan: '1.59M', dec: '1.34M', nov: '1.21M', oct: '1.09M', change: '+18.7%' },
      { metric: 'عمولات الوسطاء', jan: '795K', dec: '740K', nov: '677K', oct: '605K', change: '+7.4%' },
      { metric: 'مشاريع مكتملة', jan: '1,590', dec: '1,349', nov: '1,220', oct: '1,096', change: '+17.9%' },
      { metric: 'صافي الربح', jan: '13.6M', dec: '11.3M', nov: '10.3M', oct: '9.17M', change: '+20.4%' },
    ],
    '1y': [
      { metric: 'إجمالي الإيرادات', jan: '31.6M', dec: '26.7M', nov: '24.2M', oct: '21.8M', change: '+18.3%' },
      { metric: 'رسوم النظام', jan: '3.16M', dec: '2.67M', nov: '2.42M', oct: '2.18M', change: '+18.3%' },
      { metric: 'عمولات الوسطاء', jan: '1.58M', dec: '1.47M', nov: '1.35M', oct: '1.21M', change: '+7.5%' },
      { metric: 'مشاريع مكتملة', jan: '3,160', dec: '2,682', nov: '2,428', oct: '2,180', change: '+17.8%' },
      { metric: 'صافي الربح', jan: '27.0M', dec: '22.5M', nov: '20.4M', oct: '18.2M', change: '+20.0%' },
    ],
  };

  readonly monthlyComparison = computed(() => this.monthlyComparisonByPeriod[this.activePeriod()]);

  private readonly transactionsByPeriod: Record<PeriodKey, Transaction[]> = {
    '7d': [
      { id: 'TXN-9821', type: 'رسوم مشروع', typeKey: 'fees', party: 'محمد العمري', amount: '4,200 $', invoice: 'INV-2841', status: 'paid', date: '2025-01-29' },
      { id: 'TXN-9814', type: 'اشتراك باقة Pro', typeKey: 'subs', party: 'شركة الخليج', amount: '999 $', invoice: 'INV-2840', status: 'paid', date: '2025-01-28' },
      { id: 'TXN-9802', type: 'عمولة وسيط', typeKey: 'comm', party: 'خالد المطيري', amount: '312 $', invoice: 'INV-2836', status: 'paid', date: '2025-01-27' },
    ],
    '30d': [
      { id: 'TXN-9821', type: 'رسوم مشروع', typeKey: 'fees', party: 'محمد العمري', amount: '4,200 $', invoice: 'INV-2841', status: 'paid', date: '2025-01-29' },
      { id: 'TXN-9814', type: 'اشتراك باقة Pro', typeKey: 'subs', party: 'شركة الخليج', amount: '999 $', invoice: 'INV-2840', status: 'paid', date: '2025-01-28' },
      { id: 'TXN-9802', type: 'عمولة وسيط', typeKey: 'comm', party: 'خالد المطيري', amount: '312 $', invoice: 'INV-2836', status: 'paid', date: '2025-01-27' },
      { id: 'TXN-9791', type: 'رسوم مشروع', typeKey: 'fees', party: 'سارة القحطاني', amount: '1,850 $', invoice: 'INV-2828', status: 'pending', date: '2025-01-26' },
      { id: 'TXN-9780', type: 'فوترة رسمية B2B', typeKey: 'invoicing', party: 'شركة التقنية المتقدمة', amount: '7,400 $', invoice: 'INV-2815', status: 'paid', date: '2025-01-24' },
      { id: 'TXN-9772', type: 'اشتراك باقة Business', typeKey: 'subs', party: 'مؤسسة الرواد', amount: '399 $', invoice: 'INV-2801', status: 'refunded', date: '2025-01-22' },
    ],
    '3m': [
      { id: 'TXN-9772', type: 'اشتراك باقة Business', typeKey: 'subs', party: 'مؤسسة الرواد', amount: '399 $', invoice: 'INV-2801', status: 'refunded', date: '2025-01-22' },
      { id: 'TXN-9780', type: 'فوترة رسمية B2B', typeKey: 'invoicing', party: 'شركة التقنية المتقدمة', amount: '7,400 $', invoice: 'INV-2815', status: 'paid', date: '2025-01-24' },
      { id: 'TXN-9650', type: 'رسوم مشروع', typeKey: 'fees', party: 'عبدالله الغامدي', amount: '2,960 $', invoice: 'INV-2712', status: 'paid', date: '2024-12-18' },
      { id: 'TXN-9522', type: 'عمولة وسيط', typeKey: 'comm', party: 'فهد الزهراني', amount: '480 $', invoice: 'INV-2601', status: 'paid', date: '2024-11-09' },
      { id: 'TXN-9411', type: 'اشتراك باقة Pro', typeKey: 'subs', party: 'مؤسسة النخبة', amount: '999 $', invoice: 'INV-2504', status: 'pending', date: '2024-11-02' },
    ],
    '6m': [
      { id: 'TXN-9780', type: 'فوترة رسمية B2B', typeKey: 'invoicing', party: 'شركة التقنية المتقدمة', amount: '7,400 $', invoice: 'INV-2815', status: 'paid', date: '2025-01-24' },
      { id: 'TXN-9522', type: 'عمولة وسيط', typeKey: 'comm', party: 'فهد الزهراني', amount: '480 $', invoice: 'INV-2601', status: 'paid', date: '2024-11-09' },
      { id: 'TXN-9204', type: 'رسوم مشروع', typeKey: 'fees', party: 'منيرة العتيبي', amount: '3,120 $', invoice: 'INV-2340', status: 'paid', date: '2024-09-14' },
      { id: 'TXN-8977', type: 'اشتراك باقة Business', typeKey: 'subs', party: 'شركة الابتكار', amount: '399 $', invoice: 'INV-2188', status: 'refunded', date: '2024-08-30' },
      { id: 'TXN-8850', type: 'فوترة رسمية B2B', typeKey: 'invoicing', party: 'مجموعة الرياض التجارية', amount: '9,100 $', invoice: 'INV-2075', status: 'paid', date: '2024-08-05' },
    ],
    '1y': [
      { id: 'TXN-9780', type: 'فوترة رسمية B2B', typeKey: 'invoicing', party: 'شركة التقنية المتقدمة', amount: '7,400 $', invoice: 'INV-2815', status: 'paid', date: '2025-01-24' },
      { id: 'TXN-9204', type: 'رسوم مشروع', typeKey: 'fees', party: 'منيرة العتيبي', amount: '3,120 $', invoice: 'INV-2340', status: 'paid', date: '2024-09-14' },
      { id: 'TXN-8850', type: 'فوترة رسمية B2B', typeKey: 'invoicing', party: 'مجموعة الرياض التجارية', amount: '9,100 $', invoice: 'INV-2075', status: 'paid', date: '2024-08-05' },
      { id: 'TXN-8412', type: 'عمولة وسيط', typeKey: 'comm', party: 'ياسر القحطاني', amount: '560 $', invoice: 'INV-1902', status: 'paid', date: '2024-05-19' },
      { id: 'TXN-8033', type: 'اشتراك باقة Pro', typeKey: 'subs', party: 'شركة الخليج', amount: '999 $', invoice: 'INV-1744', status: 'pending', date: '2024-03-02' },
    ],
  };

  readonly transactions = computed(() => this.transactionsByPeriod[this.activePeriod()]);

  filteredTransactions = computed(() => {
    const tab = this.activeTxnTab();
    const txns = this.transactions();
    return tab === 'all' ? txns : txns.filter((t) => t.typeKey === tab);
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
