import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type ContractStatus = 'active' | 'escrow-held' | 'dispute' | 'completed' | 'cancelled';
type EscrowState = 'محتجز' | 'مُفرَج' | 'مُسترَد';
type FilterKey = 'all' | ContractStatus;

interface ContractLogEntry {
  text: string;
  time: string;
  color: string;
}

interface Contract {
  id: string;
  client: string;
  cAv: string;
  cBg: string;
  provider: string;
  pAv: string;
  pBg: string;
  desc: string;
  value: string;
  valueNum: number;
  feePct: number;
  escrow: EscrowState;
  signed: string;
  deadline: string;
  status: ContractStatus;
  scope: string;
  log: ContractLogEntry[];
}

@Component({
  selector: 'app-sa-contracts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-contracts.html',
  styleUrl: './sa-contracts.css',
})
export class SaContracts {
  readonly statusLabels: Record<ContractStatus, string> = {
    active: 'نشط',
    'escrow-held': 'ضمان محتجز',
    dispute: 'نزاع',
    completed: 'مكتمل',
    cancelled: 'ملغى',
  };

  readonly statusClasses: Record<ContractStatus, string> = {
    active: 'ct-st-active',
    'escrow-held': 'ct-st-escrow',
    dispute: 'ct-st-dispute',
    completed: 'ct-st-completed',
    cancelled: 'ct-st-cancelled',
  };

  readonly escrowClasses: Record<EscrowState, string> = {
    محتجز: 'ct-esc-held',
    مُفرَج: 'ct-esc-released',
    مُسترَد: 'ct-esc-refunded',
  };

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'active', label: 'نشط' },
    { key: 'escrow-held', label: 'ضمان محتجز' },
    { key: 'dispute', label: 'متنازع عليه' },
    { key: 'completed', label: 'مكتمل' },
    { key: 'cancelled', label: 'ملغى' },
  ];

  items = signal<Contract[]>([
    {
      id: 'CO-1301', client: 'شركة الخليج التقنية', cAv: 'خ', cBg: 'linear-gradient(135deg,#FFB400,#FF8C69)',
      provider: 'سارة القحطاني', pAv: 'س', pBg: 'linear-gradient(135deg,#A56BE0,#5DA0FF)',
      desc: 'تصميم بنرات إعلانية × 10', value: '3,200 ر.س', valueNum: 3200, feePct: 10,
      escrow: 'محتجز', signed: '2026-09-08', deadline: '2026-09-20', status: 'active',
      scope: 'تصميم 10 بنرات إعلانية رقمية بأحجام متعددة لمنصات التواصل الاجتماعي مع ملفات المصدر بصيغة PSD.',
      log: [
        { text: 'إيداع الضمان 3,200 ر.س', time: '8 سبتمبر 2026', color: '#0FA99A' },
        { text: 'توقيع العقد من الطرفين', time: '8 سبتمبر 2026', color: '#5DA0FF' },
        { text: 'إنشاء العقد بعد قبول العرض', time: '8 سبتمبر 2026', color: '#A56BE0' },
      ],
    },
    {
      id: 'CO-1298', client: 'مؤسسة النور', cAv: 'ن', cBg: 'linear-gradient(135deg,#2BD4C7,#0FA99A)',
      provider: 'هيثم القرني', pAv: 'هـ', pBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
      desc: 'تطوير تطبيق iOS', value: '28,000 ر.س', valueNum: 28000, feePct: 10,
      escrow: 'محتجز', signed: '2026-09-07', deadline: '2026-10-15', status: 'active',
      scope: 'تطوير تطبيق جوال متكامل لنظام iOS يشمل واجهة المستخدم والربط بالخلفية ونظام الإشعارات.',
      log: [
        { text: 'إيداع الضمان 28,000 ر.س', time: '7 سبتمبر 2026', color: '#0FA99A' },
        { text: 'توقيع العقد من الطرفين', time: '7 سبتمبر 2026', color: '#5DA0FF' },
      ],
    },
    {
      id: 'CO-1277', client: 'خالد المطيري', cAv: 'خ', cBg: 'linear-gradient(135deg,#5DA0FF,#2BD4C7)',
      provider: 'سعد الغامدي', pAv: 'س', pBg: 'linear-gradient(135deg,#0FA99A,#2BD4C7)',
      desc: 'واجهة تطبيق UX/UI', value: '12,000 ر.س', valueNum: 12000, feePct: 10,
      escrow: 'محتجز', signed: '2026-09-05', deadline: '2026-09-12', status: 'dispute',
      scope: 'تصميم واجهات تطبيق جوال متكامل UX/UI شامل نماذج تفاعلية.',
      log: [
        { text: 'فتح نزاع من الطالب — عدم مطابقة التسليم للمتطلبات', time: 'اليوم', color: '#FF6B6B' },
        { text: 'إيداع الضمان 12,000 ر.س', time: '5 سبتمبر 2026', color: '#0FA99A' },
        { text: 'توقيع العقد من الطرفين', time: '5 سبتمبر 2026', color: '#5DA0FF' },
      ],
    },
    {
      id: 'CO-1247', client: 'فهد العتيبي', cAv: 'ف', cBg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)',
      provider: 'أحمد الزهراني', pAv: 'أ', pBg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)',
      desc: 'هوية بصرية كاملة', value: '8,500 ر.س', valueNum: 8500, feePct: 10,
      escrow: 'محتجز', signed: '2026-09-06', deadline: '2026-09-14', status: 'dispute',
      scope: 'تصميم هوية بصرية متكاملة تشمل الشعار ودليل الاستخدام وقوالب التواصل الاجتماعي.',
      log: [
        { text: 'فتح نزاع من المقدم — تأخر في السداد المتفق عليه', time: 'أمس', color: '#FF6B6B' },
        { text: 'إيداع الضمان 8,500 ر.س', time: '6 سبتمبر 2026', color: '#0FA99A' },
      ],
    },
    {
      id: 'CO-1285', client: 'ريم الحربي', cAv: 'ر', cBg: 'linear-gradient(135deg,#FFB400,#A56BE0)',
      provider: 'خالد المالكي', pAv: 'خ', pBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
      desc: 'استشارة قانونية', value: '2,000 ر.س', valueNum: 2000, feePct: 10,
      escrow: 'مُفرَج', signed: '2026-08-25', deadline: '2026-09-03', status: 'completed',
      scope: 'مراجعة قانونية شاملة لعقد تجاري مع تقديم توصيات نهائية.',
      log: [
        { text: 'إفراج الضمان بالكامل للمقدم', time: '3 سبتمبر 2026', color: '#0FA99A' },
        { text: 'قبول التسليم النهائي', time: '2 سبتمبر 2026', color: '#2BD4C7' },
      ],
    },
    {
      id: 'CO-1260', client: 'سعد الغامدي', cAv: 'س', cBg: 'linear-gradient(135deg,#0FA99A,#2BD4C7)',
      provider: 'ريم السهلي', pAv: 'ر', pBg: 'linear-gradient(135deg,#A56BE0,#FF8C69)',
      desc: 'مونتاج فيديو', value: '4,500 ر.س', valueNum: 4500, feePct: 10,
      escrow: 'مُسترَد', signed: '2026-08-20', deadline: '2026-09-01', status: 'cancelled',
      scope: 'مونتاج فيديو ترويجي احترافي بمدة 3 دقائق.',
      log: [
        { text: 'استرداد الضمان الكامل للطالب بعد إلغاء العقد', time: '1 سبتمبر 2026', color: '#FF8C69' },
        { text: 'إلغاء العقد بالتراضي', time: '31 أغسطس 2026', color: '#6B7699' },
      ],
    },
  ]);

  activeFilter = signal<FilterKey>('all');
  searchTerm = signal('');
  selected = signal<Contract | null>(null);
  showDetail = signal(false);
  actionMessage = signal('');

  filtered = computed(() => {
    const f = this.activeFilter();
    const q = this.searchTerm().trim().toLowerCase();
    return this.items().filter((c) => {
      const matchesFilter = f === 'all' || c.status === f;
      const matchesSearch = !q || c.id.toLowerCase().includes(q) || c.client.toLowerCase().includes(q) || c.provider.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  });

  counts = computed(() => {
    const list = this.items();
    const c: Record<FilterKey, number> = { all: list.length, active: 0, 'escrow-held': 0, dispute: 0, completed: 0, cancelled: 0 };
    for (const item of list) c[item.status]++;
    return c;
  });

  stats = computed(() => {
    const list = this.items();
    return {
      active: list.filter((c) => c.status === 'active' || c.status === 'escrow-held').length,
      escrowTotal: list.filter((c) => c.escrow === 'محتجز').reduce((s, c) => s + c.valueNum, 0),
      disputes: list.filter((c) => c.status === 'dispute').length,
      completed: list.filter((c) => c.status === 'completed').length,
    };
  });

  feeAmount(c: Contract): number {
    return Math.round(c.valueNum * (c.feePct / 100));
  }

  netAmount(c: Contract): number {
    return c.valueNum - this.feeAmount(c);
  }

  setFilter(f: FilterKey) {
    this.activeFilter.set(f);
  }

  onSearch(value: string) {
    this.searchTerm.set(value);
  }

  openDetail(item: Contract) {
    this.selected.set(item);
    this.actionMessage.set('');
    this.showDetail.set(true);
  }

  closeDetail() {
    this.showDetail.set(false);
    this.selected.set(null);
  }

  releaseEscrow() {
    const item = this.selected();
    if (!item) return;
    this.items.update((list) => list.map((c) => (c.id === item.id ? { ...c, escrow: 'مُفرَج' as EscrowState } : c)));
    this.selected.update((s) => (s ? { ...s, escrow: 'مُفرَج' } : s));
    this.actionMessage.set('تم الإفراج اليدوي عن الضمان');
  }

  refundClient() {
    const item = this.selected();
    if (!item) return;
    this.items.update((list) => list.map((c) => (c.id === item.id ? { ...c, escrow: 'مُسترَد' as EscrowState, status: 'cancelled' as ContractStatus } : c)));
    this.selected.update((s) => (s ? { ...s, escrow: 'مُسترَد', status: 'cancelled' } : s));
    this.actionMessage.set('تم إعادة المبلغ للطالب');
  }

  openDispute() {
    const item = this.selected();
    if (!item) return;
    this.items.update((list) => list.map((c) => (c.id === item.id ? { ...c, status: 'dispute' as ContractStatus } : c)));
    this.selected.update((s) => (s ? { ...s, status: 'dispute' } : s));
    this.actionMessage.set('تم فتح نزاع يدوياً على هذا العقد');
  }
}
