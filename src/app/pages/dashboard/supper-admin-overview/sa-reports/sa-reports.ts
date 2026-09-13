import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type ReportType = 'fraud' | 'content' | 'behavior';
type ReportStatus = 'new' | 'investigating' | 'dismissed' | 'actioned';
type TabKey = 'all' | 'new' | 'investigating' | ReportType;
type Priority = 'high' | 'medium' | 'low';

interface Evidence {
  label: string;
  meta: string;
  note: string;
}

interface ComplaintReport {
  id: string;
  type: ReportType;
  typeLabel: string;
  reporter: string;
  reporterAv: string;
  reporterBg: string;
  reported: string;
  reportedAv: string;
  reportedBg: string;
  desc: string;
  aiSuggestion: string;
  date: string;
  status: ReportStatus;
  priority: Priority;
  severity: 'خطورة عالية' | 'خطورة متوسطة' | 'خطورة منخفضة';
  aiRiskScore: number;
  disputedAmount: string;
  priorReports: number;
  evidence: Evidence[];
}

@Component({
  selector: 'app-sa-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-reports.html',
  styleUrl: './sa-reports.css',
})
export class SaReports {
  toast = signal('');
  activeTab = signal<TabKey>('all');
  searchTerm = signal('');

  selected = signal<ComplaintReport | null>(null);
  showDetail = signal(false);

  readonly tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'new', label: 'جديد' },
    { key: 'investigating', label: 'قيد التحقيق' },
    { key: 'content', label: 'محتوى مخالف' },
    { key: 'fraud', label: 'احتيال' },
    { key: 'behavior', label: 'سلوك مخالف' },
  ];

  readonly typeColors: Record<ReportType, string> = {
    fraud: '#FF8C69', content: '#D98A0B', behavior: '#A56BE0',
  };

  reports = signal<ComplaintReport[]>([
    {
      id: 'FR-098', type: 'fraud', typeLabel: 'احتيال', reporter: 'خالد المطيري', reporterAv: 'خ', reporterBg: 'linear-gradient(135deg,#5DA0FF,#2BD4C7)',
      reported: 'حساب مجهول', reportedAv: '؟', reportedBg: 'linear-gradient(135deg,#FF8C69,#FFB400)',
      desc: 'هذا الحساب يطلب الدفع خارج وسيط AI ويهدد بإلغاء العقد إذا رفضنا', aiSuggestion: 'تعليق فوري',
      date: '15 يوليو 2026', status: 'new', priority: 'high', severity: 'خطورة عالية', aiRiskScore: 87,
      disputedAmount: '8,400 ر.س', priorReports: 3,
      evidence: [
        { label: 'لقطة شاشة محادثة الاتفاق', meta: 'chat-screenshot.png · 1.2 MB', note: 'محادثة تثبت طلب الدفع خارج المنصة مقابل تخفيض العمولة' },
        { label: 'إيصال تحويل بنكي', meta: 'bank-receipt.pdf · 0.4 MB', note: 'إيصال تحويل من حساب المُبلِّغ إلى IBAN المُبلَّغ عنه' },
      ],
    },
    {
      id: 'FR-097', type: 'behavior', typeLabel: 'مضايقة', reporter: 'سارة القحطاني', reporterAv: 'س', reporterBg: 'linear-gradient(135deg,#A56BE0,#5DA0FF)',
      reported: 'مستخدم غير موثق', reportedAv: 'م', reportedBg: 'linear-gradient(135deg,#FF8C69,#A56BE0)',
      desc: 'يرسل رسائل مسيئة ومضايقة خارج نطاق العمل بشكل متكرر', aiSuggestion: 'تحذير رسمي',
      date: '14 يوليو 2026', status: 'new', priority: 'medium', severity: 'خطورة متوسطة', aiRiskScore: 61,
      disputedAmount: '—', priorReports: 0,
      evidence: [{ label: 'لقطات شاشة رسائل', meta: 'messages.zip · 2.1 MB', note: '6 لقطات لرسائل مسيئة خارج نطاق العمل خلال أسبوع' }],
    },
    {
      id: 'FR-096', type: 'content', typeLabel: 'محتوى مخالف', reporter: 'محمد العمري', reporterAv: 'م', reporterBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
      reported: 'طلب #RQ-1270', reportedAv: 'ط', reportedBg: 'linear-gradient(135deg,#6B7699,#A8B2D1)',
      desc: 'الطلب يطلب خدمات تسويق مضلل وادعاءات كاذبة', aiSuggestion: 'رفض الطلب',
      date: '13 يوليو 2026', status: 'new', priority: 'medium', severity: 'خطورة متوسطة', aiRiskScore: 54,
      disputedAmount: '—', priorReports: 0,
      evidence: [{ label: 'نص الطلب المنشور', meta: 'request-RQ-1270.pdf · 0.2 MB', note: 'الطلب يتضمن ادعاءات نتائج مضمونة 100% خلال 24 ساعة' }],
    },
    {
      id: 'FR-094', type: 'fraud', typeLabel: 'تزوير', reporter: 'نورة السهلي', reporterAv: 'ن', reporterBg: 'linear-gradient(135deg,#0FA99A,#2BD4C7)',
      reported: 'أحمد م.', reportedAv: 'أ', reportedBg: 'linear-gradient(135deg,#FFB400,#FF8C69)',
      desc: 'يستخدم صور أعمال الآخرين في ملفه المهني دون إذن', aiSuggestion: 'تحذير رسمي',
      date: '12 يوليو 2026', status: 'investigating', priority: 'medium', severity: 'خطورة متوسطة', aiRiskScore: 68,
      disputedAmount: '—', priorReports: 1,
      evidence: [{ label: 'مقارنة الصور الأصلية', meta: 'comparison.pdf · 0.9 MB', note: 'تطابق 4 من 6 صور محفظة مع أعمال منشورة لمقدم آخر' }],
    },
    {
      id: 'FR-091', type: 'fraud', typeLabel: 'احتيال', reporter: 'شركة الخليج', reporterAv: 'خ', reporterBg: 'linear-gradient(135deg,#FFB400,#FF8C69)',
      reported: 'مقدم مجهول', reportedAv: 'م', reportedBg: 'linear-gradient(135deg,#FF8C69,#FFB400)',
      desc: 'قدّم عروضاً وتولى مشاريع ثم اختفى بعد استلام الضمان', aiSuggestion: 'تعليق فوري',
      date: '10 يوليو 2026', status: 'investigating', priority: 'high', severity: 'خطورة عالية', aiRiskScore: 91,
      disputedAmount: '12,000 ر.س', priorReports: 2,
      evidence: [
        { label: 'محادثة الاتفاق على المشروع', meta: 'chat-log.pdf · 1.4 MB', note: 'اتفاق موثق على تسليم المشروع خلال 10 أيام مقابل 12,000 ر.س' },
        { label: 'سجل عدم الاستجابة', meta: 'timeline.pdf · 0.3 MB', note: 'انقطع التواصل تماماً بعد استلام الدفعة المقدمة' },
      ],
    },
    {
      id: 'FR-082', type: 'content', typeLabel: 'محتوى مخالف', reporter: 'فهد العنزي', reporterAv: 'ف', reporterBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
      reported: 'ريان س.', reportedAv: 'ر', reportedBg: 'linear-gradient(135deg,#A56BE0,#FF8C69)',
      desc: 'نشر رابط خارجي مشبوه في وصف الخدمة المعروضة', aiSuggestion: 'رفض البلاغ',
      date: '2 يوليو 2026', status: 'dismissed', priority: 'low', severity: 'خطورة منخفضة', aiRiskScore: 22,
      disputedAmount: '—', priorReports: 0,
      evidence: [{ label: 'لقطة شاشة الوصف', meta: 'listing.png · 0.3 MB', note: 'الرابط تابع لمعرض أعمال شخصي موثوق — لا مخالفة' }],
    },
    {
      id: 'FR-076', type: 'fraud', typeLabel: 'احتيال', reporter: 'ريم الحربي', reporterAv: 'ر', reporterBg: 'linear-gradient(135deg,#FFB400,#A56BE0)',
      reported: 'خالد ب.', reportedAv: 'خ', reportedBg: 'linear-gradient(135deg,#FF6B6B,#FFB400)',
      desc: 'انتحل صفة مدير حساب وسيط AI للتواصل وطلب بيانات دفع', aiSuggestion: 'تعليق فوري',
      date: '28 يونيو 2026', status: 'actioned', priority: 'high', severity: 'خطورة عالية', aiRiskScore: 95,
      disputedAmount: '—', priorReports: 4,
      evidence: [{ label: 'رسائل انتحال الصفة', meta: 'impersonation.png · 0.6 MB', note: 'رسائل تدّعي أنها من فريق الدعم الرسمي وتطلب رمز OTP' }],
    },
  ]);

  filteredReports = computed(() => {
    const tab = this.activeTab();
    const q = this.searchTerm().trim().toLowerCase();
    return this.reports().filter((r) => {
      let matchesTab = true;
      if (tab === 'new') matchesTab = r.status === 'new';
      else if (tab === 'investigating') matchesTab = r.status === 'investigating';
      else if (tab !== 'all') matchesTab = r.type === tab;
      const matchesSearch = !q || r.reported.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.reporter.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  });

  counts = computed(() => {
    const list = this.reports();
    return {
      all: list.length,
      new: list.filter((r) => r.status === 'new').length,
      investigating: list.filter((r) => r.status === 'investigating').length,
      content: list.filter((r) => r.type === 'content').length,
      fraud: list.filter((r) => r.type === 'fraud').length,
      behavior: list.filter((r) => r.type === 'behavior').length,
    };
  });

  kpiResolvedThisMonth = 48;
  kpiAiDetected = 12;

  countFor(key: TabKey): number {
    return this.counts()[key];
  }

  setTab(key: TabKey) {
    this.activeTab.set(key);
  }

  openDetail(report: ComplaintReport) {
    this.selected.set(report);
    this.showDetail.set(true);
  }

  closeDetail() {
    this.showDetail.set(false);
    this.selected.set(null);
  }

  suspendImmediately(report: ComplaintReport) {
    this.setStatus(report, 'actioned', `تم تعليق الحساب المُبلَّغ عنه في البلاغ ${report.id} فوراً`);
  }

  issueWarning(report: ComplaintReport) {
    this.setStatus(report, 'actioned', `تم إرسال تحذير رسمي بخصوص البلاغ ${report.id}`);
  }

  dismiss(report: ComplaintReport) {
    this.setStatus(report, 'dismissed', `تم رفض البلاغ ${report.id}`);
  }

  markInvestigating(report: ComplaintReport) {
    this.setStatus(report, 'investigating', `تم نقل البلاغ ${report.id} لقيد التحقيق`);
  }

  private setStatus(report: ComplaintReport, status: ReportStatus, msg: string) {
    this.reports.update((list) => list.map((r) => (r.id === report.id ? { ...r, status } : r)));
    this.showToast(msg);
    if (this.selected()?.id === report.id) this.closeDetail();
  }

  showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
