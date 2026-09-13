import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type ApplicantType = 'sk-ind' | 'sk-co' | 'pr-ind' | 'pr-co' | 'affiliate';
type AiRec = 'accept' | 'review' | 'suspect';
type FilterKey = 'all' | ApplicantType;

interface Accreditation {
  id: string;
  name: string;
  email: string;
  type: ApplicantType;
  date: string;
  wait: string;
  waitHours: number;
  docs: number;
  docsOk: boolean;
  ai: AiRec;
  avatar: string;
  avatarBg: string;
  specialty: string;
  city: string;
  nationality: string;
  aiScore: number;
  dataCompleteness: number;
  docQuality: number;
  fraudRisk: number;
  identityMatch: number;
  aiNote: string;
}

interface ChecklistItem {
  label: string;
  sub: string;
  state: 'done' | 'warn' | 'pending';
}

@Component({
  selector: 'app-sa-accreditations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-accreditations.html',
  styleUrl: './sa-accreditations.css',
})
export class SaAccreditations {
  readonly typeLabels: Record<ApplicantType, string> = {
    'sk-ind': 'طالب فرد',
    'sk-co': 'طالب شركة',
    'pr-ind': 'مقدم فرد',
    'pr-co': 'مقدم شركة',
    affiliate: 'وسيط',
  };

  readonly aiLabels: Record<AiRec, string> = {
    accept: 'يُنصح بالقبول',
    review: 'مراجعة يدوية',
    suspect: 'مشبوه',
  };

  readonly aiClasses: Record<AiRec, string> = {
    accept: 'acc-ai-good',
    review: 'acc-ai-warn',
    suspect: 'acc-ai-bad',
  };

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'sk-ind', label: 'طالب فرد' },
    { key: 'sk-co', label: 'طالب شركة' },
    { key: 'pr-ind', label: 'مقدم فرد' },
    { key: 'pr-co', label: 'مقدم شركة' },
    { key: 'affiliate', label: 'وسيط' },
  ];

  items = signal<Accreditation[]>([
    {
      id: 'R001', name: 'نواف الحربي', email: 'n.harbi@email.com', type: 'sk-ind',
      date: '2026-09-10', wait: '2 ساعات', waitHours: 2, docs: 3, docsOk: true, ai: 'accept',
      avatar: 'ن', avatarBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
      specialty: 'برمجة تطبيقات', city: 'الرياض', nationality: 'سعودي',
      aiScore: 88, dataCompleteness: 95, docQuality: 90, fraudRisk: 8, identityMatch: 100,
      aiNote: 'الهوية مؤكدة والمستندات مكتملة — يُنصح بالقبول المباشر',
    },
    {
      id: 'R002', name: 'شركة الرواد للتقنية', email: 'info@rowad.sa', type: 'sk-co',
      date: '2026-09-10', wait: '5 ساعات', waitHours: 5, docs: 6, docsOk: true, ai: 'accept',
      avatar: 'ر', avatarBg: 'linear-gradient(135deg,#FFB400,#FF8C69)',
      specialty: 'مقاولات تقنية', city: 'جدة', nationality: '—',
      aiScore: 91, dataCompleteness: 97, docQuality: 93, fraudRisk: 5, identityMatch: 100,
      aiNote: 'السجل التجاري ساري والمستندات متطابقة — قبول موصى به',
    },
    {
      id: 'R003', name: 'محمد العمري', email: 'm.omari@email.com', type: 'pr-ind',
      date: '2026-09-09', wait: 'يوم', waitHours: 18, docs: 3, docsOk: false, ai: 'review',
      avatar: 'م', avatarBg: 'linear-gradient(135deg,#5DA0FF,#A56BE0)',
      specialty: 'برمجة تطبيقات', city: 'الرياض', nationality: 'سعودي',
      aiScore: 78, dataCompleteness: 92, docQuality: 71, fraudRisk: 15, identityMatch: 100,
      aiNote: 'يُنصح بالقبول مع طلب شهادة خبرة أوضح — صورة الهوية ناجحة، المخاطر منخفضة',
    },
    {
      id: 'R004', name: 'خالد المالكي', email: 'k.malki@email.com', type: 'sk-ind',
      date: '2026-09-09', wait: 'يوم', waitHours: 22, docs: 2, docsOk: false, ai: 'review',
      avatar: 'خ', avatarBg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)',
      specialty: '—', city: 'الدمام', nationality: 'سعودي',
      aiScore: 64, dataCompleteness: 70, docQuality: 55, fraudRisk: 20, identityMatch: 90,
      aiNote: 'المستندات ناقصة — يُنصح بطلب إثبات دخل إضافي قبل القبول',
    },
    {
      id: 'R005', name: 'شركة الأفق للخدمات', email: 'contact@ofuq.sa', type: 'pr-co',
      date: '2026-09-08', wait: 'يومان', waitHours: 40, docs: 8, docsOk: true, ai: 'accept',
      avatar: 'أ', avatarBg: 'linear-gradient(135deg,#A56BE0,#2BD4C7)',
      specialty: 'استشارات هندسية', city: 'الخبر', nationality: '—',
      aiScore: 85, dataCompleteness: 94, docQuality: 88, fraudRisk: 6, identityMatch: 100,
      aiNote: 'ملف موثق بالكامل — لا مؤشرات خطر',
    },
    {
      id: 'R006', name: 'أحمد القرني', email: 'a.qarni@email.com', type: 'sk-ind',
      date: '2026-09-07', wait: '3 أيام', waitHours: 60, docs: 3, docsOk: false, ai: 'suspect',
      avatar: 'أ', avatarBg: 'linear-gradient(135deg,#FF8C69,#FFB400)',
      specialty: '—', city: 'غير محدد', nationality: 'غير مؤكدة',
      aiScore: 34, dataCompleteness: 40, docQuality: 25, fraudRisk: 70, identityMatch: 45,
      aiNote: 'مؤشرات احتيال مرتفعة — عدم تطابق الاسم مع وثيقة الهوية المرفوعة، يُنصح بالرفض',
    },
  ]);

  activeFilter = signal<FilterKey>('all');
  searchTerm = signal('');
  selected = signal<Accreditation | null>(null);
  showDetail = signal(false);
  checklist = signal<ChecklistItem[]>([]);
  actionMessage = signal('');

  filtered = computed(() => {
    const f = this.activeFilter();
    const q = this.searchTerm().trim().toLowerCase();
    return this.items().filter((r) => {
      const matchesFilter = f === 'all' || r.type === f;
      const matchesSearch = !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  });

  counts = computed(() => {
    const list = this.items();
    const c: Record<FilterKey, number> = { all: list.length, 'sk-ind': 0, 'sk-co': 0, 'pr-ind': 0, 'pr-co': 0, affiliate: 0 };
    for (const r of list) c[r.type]++;
    return c;
  });

  stats = computed(() => {
    const total = this.items().length;
    return {
      pending: total,
      acceptedMonth: 142,
      rejectedMonth: 21,
      avgHours: 4.2,
    };
  });

  setFilter(f: FilterKey) {
    this.activeFilter.set(f);
  }

  onSearch(value: string) {
    this.searchTerm.set(value);
  }

  quickAccept(item: Accreditation, ev: Event) {
    ev.stopPropagation();
    this.items.update((list) => list.filter((r) => r.id !== item.id));
  }

  quickReject(item: Accreditation, ev: Event) {
    ev.stopPropagation();
    this.items.update((list) => list.filter((r) => r.id !== item.id));
  }

  openDetail(item: Accreditation) {
    this.selected.set(item);
    this.actionMessage.set('');
    this.checklist.set([
      { label: 'الهوية الوطنية مؤكدة وصالحة', sub: 'تم التحقق تلقائياً بواسطة AI', state: item.identityMatch >= 90 ? 'done' : 'warn' },
      { label: 'رقم الجوال موثق (OTP)', sub: 'مؤكد عند التسجيل', state: 'done' },
      { label: 'البريد الإلكتروني موثق', sub: item.email, state: 'done' },
      { label: 'شهادة الخبرة واضحة وموثوقة', sub: item.docQuality >= 80 ? 'مستندات واضحة' : 'الجهة المصدرة غير موثقة — يُنصح بطلب بديل', state: item.docQuality >= 80 ? 'done' : 'warn' },
      { label: 'لا توجد حسابات مكررة', sub: 'فحص قاعدة البيانات', state: item.fraudRisk < 20 ? 'done' : 'pending' },
    ]);
    this.showDetail.set(true);
  }

  closeDetail() {
    this.showDetail.set(false);
    this.selected.set(null);
  }

  toggleCheck(i: number) {
    this.checklist.update((list) => {
      const copy = [...list];
      const cur = copy[i];
      copy[i] = { ...cur, state: cur.state === 'done' ? 'pending' : 'done' };
      return copy;
    });
  }

  decide(action: 'accept' | 'reject' | 'docs') {
    const item = this.selected();
    if (!item) return;
    const msgs: Record<string, string> = {
      accept: 'تم قبول الحساب بنجاح',
      reject: 'تم رفض الحساب وإبلاغ المستخدم',
      docs: 'تم إرسال طلب مستندات إضافية',
    };
    this.actionMessage.set(msgs[action]);
    if (action !== 'docs') {
      this.items.update((list) => list.filter((r) => r.id !== item.id));
      setTimeout(() => this.closeDetail(), 900);
    }
  }
}
