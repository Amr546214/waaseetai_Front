import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type BrokerStatus = 'active' | 'suspended' | 'flagged';
type FilterKey = 'all' | BrokerStatus;

interface ReferralLink {
  link: string;
  referrals: number;
  converted: number;
  earned: string;
}

interface RecentCommission {
  referredUser: string;
  action: string;
  amount: string;
  level: number;
  date: string;
}

interface Broker {
  id: string;
  name: string;
  avatar: string;
  avatarBg: string;
  link: string;
  netLevel: number;
  referrals: number;
  converted: number;
  pending: string;
  earned: string;
  aiFlag: 'clean' | 'flagged';
  status: BrokerStatus;
  email: string;
  since: string;
  conversionRate: number;
  totalCommission: string;
  pendingBalance: string;
  aiNotes: string[];
  referralLinks: ReferralLink[];
  recentCommissions: RecentCommission[];
}

@Component({
  selector: 'app-sa-brokers',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-brokers.html',
  styleUrl: './sa-brokers.css',
})
export class SaBrokers {
  toast = signal('');
  activeFilter = signal<FilterKey>('all');
  searchTerm = signal('');

  selected = signal<Broker | null>(null);
  showDetail = signal(false);

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'active', label: 'نشط' },
    { key: 'suspended', label: 'موقوف' },
    { key: 'flagged', label: 'مشبوه' },
  ];

  readonly commissionLevels = [
    { level: 'مستوى 1', pct: '8%', desc: 'مباشر', color: '#2BD4C7' },
    { level: 'مستوى 2', pct: '5%', desc: 'إحالة الإحالة', color: '#5DA0FF' },
    { level: 'مستوى 3', pct: '3%', desc: 'المستوى 3', color: '#A56BE0' },
    { level: 'مستوى 4', pct: '2%', desc: 'المستوى 4', color: '#D98A0B' },
    { level: 'مستوى 5-15', pct: '1%', desc: 'كل مستوى', color: '#6B7699' },
  ];

  brokers = signal<Broker[]>([
    {
      id: 'AF-001', name: 'سعد الغامدي', avatar: 'س', avatarBg: 'linear-gradient(135deg,#0FA99A,#2BD4C7)', link: 'wsq.ai/ref/saad', netLevel: 1,
      referrals: 342, converted: 187, pending: '12,400 ر.س', earned: '38,200 ر.س', aiFlag: 'clean', status: 'active',
      email: 's.alghamdi@email.com', since: 'أغسطس 2024', conversionRate: 54.7, totalCommission: '18,420 ر.س', pendingBalance: '2,840 ر.س',
      aiNotes: ['نسبة تحويل 54.7% — أعلى بكثير من المتوسط (31%) — وسيط ممتاز', 'لا أنشطة مشبوهة، كل الإحالات عضوية طبيعية'],
      referralLinks: [
        { link: 'wseet.ai/r/sg-001', referrals: 142, converted: 87, earned: '8,420 ر.س' },
        { link: 'wseet.ai/r/sg-002', referrals: 98, converted: 62, earned: '6,200 ر.س' },
        { link: 'wseet.ai/r/sg-003', referrals: 102, converted: 38, earned: '3,800 ر.س' },
      ],
      recentCommissions: [
        { referredUser: 'هيثم السهلي', action: 'أكمل مشروعاً', amount: '+84 ر.س', level: 1, date: 'اليوم' },
        { referredUser: 'ريم القحطاني', action: 'اشترى باقة Pro', amount: '+24 ر.س', level: 1, date: 'أمس' },
        { referredUser: 'محمد الدوسري', action: 'أكمل مشروعاً', amount: '+120 ر.س', level: 2, date: '13 يوليو' },
      ],
    },
    {
      id: 'AF-002', name: 'تركي الرشيدي', avatar: 'ت', avatarBg: 'linear-gradient(135deg,#FFB400,#FF8C69)', link: 'wsq.ai/ref/turki', netLevel: 1,
      referrals: 189, converted: 141, pending: '8,200 ر.س', earned: '24,100 ر.س', aiFlag: 'clean', status: 'active',
      email: 't.alrashidi@email.com', since: 'سبتمبر 2024', conversionRate: 74.6, totalCommission: '24,100 ر.س', pendingBalance: '8,200 ر.س',
      aiNotes: ['نسبة تحويل استثنائية (74.6%) — أفضل وسيط هذا الربع'],
      referralLinks: [{ link: 'wseet.ai/r/tk-001', referrals: 189, converted: 141, earned: '24,100 ر.س' }],
      recentCommissions: [{ referredUser: 'فهد العتيبي', action: 'أكمل مشروعاً', amount: '+96 ر.س', level: 1, date: 'أمس' }],
    },
    {
      id: 'AF-003', name: 'نوف القحطاني', avatar: 'ن', avatarBg: 'linear-gradient(135deg,#A56BE0,#5DA0FF)', link: 'wsq.ai/ref/nouf', netLevel: 2,
      referrals: 98, converted: 72, pending: '3,800 ر.س', earned: '11,400 ر.س', aiFlag: 'clean', status: 'active',
      email: 'n.alqahtani@email.com', since: 'يناير 2025', conversionRate: 73.5, totalCommission: '11,400 ر.س', pendingBalance: '3,800 ر.س',
      aiNotes: ['أداء ثابت خلال آخر 6 أشهر بلا أي ملاحظات'],
      referralLinks: [{ link: 'wseet.ai/r/nq-001', referrals: 98, converted: 72, earned: '11,400 ر.س' }],
      recentCommissions: [{ referredUser: 'سلطان الحربي', action: 'اشترى باقة Pro', amount: '+32 ر.س', level: 2, date: '10 يوليو' }],
    },
    {
      id: 'AF-004', name: 'محمد الدوسري', avatar: 'م', avatarBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', link: 'wsq.ai/ref/mdossari', netLevel: 1,
      referrals: 312, converted: 11, pending: '1,200 ر.س', earned: '4,800 ر.س', aiFlag: 'flagged', status: 'flagged',
      email: 'm.aldossari@email.com', since: 'مايو 2026', conversionRate: 3.5, totalCommission: '4,800 ر.س', pendingBalance: '1,200 ر.س',
      aiNotes: ['نسبة تحويل منخفضة جداً (3.5%) رغم عدد إحالات مرتفع — نمط يشبه إحالات وهمية', 'اكتُشفت 3 حسابات مسجلة من نفس عنوان IP خلال 48 ساعة'],
      referralLinks: [{ link: 'wseet.ai/r/md-001', referrals: 312, converted: 11, earned: '4,800 ر.س' }],
      recentCommissions: [{ referredUser: 'حساب مشبوه #12', action: 'تسجيل فقط', amount: '+0 ر.س', level: 1, date: 'أمس' }],
    },
    {
      id: 'AF-005', name: 'ريم البلوي', avatar: 'ر', avatarBg: 'linear-gradient(135deg,#FFB400,#A56BE0)', link: 'wsq.ai/ref/reem', netLevel: 2,
      referrals: 67, converted: 54, pending: '2,100 ر.س', earned: '8,900 ر.س', aiFlag: 'clean', status: 'active',
      email: 'r.albalawi@email.com', since: 'مارس 2025', conversionRate: 80.6, totalCommission: '8,900 ر.س', pendingBalance: '2,100 ر.س',
      aiNotes: ['نسبة تحويل عالية جداً (80.6%) مع قاعدة إحالات صغيرة موثوقة'],
      referralLinks: [{ link: 'wseet.ai/r/rb-001', referrals: 67, converted: 54, earned: '8,900 ر.س' }],
      recentCommissions: [{ referredUser: 'بدر السلمي', action: 'أكمل مشروعاً', amount: '+58 ر.س', level: 1, date: '3 أيام' }],
    },
    {
      id: 'AF-007', name: 'لمياء السهلي', avatar: 'ل', avatarBg: 'linear-gradient(135deg,#0FA99A,#A56BE0)', link: 'wsq.ai/ref/lamia', netLevel: 1,
      referrals: 56, converted: 48, pending: '2,800 ر.س', earned: '9,100 ر.س', aiFlag: 'clean', status: 'suspended',
      email: 'l.alsahli@email.com', since: 'ديسمبر 2024', conversionRate: 85.7, totalCommission: '9,100 ر.س', pendingBalance: '2,800 ر.س',
      aiNotes: ['الحساب موقوف مؤقتاً بطلب من الوسيط نفسه لمراجعة بياناته البنكية'],
      referralLinks: [{ link: 'wseet.ai/r/ls-001', referrals: 56, converted: 48, earned: '9,100 ر.س' }],
      recentCommissions: [{ referredUser: 'عبدالله الزهراني', action: 'أكمل مشروعاً', amount: '+40 ر.س', level: 1, date: 'أسبوع' }],
    },
    {
      id: 'AF-008', name: 'فيصل العمري', avatar: 'ف', avatarBg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)', link: 'wsq.ai/ref/faisal', netLevel: 2,
      referrals: 89, converted: 3, pending: '400 ر.س', earned: '1,200 ر.س', aiFlag: 'flagged', status: 'flagged',
      email: 'f.alomari@email.com', since: 'يونيو 2026', conversionRate: 3.4, totalCommission: '1,200 ر.س', pendingBalance: '400 ر.س',
      aiNotes: ['نمط مطابق لحساب AF-004 — نفس الجهاز المستخدم في التسجيل', 'يُنصح بتجميد العمولات لحين انتهاء التحقيق'],
      referralLinks: [{ link: 'wseet.ai/r/fo-001', referrals: 89, converted: 3, earned: '1,200 ر.س' }],
      recentCommissions: [{ referredUser: 'حساب مشبوه #7', action: 'تسجيل فقط', amount: '+0 ر.س', level: 1, date: 'يومين' }],
    },
  ]);

  filteredBrokers = computed(() => {
    const f = this.activeFilter();
    const q = this.searchTerm().trim().toLowerCase();
    return this.brokers().filter((b) => {
      const matchesFilter = f === 'all' || b.status === f;
      const matchesSearch = !q || b.name.toLowerCase().includes(q) || b.link.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  });

  counts = computed(() => {
    const list = this.brokers();
    return {
      all: list.length,
      active: list.filter((b) => b.status === 'active').length,
      suspended: list.filter((b) => b.status === 'suspended').length,
      flagged: list.filter((b) => b.status === 'flagged').length,
    };
  });

  countFor(key: FilterKey): number {
    return this.counts()[key];
  }

  setFilter(key: FilterKey) {
    this.activeFilter.set(key);
  }

  openDetail(broker: Broker) {
    this.selected.set(broker);
    this.showDetail.set(true);
  }

  closeDetail() {
    this.showDetail.set(false);
    this.selected.set(null);
  }

  suspendBroker(broker: Broker) {
    this.brokers.update((list) => list.map((b) => (b.id === broker.id ? { ...b, status: 'suspended' as BrokerStatus } : b)));
    this.showToast(`تم تعليق حساب الوسيط ${broker.name}`);
  }

  freezeCommissions(broker: Broker) {
    this.showToast(`تم تجميد عمولات ${broker.name} لحين التحقيق`);
  }

  sendForWithdrawal(broker: Broker) {
    this.showToast(`تم إرسال رصيد ${broker.name} للسحب يدوياً`);
  }

  showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
