import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type SectionKey = 'overview' | 'users' | 'projects' | 'finance' | 'specialties' | 'affiliates' | 'performance';
type PeriodKey = '7d' | '30d' | '3m' | '6m' | '1y';

interface AlertItem {
  level: 'danger' | 'warn' | 'good';
  text: string;
  note: string;
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
  readonly alerts: AlertItem[] = [
    { level: 'danger', text: 'معدل النزاعات ارتفع 34% هذا الأسبوع', note: 'نزاعات التصميم أعلى من المعدل' },
    { level: 'warn', text: '12 طلباً بلا عروض منذ أكثر من 7 أيام', note: 'تخصصات: Blockchain + 3D' },
    { level: 'good', text: 'الإيرادات نمت 18.4% — أعلى من المستهدف 15%', note: 'مشاريع برمجة الويب المحرك الرئيسي' },
  ];

  readonly revenueMonths = [
    { m: 'يناير', v: 1180, prev: 940 }, { m: 'فبراير', v: 1240, prev: 980 }, { m: 'مارس', v: 1320, prev: 1010 },
    { m: 'أبريل', v: 1290, prev: 1040 }, { m: 'مايو', v: 1410, prev: 1090 }, { m: 'يونيو', v: 1480, prev: 1120 },
    { m: 'يوليو', v: 1560, prev: 1180 }, { m: 'أغسطس', v: 1620, prev: 1230 }, { m: 'سبتمبر', v: 1590, prev: 1260 },
    { m: 'أكتوبر', v: 1710, prev: 1300 }, { m: 'نوفمبر', v: 1780, prev: 1340 }, { m: 'ديسمبر', v: 1840, prev: 1400 },
  ];
  maxRevenueMonth = computed(() => Math.max(...this.revenueMonths.map((m) => Math.max(m.v, m.prev))));

  readonly conversionFunnel = [
    { label: 'زيارات وسيط AI', value: '124,800', pct: 100 },
    { label: 'تسجيلات جديدة', value: '218', pct: 72 },
    { label: 'طلبات أُنشئت', value: '1,284', pct: 55 },
    { label: 'عقود موقّعة', value: '892', pct: 38 },
    { label: 'مشاريع مكتملة', value: '284', pct: 22 },
  ];

  readonly topSpecialties = [
    { name: 'برمجة ويب', revenue: '842K', projects: 96, growth: '+24%', up: true },
    { name: 'تصميم UI/UX', revenue: '624K', projects: 78, growth: '+18%', up: true },
    { name: 'تسويق رقمي', revenue: '418K', projects: 52, growth: '+12%', up: true },
    { name: 'تطبيقات جوال', revenue: '384K', projects: 38, growth: '+6%', up: true },
    { name: 'محتوى وكتابة', revenue: '241K', projects: 64, growth: '+9%', up: true },
    { name: 'Blockchain', revenue: '184K', projects: 12, growth: '-3%', up: false },
  ];

  readonly geoDistribution = [
    { city: 'الرياض', pct: 68, color: '#2BD4C7' },
    { city: 'جدة', pct: 18, color: '#5DA0FF' },
    { city: 'الدمام', pct: 8, color: '#59C1F5' },
    { city: 'أخرى', pct: 6, color: '#FFB400' },
  ];

  readonly opportunityCities = ['مكة المكرمة', 'تبوك', 'أبها'];

  /* ── Users ── */
  readonly userTypes = [
    { label: 'طالب خدمة (فرد)', count: '4.2K', pct: 34, growth: '+3.1%', newCount: 84, color: '#2BD4C7' },
    { label: 'طالب خدمة (شركة)', count: '1.8K', pct: 15, growth: '+2.8%', newCount: 32, color: '#FFB400' },
    { label: 'مقدم خدمة (فرد)', count: '5.1K', pct: 41, growth: '+5.2%', newCount: 96, color: '#5DA0FF' },
    { label: 'مقدم خدمة (شركة)', count: '890', pct: 7, growth: '+1.9%', newCount: 14, color: '#59C1F5' },
    { label: 'وسطاء تسويقيون', count: '382', pct: 3, growth: '+4.7%', newCount: 18, color: '#0FA99A' },
  ];

  readonly userGrowth = [
    { m: 'فبراير', v: 8400 }, { m: 'أبريل', v: 9200 }, { m: 'يونيو', v: 10100 },
    { m: 'أغسطس', v: 10900 }, { m: 'أكتوبر', v: 11700 }, { m: 'ديسمبر', v: 12480 },
  ];
  maxUserGrowth = computed(() => Math.max(...this.userGrowth.map((u) => u.v)));

  /* ── Projects & Market ── */
  readonly specialtyCompletion = [
    { name: 'برمجة ويب', completion: 88, disputes: 4 },
    { name: 'تصميم UI/UX', completion: 91, disputes: 3 },
    { name: 'تسويق رقمي', completion: 84, disputes: 6 },
    { name: 'تطبيقات جوال', completion: 79, disputes: 9 },
    { name: 'Blockchain', completion: 68, disputes: 14 },
  ];

  /* ── Finance ── */
  readonly financeComparison = [
    { metric: 'إجمالي الإيرادات', values: ['2.18M', '2.31M', '2.52M', '2.61M', '2.74M', '2.84M'], change: '+30.3%' },
    { metric: 'صافي الربح', values: ['1.84M', '1.96M', '2.10M', '2.19M', '2.31M', '2.43M'], change: '+32.1%' },
    { metric: 'المصروفات التشغيلية', values: ['340K', '352K', '368K', '374K', '388K', '401K'], change: '+17.9%' },
  ];
  readonly financeMonthLabels = ['أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر', 'يناير'];

  /* ── Specialties ── */
  readonly specialtyGaps = [
    { name: 'Blockchain', demand: 92, supply: 34 },
    { name: 'الذكاء الاصطناعي', demand: 88, supply: 41 },
    { name: 'تصميم 3D', demand: 76, supply: 28 },
    { name: 'أمن سيبراني', demand: 70, supply: 39 },
    { name: 'برمجة ويب', demand: 82, supply: 78 },
  ];

  /* ── Affiliates ── */
  readonly topAffiliates = [
    { rank: 1, name: 'عبدالرحمن الحربي', referrals: 284, commission: '18.4K', conversion: '4.8%' },
    { rank: 2, name: 'لينا الشمري', referrals: 241, commission: '15.2K', conversion: '4.2%' },
    { rank: 3, name: 'ياسر القحطاني', referrals: 198, commission: '12.6K', conversion: '3.9%' },
    { rank: 4, name: 'هند العتيبي', referrals: 176, commission: '10.8K', conversion: '3.6%' },
    { rank: 5, name: 'سلطان الدوسري', referrals: 152, commission: '9.4K', conversion: '3.1%' },
  ];

  /* ── Performance ── */
  readonly qualityMetrics = [
    { label: 'رضا طالبي الخدمة', value: '4.6★', color: '#FFB400' },
    { label: 'رضا مقدمي الخدمة', value: '4.4★', color: '#5DA0FF' },
    { label: 'معدل تكرار التعامل', value: '61%', color: '#0FA99A' },
    { label: 'معدل الشكاوى المتكررة', value: '2.1%', color: '#FF8C69' },
  ];

  readonly savedReports = [
    { name: 'تقرير الإيرادات الشهري', schedule: 'يتكرر شهرياً', lastRun: 'قبل 3 أيام' },
    { name: 'تحليل فجوة العرض والطلب', schedule: 'يدوي', lastRun: 'قبل أسبوع' },
    { name: 'أداء الوسطاء الفصلي', schedule: 'يتكرر ربع سنوي', lastRun: 'قبل شهر' },
  ];

  kpiFor(section: SectionKey) {
    const map: Record<SectionKey, { icon: string; color: string; bg: string; val: string; lbl: string; sub: string }[]> = {
      overview: [
        { icon: 'wallet', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)', val: '2.84M', lbl: 'إجمالي الإيرادات (ر.س)', sub: '+18.4% vs الشهر الماضي' },
        { icon: 'person', color: '#5DA0FF', bg: 'rgba(43,127,255,.12)', val: '12,480', lbl: 'إجمالي المستخدمين', sub: '+4.2% نمو شهري' },
        { icon: 'escrow', color: '#0FA99A', bg: 'rgba(15,169,154,.12)', val: '284', lbl: 'مشاريع مكتملة', sub: '+17.8% من الشهر الماضي' },
        { icon: 'star', color: '#FFB400', bg: 'rgba(255,180,0,.12)', val: '4.6★', lbl: 'متوسط تقييم وسيط AI', sub: '+0.2 نقطة هذا الشهر' },
      ],
      users: [
        { icon: 'person', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)', val: '12,480', lbl: 'إجمالي المستخدمين', sub: '+4.2% شهري' },
        { icon: 'person', color: '#5DA0FF', bg: 'rgba(43,127,255,.12)', val: '218', lbl: 'مسجلون هذا الشهر', sub: '+12% vs الشهر الماضي' },
        { icon: 'warn', color: '#FF8C69', bg: 'rgba(255,140,105,.12)', val: '47', lbl: 'حسابات موقوفة', sub: '3 جديدة هذا الشهر' },
        { icon: 'check', color: '#0FA99A', bg: 'rgba(15,169,154,.12)', val: '78.6%', lbl: 'معدل النشاط الشهري', sub: '+2.1% من الشهر الماضي' },
      ],
      projects: [
        { icon: 'escrow', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)', val: '1,284', lbl: 'طلبات أُنشئت', sub: '+14% نمو' },
        { icon: 'escrow', color: '#5DA0FF', bg: 'rgba(43,127,255,.12)', val: '892', lbl: 'عقود موقّعة', sub: '69.5% من الطلبات' },
        { icon: 'check', color: '#0FA99A', bg: 'rgba(15,169,154,.12)', val: '284', lbl: 'مشاريع مكتملة', sub: '31.8% معدل إتمام' },
        { icon: 'clock', color: '#FFB400', bg: 'rgba(255,180,0,.12)', val: '18.4', lbl: 'متوسط أيام المشروع', sub: '-2.1 يوم vs الشهر الماضي' },
      ],
      finance: [
        { icon: 'wallet', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)', val: '2.84M', lbl: 'إجمالي الإيرادات', sub: '+18.4%' },
        { icon: 'wallet', color: '#0FA99A', bg: 'rgba(15,169,154,.12)', val: '2.43M', lbl: 'صافي الربح', sub: 'هامش 85.4%' },
        { icon: 'wallet', color: '#FFB400', bg: 'rgba(255,180,0,.12)', val: '18.4M', lbl: 'ضمانات محتجزة', sub: 'في المشاريع الجارية' },
        { icon: 'chart', color: '#FF8C69', bg: 'rgba(255,140,105,.12)', val: '48.3K', lbl: 'رسوم حكومية مستقبلية', sub: 'بانتظار التحويل' },
      ],
      specialties: [
        { icon: 'check', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)', val: '84', lbl: 'تخصص نشط', sub: '+2 جديد هذا الشهر' },
        { icon: 'person', color: '#5DA0FF', bg: 'rgba(43,127,255,.12)', val: '5,120', lbl: 'مقدمو خدمة معتمدون', sub: '+96 هذا الشهر' },
        { icon: 'warn', color: '#FFB400', bg: 'rgba(255,180,0,.12)', val: '8', lbl: 'تخصصات نادرة', sub: 'طلب أعلى من العرض' },
        { icon: 'chart', color: '#0FA99A', bg: 'rgba(15,169,154,.12)', val: '4.3★', lbl: 'متوسط تقييم المقدمين', sub: '+0.1 هذا الشهر' },
      ],
      affiliates: [
        { icon: 'market', color: '#0FA99A', bg: 'rgba(15,169,154,.12)', val: '382', lbl: 'وسطاء نشطون', sub: '+18 جديد' },
        { icon: 'person', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)', val: '4,280', lbl: 'إجمالي الإحالات', sub: '+22.4% نمو' },
        { icon: 'wallet', color: '#FFB400', bg: 'rgba(255,180,0,.12)', val: '142K', lbl: 'عمولات مستحقة (ر.س)', sub: 'بانتظار الصرف' },
        { icon: 'check', color: '#5DA0FF', bg: 'rgba(43,127,255,.12)', val: '3.8%', lbl: 'معدل تحويل الإحالات', sub: '+0.4% هذا الشهر' },
      ],
      performance: [
        { icon: 'star', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)', val: '4.6★', lbl: 'تقييم وسيط AI العام', sub: '+0.2 هذا الشهر' },
        { icon: 'clock', color: '#5DA0FF', bg: 'rgba(43,127,255,.12)', val: '3.2h', lbl: 'متوسط وقت الرد (دعم)', sub: '-0.8h تحسن' },
        { icon: 'check', color: '#0FA99A', bg: 'rgba(15,169,154,.12)', val: '94.2%', lbl: 'معدل حل النزاعات', sub: '+1.8% نمو' },
        { icon: 'warn', color: '#FFB400', bg: 'rgba(255,180,0,.12)', val: '7.4', lbl: 'متوسط أيام حل النزاع', sub: '-1.2 يوم تحسن' },
      ],
    };
    return map[section];
  }
}
