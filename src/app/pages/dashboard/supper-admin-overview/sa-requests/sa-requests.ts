import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type ReqStatus = 'open' | 'in-progress' | 'completed' | 'cancelled' | 'flagged';
type FilterKey = 'all' | ReqStatus;

interface ServiceRequest {
  id: string;
  title: string;
  client: string;
  clientAv: string;
  clientBg: string;
  spec: string;
  budget: string;
  offers: number;
  date: string;
  status: ReqStatus;
  aiClean: boolean;
  description: string;
  requirements: string[];
  durationRange: string;
  linkedContract?: string;
  linkedProject?: string;
}

interface TimelineStep {
  label: string;
  note: string;
  done: boolean;
}

@Component({
  selector: 'app-sa-requests',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-requests.html',
  styleUrl: './sa-requests.css',
})
export class SaRequests {
  readonly statusLabels: Record<ReqStatus, string> = {
    open: 'مفتوح',
    'in-progress': 'جارٍ',
    completed: 'مكتمل',
    cancelled: 'ملغى',
    flagged: 'مُبلَّغ عنه',
  };

  readonly statusClasses: Record<ReqStatus, string> = {
    open: 'rq-st-open',
    'in-progress': 'rq-st-progress',
    completed: 'rq-st-completed',
    cancelled: 'rq-st-cancelled',
    flagged: 'rq-st-flagged',
  };

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'open', label: 'مفتوح' },
    { key: 'in-progress', label: 'جارٍ' },
    { key: 'completed', label: 'مكتمل' },
    { key: 'cancelled', label: 'ملغى' },
    { key: 'flagged', label: 'مُبلَّغ عنه' },
  ];

  items = signal<ServiceRequest[]>([
    {
      id: 'RQ-1301', title: 'تصميم بنرات إعلانية × 10', client: 'شركة الخليج التقنية',
      clientAv: 'خ', clientBg: 'linear-gradient(135deg,#FFB400,#FF8C69)', spec: 'تصميم',
      budget: '3,500 ر.س', offers: 4, date: '2026-09-08', status: 'in-progress', aiClean: true,
      description: 'تصميم 10 بنرات إعلانية رقمية بأحجام متعددة لمنصات التواصل الاجتماعي.',
      requirements: ['بنرات بمقاسات إنستغرام وتويتر ولينكدإن', 'ملفات مصدر PSD', 'هوية بصرية موحدة'],
      durationRange: '5-7 أيام', linkedContract: 'CO-1301', linkedProject: 'PR-1301',
    },
    {
      id: 'RQ-1298', title: 'تطوير تطبيق جوال iOS', client: 'مؤسسة النور',
      clientAv: 'ن', clientBg: 'linear-gradient(135deg,#2BD4C7,#0FA99A)', spec: 'برمجة',
      budget: '28,000 ر.س', offers: 7, date: '2026-09-07', status: 'open', aiClean: true,
      description: 'تطوير تطبيق جوال متكامل لنظام iOS لإدارة طلبات متجر النور.',
      requirements: ['واجهة Swift UI حديثة', 'ربط مع بوابة دفع', 'نظام إشعارات فوري'],
      durationRange: '45-60 يوم',
    },
    {
      id: 'RQ-1295', title: 'كتابة محتوى تسويقي لموقع', client: 'محمد العمري',
      clientAv: 'م', clientBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', spec: 'كتابة',
      budget: '1,200 ر.س', offers: 11, date: '2026-09-06', status: 'open', aiClean: true,
      description: 'كتابة محتوى تسويقي احترافي لصفحات موقع خدمي جديد.',
      requirements: ['8 صفحات محتوى', 'تحسين محركات البحث SEO', 'أسلوب تسويقي مقنع'],
      durationRange: '3-5 أيام',
    },
    {
      id: 'RQ-1290', title: 'تصميم هوية بصرية كاملة', client: 'فهد العتيبي',
      clientAv: 'ف', clientBg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)', spec: 'تصميم',
      budget: '8,500 ر.س', offers: 3, date: '2026-09-05', status: 'in-progress', aiClean: true,
      description: 'تصميم هوية بصرية متكاملة تشمل الشعار ودليل الاستخدام.',
      requirements: ['شعار وشعار مصغر', 'دليل استخدام الهوية', 'قوالب سوشيال ميديا'],
      durationRange: '10-14 يوم',
    },
    {
      id: 'RQ-1270', title: 'خدمات مشبوهة — محتوى مخالف', client: 'حساب مجهول',
      clientAv: '؟', clientBg: 'linear-gradient(135deg,#FF8C69,#FFB400)', spec: 'أخرى',
      budget: '500 ر.س', offers: 0, date: '2026-09-03', status: 'flagged', aiClean: false,
      description: 'طلب رصدته منظومة AI باعتباره يحتوي على محتوى مخالف لسياسات المنصة.',
      requirements: ['قيد المراجعة اليدوية من فريق الالتزام'],
      durationRange: '—',
    },
    {
      id: 'RQ-1255', title: 'إعداد خطة أعمال استثمارية', client: 'شركة الأفق',
      clientAv: 'أ', clientBg: 'linear-gradient(135deg,#A56BE0,#2BD4C7)', spec: 'استشارات',
      budget: '9,000 ر.س', offers: 3, date: '2026-08-30', status: 'completed', aiClean: true,
      description: 'إعداد خطة أعمال متكاملة لمشروع استثماري جديد في قطاع التقنية.',
      requirements: ['دراسة جدوى', 'خطة تسويقية', 'توقعات مالية 3 سنوات'],
      durationRange: '14 يوم',
    },
  ]);

  activeFilter = signal<FilterKey>('all');
  searchTerm = signal('');
  selected = signal<ServiceRequest | null>(null);
  showDetail = signal(false);
  actionMessage = signal('');

  filtered = computed(() => {
    const f = this.activeFilter();
    const q = this.searchTerm().trim().toLowerCase();
    return this.items().filter((r) => {
      const matchesFilter = f === 'all' || r.status === f;
      const matchesSearch = !q || r.title.toLowerCase().includes(q) || r.client.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  });

  counts = computed(() => {
    const list = this.items();
    const c: Record<FilterKey, number> = { all: list.length, open: 0, 'in-progress': 0, completed: 0, cancelled: 0, flagged: 0 };
    for (const r of list) c[r.status]++;
    return c;
  });

  stats = computed(() => {
    const list = this.items();
    return {
      total: list.length,
      open: list.filter((r) => r.status === 'open').length,
      completed: list.filter((r) => r.status === 'completed').length,
      needsReview: list.filter((r) => !r.aiClean).length,
    };
  });

  timeline(item: ServiceRequest): TimelineStep[] {
    const steps: TimelineStep[] = [
      { label: 'نشر الطلب', note: 'نُشر الطلب بتاريخ ' + item.date, done: true },
      { label: 'فحص AI', note: item.aiClean ? 'نتيجة الفحص: نظيف لا مخالفات' : 'رُصد محتوى مخالف — الطلب موقوف للمراجعة', done: true },
      { label: 'استقبال العروض', note: item.offers + ' عرض تم استلامه', done: item.offers > 0 },
      { label: 'قبول عرض وبدء المشروع', note: item.status === 'in-progress' || item.status === 'completed' ? 'بدأ تنفيذ المشروع' : 'بانتظار قبول عرض', done: item.status === 'in-progress' || item.status === 'completed' },
      { label: 'إتمام الطلب', note: item.status === 'completed' ? 'اكتمل الطلب بنجاح' : 'لم يكتمل بعد', done: item.status === 'completed' },
    ];
    return steps;
  }

  setFilter(f: FilterKey) {
    this.activeFilter.set(f);
  }

  onSearch(value: string) {
    this.searchTerm.set(value);
  }

  openDetail(item: ServiceRequest) {
    this.selected.set(item);
    this.actionMessage.set('');
    this.showDetail.set(true);
  }

  closeDetail() {
    this.showDetail.set(false);
    this.selected.set(null);
  }

  notifyOwner() {
    this.actionMessage.set('تم إرسال إشعار لصاحب الطلب');
  }

  suspend() {
    const item = this.selected();
    if (!item) return;
    this.items.update((list) => list.map((r) => (r.id === item.id ? { ...r, status: 'cancelled' as ReqStatus } : r)));
    this.actionMessage.set('تم تعليق الطلب مؤقتاً');
    this.selected.update((s) => (s ? { ...s, status: 'cancelled' } : s));
  }

  cancelRequest() {
    const item = this.selected();
    if (!item) return;
    this.items.update((list) => list.map((r) => (r.id === item.id ? { ...r, status: 'cancelled' as ReqStatus } : r)));
    this.actionMessage.set('تم إلغاء الطلب');
    this.selected.update((s) => (s ? { ...s, status: 'cancelled' } : s));
  }
}
