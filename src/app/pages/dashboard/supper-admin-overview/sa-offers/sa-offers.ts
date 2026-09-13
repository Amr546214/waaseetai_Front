import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'flagged';
type FilterKey = 'all' | OfferStatus;

interface Offer {
  id: string;
  provider: string;
  pAv: string;
  pBg: string;
  request: string;
  spec: string;
  price: string;
  priceValue: number;
  marketAvg: number;
  days: string;
  rating: number;
  date: string;
  status: OfferStatus;
  aiClean: boolean;
  reliability: number;
  disputesRate: string;
  completionRate: string;
  level: string;
  negotiationNote: string;
}

@Component({
  selector: 'app-sa-offers',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-offers.html',
  styleUrl: './sa-offers.css',
})
export class SaOffers {
  readonly statusLabels: Record<OfferStatus, string> = {
    pending: 'بانتظار القرار',
    accepted: 'مقبول',
    rejected: 'مرفوض',
    flagged: 'مشبوه',
  };

  readonly statusClasses: Record<OfferStatus, string> = {
    pending: 'of-st-pending',
    accepted: 'of-st-accepted',
    rejected: 'of-st-rejected',
    flagged: 'of-st-flagged',
  };

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'pending', label: 'بانتظار القرار' },
    { key: 'accepted', label: 'مقبول' },
    { key: 'rejected', label: 'مرفوض' },
    { key: 'flagged', label: 'مشبوه' },
  ];

  items = signal<Offer[]>([
    {
      id: 'OF-4812', provider: 'سارة القحطاني', pAv: 'س', pBg: 'linear-gradient(135deg,#A56BE0,#5DA0FF)',
      request: 'تصميم بنرات إعلانية × 10', spec: 'تصميم', price: '3,200 ر.س', priceValue: 3200, marketAvg: 3100,
      days: '5 أيام', rating: 4.9, date: '2026-09-08', status: 'accepted', aiClean: true,
      reliability: 97, disputesRate: '0%', completionRate: '100%', level: 'Platinum',
      negotiationNote: 'خُفِّض المبلغ من 3,600 إلى 3,200 ر.س بعد تفاوض قصير — العرض ضمن متوسط السوق.',
    },
    {
      id: 'OF-4811', provider: 'أحمد الزهراني', pAv: 'أ', pBg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)',
      request: 'تصميم بنرات إعلانية × 10', spec: 'تصميم', price: '2,800 ر.س', priceValue: 2800, marketAvg: 3100,
      days: '6 أيام', rating: 4.7, date: '2026-09-08', status: 'rejected', aiClean: true,
      reliability: 91, disputesRate: '2.9%', completionRate: '97%', level: 'Platinum',
      negotiationNote: 'لم يُقبل — الطالب فضّل عرضاً بمدة أقصر رغم فارق السعر البسيط.',
    },
    {
      id: 'OF-4810', provider: 'ريم الحربي', pAv: 'ر', pBg: 'linear-gradient(135deg,#FFB400,#A56BE0)',
      request: 'تطوير تطبيق iOS', spec: 'برمجة', price: '24,000 ر.س', priceValue: 24000, marketAvg: 26000,
      days: '45 يوم', rating: 4.8, date: '2026-09-07', status: 'pending', aiClean: true,
      reliability: 94, disputesRate: '1.1%', completionRate: '98%', level: 'Gold',
      negotiationNote: 'العرض الأولي بلا تفاوض — بانتظار قرار الطالب.',
    },
    {
      id: 'OF-4807', provider: 'حساب مجهول', pAv: '؟', pBg: 'linear-gradient(135deg,#FF8C69,#FFB400)',
      request: 'استشارة قانونية', spec: 'استشارات', price: '150 ر.س', priceValue: 150, marketAvg: 900,
      days: '1 يوم', rating: 2.1, date: '2026-09-06', status: 'flagged', aiClean: false,
      reliability: 22, disputesRate: '18%', completionRate: '40%', level: 'جديد',
      negotiationNote: 'رصد AI سعراً شاذاً أقل من السوق بنسبة كبيرة — احتمال حساب وهمي.',
    },
    {
      id: 'OF-4805', provider: 'سارة القحطاني', pAv: 'س', pBg: 'linear-gradient(135deg,#A56BE0,#5DA0FF)',
      request: 'تحرير ومونتاج فيديو', spec: 'تصميم', price: '3,800 ر.س', priceValue: 3800, marketAvg: 3600,
      days: '7 أيام', rating: 4.9, date: '2026-09-05', status: 'pending', aiClean: true,
      reliability: 97, disputesRate: '0%', completionRate: '100%', level: 'Platinum',
      negotiationNote: 'لا تفاوض حتى الآن.',
    },
    {
      id: 'OF-4803', provider: 'خالد المالكي', pAv: 'خ', pBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
      request: 'بناء موقع متجر إلكتروني', spec: 'برمجة', price: '12,500 ر.س', priceValue: 12500, marketAvg: 14000,
      days: '30 يوم', rating: 4.5, date: '2026-09-04', status: 'pending', aiClean: true,
      reliability: 88, disputesRate: '3.4%', completionRate: '95%', level: 'Gold',
      negotiationNote: 'لا تفاوض حتى الآن.',
    },
  ]);

  activeFilter = signal<FilterKey>('all');
  searchTerm = signal('');
  selected = signal<Offer | null>(null);
  showDetail = signal(false);
  actionMessage = signal('');

  filtered = computed(() => {
    const f = this.activeFilter();
    const q = this.searchTerm().trim().toLowerCase();
    return this.items().filter((o) => {
      const matchesFilter = f === 'all' || o.status === f;
      const matchesSearch = !q || o.provider.toLowerCase().includes(q) || o.request.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  });

  counts = computed(() => {
    const list = this.items();
    const c: Record<FilterKey, number> = { all: list.length, pending: 0, accepted: 0, rejected: 0, flagged: 0 };
    for (const o of list) c[o.status]++;
    return c;
  });

  stats = computed(() => {
    const list = this.items();
    const avgRating = list.length ? (list.reduce((s, o) => s + o.rating, 0) / list.length).toFixed(1) : '0.0';
    return {
      total: list.length,
      accepted: list.filter((o) => o.status === 'accepted').length,
      avgRating,
      flagged: list.filter((o) => o.status === 'flagged').length,
    };
  });

  priceIntel(o: Offer): { label: string; cls: string } {
    const diff = Math.round(((o.priceValue - o.marketAvg) / o.marketAvg) * 100);
    if (diff < -15) return { label: `أقل ▼${Math.abs(diff)}%`, cls: 'of-intel-low' };
    if (diff > 20) return { label: `أعلى ▲${diff}%`, cls: 'of-intel-high' };
    return { label: `متوسط ~${diff >= 0 ? '+' : ''}${diff}%`, cls: 'of-intel-mid' };
  }

  setFilter(f: FilterKey) {
    this.activeFilter.set(f);
  }

  onSearch(value: string) {
    this.searchTerm.set(value);
  }

  openDetail(item: Offer) {
    this.selected.set(item);
    this.actionMessage.set('');
    this.showDetail.set(true);
  }

  closeDetail() {
    this.showDetail.set(false);
    this.selected.set(null);
  }

  notifyProvider() {
    this.actionMessage.set('تم إرسال إشعار لمقدم الخدمة');
  }

  suspendOffer() {
    const item = this.selected();
    if (!item) return;
    this.items.update((list) => list.map((o) => (o.id === item.id ? { ...o, status: 'rejected' as OfferStatus } : o)));
    this.selected.update((s) => (s ? { ...s, status: 'rejected' } : s));
    this.actionMessage.set('تم تعليق العرض');
  }
}
