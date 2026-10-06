import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type SectionKey = 'overview' | 'users' | 'projects' | 'finance' | 'specialties' | 'affiliates' | 'performance';
type PeriodKey = '7d' | '30d' | '3m' | '6m' | '1y';

interface AlertItem {
  level: 'danger' | 'warn' | 'good';
  text: string;
  note: string;
}

interface KpiCard {
  icon: string;
  color: string;
  bg: string;
  val: string;
  lbl: string;
  sub: string;
}

@Component({
  selector: 'app-sa-analytics-hub',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-analytics-hub.html',
  styleUrl: './sa-analytics-hub.css',
})
export class SaAnalyticsHub {
  activeSection = signal<SectionKey>('overview');
  activePeriod = signal<PeriodKey>('30d');
  compareEnabled = signal(true);

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

  setSection(s: SectionKey) {
    this.activeSection.set(s);
  }

  setPeriod(p: PeriodKey) {
    this.activePeriod.set(p);
  }

  toggleCompare() {
    this.compareEnabled.update((v) => !v);
  }

  saveReport() {
    alert('تم حفظ إعداد هذا التقرير للرجوع إليه لاحقاً');
  }

  exportReport(kind: string) {
    alert(`سيتم تصدير التقرير بصيغة ${kind}`);
  }

  /* ── Overview ── */
  private readonly alertsByPeriod: Record<PeriodKey, AlertItem[]> = {
    '7d': [
      { level: 'danger', text: 'معدل النزاعات ارتفع 9% خلال آخر 7 أيام', note: 'نزاعات التصميم أعلى من المعدل' },
      { level: 'warn', text: '4 طلبات بلا عروض منذ أكثر من يومين', note: 'تخصصات: Blockchain + تصميم 3D' },
      { level: 'good', text: 'الإيرادات نمت 3.2% هذا الأسبوع', note: 'مشاريع برمجة الويب المحرك الرئيسي' },
    ],
    '30d': [
      { level: 'danger', text: 'معدل النزاعات ارتفع 34% هذا الأسبوع', note: 'نزاعات التصميم أعلى من المعدل' },
      { level: 'warn', text: '12 طلباً بلا عروض منذ أكثر من 7 أيام', note: 'تخصصات: Blockchain + 3D' },
      { level: 'good', text: 'الإيرادات نمت 18.4% — أعلى من المستهدف 15%', note: 'مشاريع برمجة الويب المحرك الرئيسي' },
    ],
    '3m': [
      { level: 'danger', text: 'معدل النزاعات ارتفع 21% خلال آخر 3 أشهر', note: 'نزاعات التصميم أعلى من المعدل' },
      { level: 'warn', text: '27 طلباً بلا عروض منذ أكثر من 7 أيام', note: 'تخصصات: Blockchain + 3D' },
      { level: 'good', text: 'الإيرادات نمت 41% — أعلى من المستهدف الربعي 35%', note: 'مشاريع برمجة الويب المحرك الرئيسي' },
    ],
    '6m': [
      { level: 'danger', text: 'معدل النزاعات ارتفع 15% خلال آخر 6 أشهر', note: 'نزاعات التصميم أعلى من المعدل' },
      { level: 'warn', text: '19 طلباً بلا عروض منذ أكثر من 10 أيام', note: 'تخصصات: Blockchain + 3D' },
      { level: 'good', text: 'الإيرادات نمت 62% — أعلى من المستهدف نصف السنوي 50%', note: 'مشاريع برمجة الويب المحرك الرئيسي' },
    ],
    '1y': [
      { level: 'danger', text: 'معدل النزاعات ارتفع 8% خلال العام الماضي', note: 'نزاعات التصميم أعلى من المعدل' },
      { level: 'warn', text: '34 طلباً بلا عروض منذ أكثر من أسبوعين', note: 'تخصصات: Blockchain + 3D' },
      { level: 'good', text: 'الإيرادات نمت 96% — أعلى من المستهدف السنوي 80%', note: 'مشاريع برمجة الويب المحرك الرئيسي' },
    ],
  };
  alerts = computed(() => this.alertsByPeriod[this.activePeriod()]);

  private readonly revenueMonthLabels = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  private readonly revenueByPeriod: Record<PeriodKey, { v: number; prev: number }[]> = {
    '7d': [
      { v: 210, prev: 180 }, { v: 225, prev: 190 }, { v: 198, prev: 175 }, { v: 240, prev: 205 },
      { v: 255, prev: 215 }, { v: 238, prev: 200 }, { v: 260, prev: 220 }, { v: 275, prev: 230 },
      { v: 268, prev: 225 }, { v: 290, prev: 245 }, { v: 305, prev: 255 }, { v: 298, prev: 248 },
    ],
    '30d': [
      { v: 1180, prev: 940 }, { v: 1240, prev: 980 }, { v: 1320, prev: 1010 }, { v: 1290, prev: 1040 },
      { v: 1410, prev: 1090 }, { v: 1480, prev: 1120 }, { v: 1560, prev: 1180 }, { v: 1620, prev: 1230 },
      { v: 1590, prev: 1260 }, { v: 1710, prev: 1300 }, { v: 1780, prev: 1340 }, { v: 1840, prev: 1400 },
    ],
    '3m': [
      { v: 1450, prev: 1150 }, { v: 1510, prev: 1190 }, { v: 1600, prev: 1230 }, { v: 1580, prev: 1260 },
      { v: 1690, prev: 1310 }, { v: 1760, prev: 1350 }, { v: 1840, prev: 1410 }, { v: 1900, prev: 1460 },
      { v: 1870, prev: 1490 }, { v: 1980, prev: 1530 }, { v: 2040, prev: 1570 }, { v: 2110, prev: 1620 },
    ],
    '6m': [
      { v: 1820, prev: 1400 }, { v: 1900, prev: 1450 }, { v: 2010, prev: 1500 }, { v: 1980, prev: 1540 },
      { v: 2120, prev: 1600 }, { v: 2210, prev: 1650 }, { v: 2320, prev: 1720 }, { v: 2410, prev: 1780 },
      { v: 2370, prev: 1810 }, { v: 2510, prev: 1870 }, { v: 2600, prev: 1920 }, { v: 2690, prev: 1980 },
    ],
    '1y': [
      { v: 2350, prev: 1750 }, { v: 2480, prev: 1820 }, { v: 2620, prev: 1890 }, { v: 2580, prev: 1940 },
      { v: 2760, prev: 2020 }, { v: 2890, prev: 2090 }, { v: 3040, prev: 2180 }, { v: 3160, prev: 2260 },
      { v: 3110, prev: 2300 }, { v: 3290, prev: 2380 }, { v: 3410, prev: 2450 }, { v: 3540, prev: 2530 },
    ],
  };
  revenueMonths = computed(() =>
    this.revenueByPeriod[this.activePeriod()].map((d, i) => ({ m: this.revenueMonthLabels[i], v: d.v, prev: d.prev })),
  );
  maxRevenueMonth = computed(() => Math.max(...this.revenueMonths().map((m) => Math.max(m.v, m.prev))));

  private readonly conversionFunnelByPeriod: Record<PeriodKey, { label: string; value: string; pct: number }[]> = {
    '7d': [
      { label: 'زيارات وسيط AI', value: '18,400', pct: 100 },
      { label: 'تسجيلات جديدة', value: '52', pct: 68 },
      { label: 'طلبات أُنشئت', value: '214', pct: 51 },
      { label: 'عقود موقّعة', value: '142', pct: 34 },
      { label: 'مشاريع مكتملة', value: '41', pct: 19 },
    ],
    '30d': [
      { label: 'زيارات وسيط AI', value: '124,800', pct: 100 },
      { label: 'تسجيلات جديدة', value: '218', pct: 72 },
      { label: 'طلبات أُنشئت', value: '1,284', pct: 55 },
      { label: 'عقود موقّعة', value: '892', pct: 38 },
      { label: 'مشاريع مكتملة', value: '284', pct: 22 },
    ],
    '3m': [
      { label: 'زيارات وسيط AI', value: '358,200', pct: 100 },
      { label: 'تسجيلات جديدة', value: '642', pct: 74 },
      { label: 'طلبات أُنشئت', value: '3,820', pct: 57 },
      { label: 'عقود موقّعة', value: '2,640', pct: 40 },
      { label: 'مشاريع مكتملة', value: '860', pct: 24 },
    ],
    '6m': [
      { label: 'زيارات وسيط AI', value: '742,600', pct: 100 },
      { label: 'تسجيلات جديدة', value: '1,340', pct: 76 },
      { label: 'طلبات أُنشئت', value: '7,960', pct: 59 },
      { label: 'عقود موقّعة', value: '5,510', pct: 42 },
      { label: 'مشاريع مكتملة', value: '1,780', pct: 26 },
    ],
    '1y': [
      { label: 'زيارات وسيط AI', value: '1,486,000', pct: 100 },
      { label: 'تسجيلات جديدة', value: '2,780', pct: 78 },
      { label: 'طلبات أُنشئت', value: '16,240', pct: 61 },
      { label: 'عقود موقّعة', value: '11,280', pct: 44 },
      { label: 'مشاريع مكتملة', value: '3,640', pct: 28 },
    ],
  };
  conversionFunnel = computed(() => this.conversionFunnelByPeriod[this.activePeriod()]);

  private readonly topSpecialtiesByPeriod: Record<PeriodKey, { name: string; revenue: string; projects: number; growth: string; up: boolean }[]> = {
    '7d': [
      { name: 'برمجة ويب', revenue: '62K', projects: 9, growth: '+5%', up: true },
      { name: 'تصميم UI/UX', revenue: '48K', projects: 7, growth: '+4%', up: true },
      { name: 'تسويق رقمي', revenue: '31K', projects: 5, growth: '+2%', up: true },
      { name: 'تطبيقات جوال', revenue: '28K', projects: 4, growth: '+1%', up: true },
      { name: 'محتوى وكتابة', revenue: '18K', projects: 6, growth: '+2%', up: true },
      { name: 'Blockchain', revenue: '12K', projects: 1, growth: '-1%', up: false },
    ],
    '30d': [
      { name: 'برمجة ويب', revenue: '842K', projects: 96, growth: '+24%', up: true },
      { name: 'تصميم UI/UX', revenue: '624K', projects: 78, growth: '+18%', up: true },
      { name: 'تسويق رقمي', revenue: '418K', projects: 52, growth: '+12%', up: true },
      { name: 'تطبيقات جوال', revenue: '384K', projects: 38, growth: '+6%', up: true },
      { name: 'محتوى وكتابة', revenue: '241K', projects: 64, growth: '+9%', up: true },
      { name: 'Blockchain', revenue: '184K', projects: 12, growth: '-3%', up: false },
    ],
    '3m': [
      { name: 'برمجة ويب', revenue: '2.28M', projects: 268, growth: '+29%', up: true },
      { name: 'تصميم UI/UX', revenue: '1.71M', projects: 214, growth: '+22%', up: true },
      { name: 'تسويق رقمي', revenue: '1.12M', projects: 148, growth: '+15%', up: true },
      { name: 'تطبيقات جوال', revenue: '0.98M', projects: 104, growth: '+8%', up: true },
      { name: 'محتوى وكتابة', revenue: '0.64M', projects: 176, growth: '+11%', up: true },
      { name: 'Blockchain', revenue: '0.41M', projects: 29, growth: '-6%', up: false },
    ],
    '6m': [
      { name: 'برمجة ويب', revenue: '4.6M', projects: 512, growth: '+38%', up: true },
      { name: 'تصميم UI/UX', revenue: '3.4M', projects: 406, growth: '+29%', up: true },
      { name: 'تسويق رقمي', revenue: '2.3M', projects: 284, growth: '+19%', up: true },
      { name: 'تطبيقات جوال', revenue: '2.0M', projects: 198, growth: '+11%', up: true },
      { name: 'محتوى وكتابة', revenue: '1.3M', projects: 342, growth: '+16%', up: true },
      { name: 'Blockchain', revenue: '0.86M', projects: 58, growth: '-9%', up: false },
    ],
    '1y': [
      { name: 'برمجة ويب', revenue: '9.8M', projects: 1042, growth: '+52%', up: true },
      { name: 'تصميم UI/UX', revenue: '7.2M', projects: 836, growth: '+41%', up: true },
      { name: 'تسويق رقمي', revenue: '4.9M', projects: 592, growth: '+27%', up: true },
      { name: 'تطبيقات جوال', revenue: '4.3M', projects: 406, growth: '+18%', up: true },
      { name: 'محتوى وكتابة', revenue: '2.7M', projects: 704, growth: '+22%', up: true },
      { name: 'Blockchain', revenue: '1.9M', projects: 112, growth: '-14%', up: false },
    ],
  };
  topSpecialties = computed(() => this.topSpecialtiesByPeriod[this.activePeriod()]);

  private readonly geoDistributionByPeriod: Record<PeriodKey, { city: string; pct: number; color: string }[]> = {
    '7d': [
      { city: 'الرياض', pct: 71, color: '#2BD4C7' },
      { city: 'جدة', pct: 16, color: '#5DA0FF' },
      { city: 'الدمام', pct: 8, color: '#59C1F5' },
      { city: 'أخرى', pct: 5, color: '#FFB400' },
    ],
    '30d': [
      { city: 'الرياض', pct: 68, color: '#2BD4C7' },
      { city: 'جدة', pct: 18, color: '#5DA0FF' },
      { city: 'الدمام', pct: 8, color: '#59C1F5' },
      { city: 'أخرى', pct: 6, color: '#FFB400' },
    ],
    '3m': [
      { city: 'الرياض', pct: 65, color: '#2BD4C7' },
      { city: 'جدة', pct: 20, color: '#5DA0FF' },
      { city: 'الدمام', pct: 9, color: '#59C1F5' },
      { city: 'أخرى', pct: 6, color: '#FFB400' },
    ],
    '6m': [
      { city: 'الرياض', pct: 63, color: '#2BD4C7' },
      { city: 'جدة', pct: 21, color: '#5DA0FF' },
      { city: 'الدمام', pct: 10, color: '#59C1F5' },
      { city: 'أخرى', pct: 6, color: '#FFB400' },
    ],
    '1y': [
      { city: 'الرياض', pct: 60, color: '#2BD4C7' },
      { city: 'جدة', pct: 23, color: '#5DA0FF' },
      { city: 'الدمام', pct: 11, color: '#59C1F5' },
      { city: 'أخرى', pct: 6, color: '#FFB400' },
    ],
  };
  geoDistribution = computed(() => this.geoDistributionByPeriod[this.activePeriod()]);

  readonly opportunityCities = ['مكة المكرمة', 'تبوك', 'أبها'];

  /* ── Users ── */
  private readonly userTypeLabels = ['طالب خدمة (فرد)', 'طالب خدمة (شركة)', 'مقدم خدمة (فرد)', 'مقدم خدمة (شركة)', 'وسطاء تسويقيون'];
  private readonly userTypeColors = ['#2BD4C7', '#FFB400', '#5DA0FF', '#59C1F5', '#0FA99A'];
  private readonly userTypesByPeriod: Record<PeriodKey, { count: string; pct: number; growth: string; newCount: number }[]> = {
    '7d': [
      { count: '3.9K', pct: 34, growth: '+0.6%', newCount: 14 },
      { count: '1.7K', pct: 15, growth: '+0.5%', newCount: 6 },
      { count: '4.8K', pct: 41, growth: '+0.9%', newCount: 17 },
      { count: '850', pct: 7, growth: '+0.3%', newCount: 3 },
      { count: '360', pct: 3, growth: '+0.8%', newCount: 3 },
    ],
    '30d': [
      { count: '4.2K', pct: 34, growth: '+3.1%', newCount: 84 },
      { count: '1.8K', pct: 15, growth: '+2.8%', newCount: 32 },
      { count: '5.1K', pct: 41, growth: '+5.2%', newCount: 96 },
      { count: '890', pct: 7, growth: '+1.9%', newCount: 14 },
      { count: '382', pct: 3, growth: '+4.7%', newCount: 18 },
    ],
    '3m': [
      { count: '4.9K', pct: 33, growth: '+9.4%', newCount: 268 },
      { count: '2.1K', pct: 15, growth: '+8.1%', newCount: 98 },
      { count: '6.0K', pct: 41, growth: '+15.6%', newCount: 312 },
      { count: '980', pct: 7, growth: '+5.7%', newCount: 42 },
      { count: '440', pct: 3, growth: '+13.2%', newCount: 52 },
    ],
    '6m': [
      { count: '5.6K', pct: 32, growth: '+18.2%', newCount: 540 },
      { count: '2.4K', pct: 14, growth: '+16.0%', newCount: 196 },
      { count: '7.2K', pct: 41, growth: '+28.4%', newCount: 640 },
      { count: '1.1K', pct: 6, growth: '+11.5%', newCount: 82 },
      { count: '520', pct: 3, growth: '+24.6%', newCount: 104 },
    ],
    '1y': [
      { count: '7.1K', pct: 31, growth: '+38.6%', newCount: 1120 },
      { count: '3.0K', pct: 13, growth: '+33.2%', newCount: 410 },
      { count: '9.4K', pct: 42, growth: '+56.8%', newCount: 1380 },
      { count: '1.4K', pct: 6, growth: '+22.4%', newCount: 168 },
      { count: '680', pct: 3, growth: '+48.0%', newCount: 212 },
    ],
  };
  userTypes = computed(() =>
    this.userTypesByPeriod[this.activePeriod()].map((u, i) => ({
      label: this.userTypeLabels[i],
      color: this.userTypeColors[i],
      ...u,
    })),
  );

  private readonly userGrowthMonthLabels = ['فبراير', 'أبريل', 'يونيو', 'أغسطس', 'أكتوبر', 'ديسمبر'];
  private readonly userGrowthByPeriod: Record<PeriodKey, number[]> = {
    '7d': [12080, 12160, 12240, 12310, 12390, 12480],
    '30d': [8400, 9200, 10100, 10900, 11700, 12480],
    '3m': [7200, 8400, 9600, 10600, 11600, 12480],
    '6m': [5400, 7000, 8600, 10000, 11400, 12480],
    '1y': [3200, 5400, 7600, 9600, 11200, 12480],
  };
  userGrowth = computed(() =>
    this.userGrowthByPeriod[this.activePeriod()].map((v, i) => ({ m: this.userGrowthMonthLabels[i], v })),
  );
  maxUserGrowth = computed(() => Math.max(...this.userGrowth().map((u) => u.v)));

  /* ── Projects & Market ── */
  private readonly specialtyCompletionNames = ['برمجة ويب', 'تصميم UI/UX', 'تسويق رقمي', 'تطبيقات جوال', 'Blockchain'];
  private readonly specialtyCompletionByPeriod: Record<PeriodKey, { completion: number; disputes: number }[]> = {
    '7d': [{ completion: 92, disputes: 1 }, { completion: 94, disputes: 1 }, { completion: 88, disputes: 2 }, { completion: 83, disputes: 3 }, { completion: 71, disputes: 5 }],
    '30d': [{ completion: 88, disputes: 4 }, { completion: 91, disputes: 3 }, { completion: 84, disputes: 6 }, { completion: 79, disputes: 9 }, { completion: 68, disputes: 14 }],
    '3m': [{ completion: 86, disputes: 14 }, { completion: 89, disputes: 11 }, { completion: 82, disputes: 19 }, { completion: 77, disputes: 28 }, { completion: 66, disputes: 42 }],
    '6m': [{ completion: 85, disputes: 26 }, { completion: 88, disputes: 22 }, { completion: 81, disputes: 37 }, { completion: 76, disputes: 54 }, { completion: 64, disputes: 81 }],
    '1y': [{ completion: 84, disputes: 49 }, { completion: 87, disputes: 41 }, { completion: 80, disputes: 71 }, { completion: 75, disputes: 104 }, { completion: 63, disputes: 156 }],
  };
  specialtyCompletion = computed(() =>
    this.specialtyCompletionByPeriod[this.activePeriod()].map((s, i) => ({ name: this.specialtyCompletionNames[i], ...s })),
  );

  /* ── Finance ── */
  private readonly financeMetricLabels = ['إجمالي الإيرادات', 'صافي الربح', 'المصروفات التشغيلية'];
  private readonly financeByPeriod: Record<PeriodKey, { labels: string[]; values: string[][]; changes: string[] }> = {
    '7d': {
      labels: ['الخميس', 'الجمعة', 'السبت'],
      values: [
        ['58K', '66K', '74K'],
        ['49K', '56K', '63K'],
        ['7.8K', '8.4K', '8.9K'],
      ],
      changes: ['+27.6%', '+28.6%', '+14.1%'],
    },
    '30d': {
      labels: ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4'],
      values: [
        ['612K', '654K', '698K', '742K'],
        ['518K', '552K', '590K', '628K'],
        ['94K', '98K', '104K', '108K'],
      ],
      changes: ['+21.2%', '+21.2%', '+14.9%'],
    },
    '3m': {
      labels: ['يوليو', 'أغسطس', 'سبتمبر'],
      values: [
        ['1.98M', '2.12M', '2.28M'],
        ['1.68M', '1.80M', '1.94M'],
        ['302K', '318K', '334K'],
      ],
      changes: ['+15.2%', '+15.5%', '+10.6%'],
    },
    '6m': {
      labels: ['أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر', 'يناير'],
      values: [
        ['2.18M', '2.31M', '2.52M', '2.61M', '2.74M', '2.84M'],
        ['1.84M', '1.96M', '2.10M', '2.19M', '2.31M', '2.43M'],
        ['340K', '352K', '368K', '374K', '388K', '401K'],
      ],
      changes: ['+30.3%', '+32.1%', '+17.9%'],
    },
    '1y': {
      labels: ['فبراير', 'أبريل', 'يونيو', 'أغسطس', 'أكتوبر', 'ديسمبر'],
      values: [
        ['1.42M', '1.68M', '2.04M', '2.31M', '2.58M', '2.84M'],
        ['1.18M', '1.42M', '1.72M', '1.96M', '2.19M', '2.43M'],
        ['218K', '256K', '298K', '336K', '372K', '401K'],
      ],
      changes: ['+99.8%', '+106.0%', '+83.9%'],
    },
  };
  financeMonthLabels = computed(() => this.financeByPeriod[this.activePeriod()].labels);
  financeComparison = computed(() => {
    const p = this.financeByPeriod[this.activePeriod()];
    return this.financeMetricLabels.map((metric, i) => ({ metric, values: p.values[i], change: p.changes[i] }));
  });

  /* ── Specialties ── */
  private readonly specialtyGapNames = ['Blockchain', 'الذكاء الاصطناعي', 'تصميم 3D', 'أمن سيبراني', 'برمجة ويب'];
  private readonly specialtyGapsByPeriod: Record<PeriodKey, { demand: number; supply: number }[]> = {
    '7d': [{ demand: 88, supply: 38 }, { demand: 84, supply: 44 }, { demand: 72, supply: 31 }, { demand: 66, supply: 42 }, { demand: 79, supply: 76 }],
    '30d': [{ demand: 92, supply: 34 }, { demand: 88, supply: 41 }, { demand: 76, supply: 28 }, { demand: 70, supply: 39 }, { demand: 82, supply: 78 }],
    '3m': [{ demand: 90, supply: 36 }, { demand: 86, supply: 43 }, { demand: 78, supply: 30 }, { demand: 72, supply: 41 }, { demand: 84, supply: 79 }],
    '6m': [{ demand: 94, supply: 31 }, { demand: 90, supply: 39 }, { demand: 80, supply: 26 }, { demand: 74, supply: 37 }, { demand: 86, supply: 76 }],
    '1y': [{ demand: 96, supply: 29 }, { demand: 92, supply: 37 }, { demand: 83, supply: 24 }, { demand: 77, supply: 35 }, { demand: 89, supply: 74 }],
  };
  specialtyGaps = computed(() =>
    this.specialtyGapsByPeriod[this.activePeriod()].map((g, i) => ({ name: this.specialtyGapNames[i], ...g })),
  );

  /* ── Affiliates ── */
  private readonly affiliateNames = ['عبدالرحمن الحربي', 'لينا الشمري', 'ياسر القحطاني', 'هند العتيبي', 'سلطان الدوسري'];
  private readonly topAffiliatesByPeriod: Record<PeriodKey, { referrals: number; commission: string; conversion: string }[]> = {
    '7d': [
      { referrals: 38, commission: '2.6K', conversion: '4.4%' },
      { referrals: 32, commission: '2.1K', conversion: '3.9%' },
      { referrals: 27, commission: '1.8K', conversion: '3.6%' },
      { referrals: 24, commission: '1.5K', conversion: '3.2%' },
      { referrals: 19, commission: '1.2K', conversion: '2.8%' },
    ],
    '30d': [
      { referrals: 284, commission: '18.4K', conversion: '4.8%' },
      { referrals: 241, commission: '15.2K', conversion: '4.2%' },
      { referrals: 198, commission: '12.6K', conversion: '3.9%' },
      { referrals: 176, commission: '10.8K', conversion: '3.6%' },
      { referrals: 152, commission: '9.4K', conversion: '3.1%' },
    ],
    '3m': [
      { referrals: 780, commission: '52.6K', conversion: '5.1%' },
      { referrals: 664, commission: '44.8K', conversion: '4.5%' },
      { referrals: 548, commission: '36.2K', conversion: '4.1%' },
      { referrals: 486, commission: '31.4K', conversion: '3.8%' },
      { referrals: 418, commission: '26.8K', conversion: '3.3%' },
    ],
    '6m': [
      { referrals: 1620, commission: '108K', conversion: '5.6%' },
      { referrals: 1380, commission: '92K', conversion: '4.9%' },
      { referrals: 1140, commission: '75K', conversion: '4.4%' },
      { referrals: 1010, commission: '65K', conversion: '4.0%' },
      { referrals: 870, commission: '55K', conversion: '3.6%' },
    ],
    '1y': [
      { referrals: 3240, commission: '216K', conversion: '6.2%' },
      { referrals: 2760, commission: '184K', conversion: '5.4%' },
      { referrals: 2280, commission: '150K', conversion: '4.9%' },
      { referrals: 2020, commission: '130K', conversion: '4.4%' },
      { referrals: 1740, commission: '110K', conversion: '4.0%' },
    ],
  };
  topAffiliates = computed(() =>
    this.topAffiliatesByPeriod[this.activePeriod()].map((a, i) => ({ rank: i + 1, name: this.affiliateNames[i], ...a })),
  );

  /* ── Performance ── */
  private readonly qualityMetricLabels = ['رضا طالبي الخدمة', 'رضا مقدمي الخدمة', 'معدل تكرار التعامل', 'معدل الشكاوى المتكررة'];
  private readonly qualityMetricColors = ['#FFB400', '#5DA0FF', '#0FA99A', '#FF8C69'];
  private readonly qualityMetricsByPeriod: Record<PeriodKey, string[]> = {
    '7d': ['4.5★', '4.3★', '58%', '2.4%'],
    '30d': ['4.6★', '4.4★', '61%', '2.1%'],
    '3m': ['4.6★', '4.5★', '63%', '1.9%'],
    '6m': ['4.7★', '4.5★', '66%', '1.7%'],
    '1y': ['4.7★', '4.6★', '69%', '1.4%'],
  };
  qualityMetrics = computed(() =>
    this.qualityMetricLabels.map((label, i) => ({
      label,
      value: this.qualityMetricsByPeriod[this.activePeriod()][i],
      color: this.qualityMetricColors[i],
    })),
  );

  readonly savedReports = [
    { name: 'تقرير الإيرادات الشهري', schedule: 'يتكرر شهرياً', lastRun: 'قبل 3 أيام' },
    { name: 'تحليل فجوة العرض والطلب', schedule: 'يدوي', lastRun: 'قبل أسبوع' },
    { name: 'أداء الوسطاء الفصلي', schedule: 'يتكرر ربع سنوي', lastRun: 'قبل شهر' },
  ];

  /* ── KPI cards (per section, per period) ── */
  private readonly kpiBase: Record<SectionKey, { icon: string; color: string; bg: string; lbl: string }[]> = {
    overview: [
      { icon: 'wallet', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)', lbl: 'إجمالي الإيرادات ($)' },
      { icon: 'person', color: '#5DA0FF', bg: 'rgba(43,127,255,.12)', lbl: 'إجمالي المستخدمين' },
      { icon: 'escrow', color: '#0FA99A', bg: 'rgba(15,169,154,.12)', lbl: 'مشاريع مكتملة' },
      { icon: 'star', color: '#FFB400', bg: 'rgba(255,180,0,.12)', lbl: 'متوسط تقييم وسيط AI' },
    ],
    users: [
      { icon: 'person', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)', lbl: 'إجمالي المستخدمين' },
      { icon: 'person', color: '#5DA0FF', bg: 'rgba(43,127,255,.12)', lbl: 'مسجلون هذا الشهر' },
      { icon: 'warn', color: '#FF8C69', bg: 'rgba(255,140,105,.12)', lbl: 'حسابات موقوفة' },
      { icon: 'check', color: '#0FA99A', bg: 'rgba(15,169,154,.12)', lbl: 'معدل النشاط الشهري' },
    ],
    projects: [
      { icon: 'escrow', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)', lbl: 'طلبات أُنشئت' },
      { icon: 'escrow', color: '#5DA0FF', bg: 'rgba(43,127,255,.12)', lbl: 'عقود موقّعة' },
      { icon: 'check', color: '#0FA99A', bg: 'rgba(15,169,154,.12)', lbl: 'مشاريع مكتملة' },
      { icon: 'clock', color: '#FFB400', bg: 'rgba(255,180,0,.12)', lbl: 'متوسط أيام المشروع' },
    ],
    finance: [
      { icon: 'wallet', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)', lbl: 'إجمالي الإيرادات' },
      { icon: 'wallet', color: '#0FA99A', bg: 'rgba(15,169,154,.12)', lbl: 'صافي الربح' },
      { icon: 'wallet', color: '#FFB400', bg: 'rgba(255,180,0,.12)', lbl: 'ضمانات محتجزة' },
      { icon: 'chart', color: '#FF8C69', bg: 'rgba(255,140,105,.12)', lbl: 'رسوم حكومية مستقبلية' },
    ],
    specialties: [
      { icon: 'check', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)', lbl: 'تخصص نشط' },
      { icon: 'person', color: '#5DA0FF', bg: 'rgba(43,127,255,.12)', lbl: 'مقدمو خدمة معتمدون' },
      { icon: 'warn', color: '#FFB400', bg: 'rgba(255,180,0,.12)', lbl: 'تخصصات نادرة' },
      { icon: 'chart', color: '#0FA99A', bg: 'rgba(15,169,154,.12)', lbl: 'متوسط تقييم المقدمين' },
    ],
    affiliates: [
      { icon: 'market', color: '#0FA99A', bg: 'rgba(15,169,154,.12)', lbl: 'وسطاء نشطون' },
      { icon: 'person', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)', lbl: 'إجمالي الإحالات' },
      { icon: 'wallet', color: '#FFB400', bg: 'rgba(255,180,0,.12)', lbl: 'عمولات مستحقة ($)' },
      { icon: 'check', color: '#5DA0FF', bg: 'rgba(43,127,255,.12)', lbl: 'معدل تحويل الإحالات' },
    ],
    performance: [
      { icon: 'star', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)', lbl: 'تقييم وسيط AI العام' },
      { icon: 'clock', color: '#5DA0FF', bg: 'rgba(43,127,255,.12)', lbl: 'متوسط وقت الرد (دعم)' },
      { icon: 'check', color: '#0FA99A', bg: 'rgba(15,169,154,.12)', lbl: 'معدل حل النزاعات' },
      { icon: 'warn', color: '#FFB400', bg: 'rgba(255,180,0,.12)', lbl: 'متوسط أيام حل النزاع' },
    ],
  };

  private readonly kpiValuesBySectionAndPeriod: Record<SectionKey, Record<PeriodKey, { val: string; sub: string }[]>> = {
    overview: {
      '7d': [
        { val: '260K', sub: '+3.2% vs الأسبوع الماضي' },
        { val: '12,480', sub: '+0.6% نمو أسبوعي' },
        { val: '41', sub: '+9.1% من الأسبوع الماضي' },
        { val: '4.5★', sub: '+0.1 نقطة هذا الأسبوع' },
      ],
      '30d': [
        { val: '2.84M', sub: '+18.4% vs الشهر الماضي' },
        { val: '12,480', sub: '+4.2% نمو شهري' },
        { val: '284', sub: '+17.8% من الشهر الماضي' },
        { val: '4.6★', sub: '+0.2 نقطة هذا الشهر' },
      ],
      '3m': [
        { val: '6.86M', sub: '+29.6% vs الربع الماضي' },
        { val: '12,480', sub: '+9.4% نمو ربعي' },
        { val: '860', sub: '+24.1% من الربع الماضي' },
        { val: '4.6★', sub: '+0.3 نقطة هذا الربع' },
      ],
      '6m': [
        { val: '14.1M', sub: '+48.2% vs النصف الماضي' },
        { val: '12,480', sub: '+16.0% نمو نصف سنوي' },
        { val: '1,780', sub: '+39.5% من النصف الماضي' },
        { val: '4.7★', sub: '+0.4 نقطة هذا النصف' },
      ],
      '1y': [
        { val: '33.8M', sub: '+96.4% vs العام الماضي' },
        { val: '12,480', sub: '+28.6% نمو سنوي' },
        { val: '3,640', sub: '+71.2% من العام الماضي' },
        { val: '4.7★', sub: '+0.6 نقطة هذا العام' },
      ],
    },
    users: {
      '7d': [
        { val: '12,480', sub: '+0.6% أسبوعي' },
        { val: '52', sub: '+2.4% vs الأسبوع الماضي' },
        { val: '5', sub: '0 جديد هذا الأسبوع' },
        { val: '74.2%', sub: '+0.4% من الأسبوع الماضي' },
      ],
      '30d': [
        { val: '12,480', sub: '+4.2% شهري' },
        { val: '218', sub: '+12% vs الشهر الماضي' },
        { val: '47', sub: '3 جديدة هذا الشهر' },
        { val: '78.6%', sub: '+2.1% من الشهر الماضي' },
      ],
      '3m': [
        { val: '12,480', sub: '+9.4% ربعي' },
        { val: '642', sub: '+18% vs الربع الماضي' },
        { val: '96', sub: '11 جديدة هذا الربع' },
        { val: '80.9%', sub: '+3.6% من الربع الماضي' },
      ],
      '6m': [
        { val: '12,480', sub: '+16.0% نصف سنوي' },
        { val: '1,340', sub: '+24% vs النصف الماضي' },
        { val: '162', sub: '19 جديدة هذا النصف' },
        { val: '82.7%', sub: '+5.0% من النصف الماضي' },
      ],
      '1y': [
        { val: '12,480', sub: '+28.6% سنوي' },
        { val: '2,780', sub: '+34% vs العام الماضي' },
        { val: '284', sub: '38 جديدة هذا العام' },
        { val: '85.4%', sub: '+8.3% من العام الماضي' },
      ],
    },
    projects: {
      '7d': [
        { val: '214', sub: '+3.8% نمو' },
        { val: '142', sub: '66.4% من الطلبات' },
        { val: '41', sub: '19.2% معدل إتمام' },
        { val: '16.1', sub: '-0.4 يوم vs الأسبوع الماضي' },
      ],
      '30d': [
        { val: '1,284', sub: '+14% نمو' },
        { val: '892', sub: '69.5% من الطلبات' },
        { val: '284', sub: '31.8% معدل إتمام' },
        { val: '18.4', sub: '-2.1 يوم vs الشهر الماضي' },
      ],
      '3m': [
        { val: '3,820', sub: '+22% نمو' },
        { val: '2,640', sub: '69.1% من الطلبات' },
        { val: '860', sub: '32.6% معدل إتمام' },
        { val: '17.6', sub: '-1.4 يوم vs الربع الماضي' },
      ],
      '6m': [
        { val: '7,960', sub: '+31% نمو' },
        { val: '5,510', sub: '69.2% من الطلبات' },
        { val: '1,780', sub: '32.3% معدل إتمام' },
        { val: '16.9', sub: '-3.0 أيام vs النصف الماضي' },
      ],
      '1y': [
        { val: '16,240', sub: '+47% نمو' },
        { val: '11,280', sub: '69.5% من الطلبات' },
        { val: '3,640', sub: '32.3% معدل إتمام' },
        { val: '15.8', sub: '-4.6 أيام vs العام الماضي' },
      ],
    },
    finance: {
      '7d': [
        { val: '198K', sub: '+27.6%' },
        { val: '168K', sub: 'هامش 84.8%' },
        { val: '2.1M', sub: 'في المشاريع الجارية' },
        { val: '5.8K', sub: 'بانتظار التحويل' },
      ],
      '30d': [
        { val: '2.84M', sub: '+18.4%' },
        { val: '2.43M', sub: 'هامش 85.4%' },
        { val: '18.4M', sub: 'في المشاريع الجارية' },
        { val: '48.3K', sub: 'بانتظار التحويل' },
      ],
      '3m': [
        { val: '6.38M', sub: '+15.2%' },
        { val: '5.42M', sub: 'هامش 85.0%' },
        { val: '24.6M', sub: 'في المشاريع الجارية' },
        { val: '112K', sub: 'بانتظار التحويل' },
      ],
      '6m': [
        { val: '12.6M', sub: '+30.3%' },
        { val: '10.8M', sub: 'هامش 85.7%' },
        { val: '31.2M', sub: 'في المشاريع الجارية' },
        { val: '186K', sub: 'بانتظار التحويل' },
      ],
      '1y': [
        { val: '24.8M', sub: '+99.8%' },
        { val: '21.3M', sub: 'هامش 85.9%' },
        { val: '42.6M', sub: 'في المشاريع الجارية' },
        { val: '312K', sub: 'بانتظار التحويل' },
      ],
    },
    specialties: {
      '7d': [
        { val: '84', sub: '0 جديد هذا الأسبوع' },
        { val: '5,180', sub: '+17 هذا الأسبوع' },
        { val: '8', sub: 'طلب أعلى من العرض' },
        { val: '4.4★', sub: '+0.0 هذا الأسبوع' },
      ],
      '30d': [
        { val: '84', sub: '+2 جديد هذا الشهر' },
        { val: '5,120', sub: '+96 هذا الشهر' },
        { val: '8', sub: 'طلب أعلى من العرض' },
        { val: '4.3★', sub: '+0.1 هذا الشهر' },
      ],
      '3m': [
        { val: '87', sub: '+5 جديد هذا الربع' },
        { val: '5,420', sub: '+312 هذا الربع' },
        { val: '9', sub: 'طلب أعلى من العرض' },
        { val: '4.4★', sub: '+0.2 هذا الربع' },
      ],
      '6m': [
        { val: '91', sub: '+9 جديد هذا النصف' },
        { val: '5,760', sub: '+640 هذا النصف' },
        { val: '10', sub: 'طلب أعلى من العرض' },
        { val: '4.4★', sub: '+0.3 هذا النصف' },
      ],
      '1y': [
        { val: '96', sub: '+14 جديد هذا العام' },
        { val: '6,500', sub: '+1,380 هذا العام' },
        { val: '11', sub: 'طلب أعلى من العرض' },
        { val: '4.5★', sub: '+0.5 هذا العام' },
      ],
    },
    affiliates: {
      '7d': [
        { val: '392', sub: '+2 جديد' },
        { val: '140', sub: '+3.1% نمو' },
        { val: '9.2K', sub: 'بانتظار الصرف' },
        { val: '3.9%', sub: '+0.1% هذا الأسبوع' },
      ],
      '30d': [
        { val: '382', sub: '+18 جديد' },
        { val: '4,280', sub: '+22.4% نمو' },
        { val: '142K', sub: 'بانتظار الصرف' },
        { val: '3.8%', sub: '+0.4% هذا الشهر' },
      ],
      '3m': [
        { val: '406', sub: '+42 جديد' },
        { val: '11,600', sub: '+31.6% نمو' },
        { val: '378K', sub: 'بانتظار الصرف' },
        { val: '4.2%', sub: '+0.7% هذا الربع' },
      ],
      '6m': [
        { val: '438', sub: '+74 جديد' },
        { val: '24,700', sub: '+44.2% نمو' },
        { val: '712K', sub: 'بانتظار الصرف' },
        { val: '4.6%', sub: '+1.1% هذا النصف' },
      ],
      '1y': [
        { val: '486', sub: '+122 جديد' },
        { val: '48,900', sub: '+68.0% نمو' },
        { val: '1.32M', sub: 'بانتظار الصرف' },
        { val: '5.1%', sub: '+1.8% هذا العام' },
      ],
    },
    performance: {
      '7d': [
        { val: '4.5★', sub: '+0.1 هذا الأسبوع' },
        { val: '3.6h', sub: '-0.2h تحسن' },
        { val: '93.8%', sub: '+0.3% نمو' },
        { val: '7.8', sub: '-0.2 يوم تحسن' },
      ],
      '30d': [
        { val: '4.6★', sub: '+0.2 هذا الشهر' },
        { val: '3.2h', sub: '-0.8h تحسن' },
        { val: '94.2%', sub: '+1.8% نمو' },
        { val: '7.4', sub: '-1.2 يوم تحسن' },
      ],
      '3m': [
        { val: '4.6★', sub: '+0.3 هذا الربع' },
        { val: '2.9h', sub: '-1.1h تحسن' },
        { val: '95.0%', sub: '+2.6% نمو' },
        { val: '6.8', sub: '-1.8 يوم تحسن' },
      ],
      '6m': [
        { val: '4.7★', sub: '+0.4 هذا النصف' },
        { val: '2.5h', sub: '-1.5h تحسن' },
        { val: '95.8%', sub: '+3.4% نمو' },
        { val: '6.1', sub: '-2.5 يوم تحسن' },
      ],
      '1y': [
        { val: '4.7★', sub: '+0.6 هذا العام' },
        { val: '2.0h', sub: '-2.0h تحسن' },
        { val: '96.7%', sub: '+4.9% نمو' },
        { val: '5.2', sub: '-3.4 يوم تحسن' },
      ],
    },
  };

  kpiFor(section: SectionKey): KpiCard[] {
    const base = this.kpiBase[section];
    const vals = this.kpiValuesBySectionAndPeriod[section][this.activePeriod()];
    return base.map((b, i) => ({ ...b, val: vals[i].val, sub: vals[i].sub }));
  }
}
