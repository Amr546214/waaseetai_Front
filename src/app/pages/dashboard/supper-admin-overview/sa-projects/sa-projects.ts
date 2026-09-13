import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type ProjectStatus = 'active' | 'review' | 'late' | 'completed' | 'cancelled';
type FilterKey = 'all' | ProjectStatus;
type RiskLevel = 'low' | 'medium' | 'high';

interface Milestone {
  name: string;
  state: 'done' | 'active' | 'late' | 'pending';
  progress: number;
}

interface Project {
  id: string;
  title: string;
  client: string;
  cAv: string;
  cBg: string;
  provider: string;
  pAv: string;
  pBg: string;
  value: string;
  escrowTotal: number;
  escrowReleased: number;
  spec: string;
  progress: number;
  deadline: string;
  status: ProjectStatus;
  risk: RiskLevel;
  milestones: Milestone[];
  aiNote: string;
}

@Component({
  selector: 'app-sa-projects',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-projects.html',
  styleUrl: './sa-projects.css',
})
export class SaProjects {
  readonly statusLabels: Record<ProjectStatus, string> = {
    active: 'جارٍ',
    review: 'مراجعة التسليم',
    late: 'متأخر',
    completed: 'مكتمل',
    cancelled: 'ملغى',
  };

  readonly statusClasses: Record<ProjectStatus, string> = {
    active: 'pj-st-active',
    review: 'pj-st-review',
    late: 'pj-st-late',
    completed: 'pj-st-completed',
    cancelled: 'pj-st-cancelled',
  };

  readonly riskLabels: Record<RiskLevel, string> = { low: 'منخفض', medium: 'متوسط', high: 'عالٍ' };
  readonly riskClasses: Record<RiskLevel, string> = { low: 'pj-risk-low', medium: 'pj-risk-med', high: 'pj-risk-high' };

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'active', label: 'جارٍ' },
    { key: 'review', label: 'مراجعة التسليم' },
    { key: 'late', label: 'متأخر' },
    { key: 'completed', label: 'مكتمل' },
    { key: 'cancelled', label: 'ملغى' },
  ];

  items = signal<Project[]>([
    {
      id: 'PR-1301', title: 'تصميم بنرات إعلانية × 10', client: 'شركة الخليج التقنية', cAv: 'خ', cBg: 'linear-gradient(135deg,#FFB400,#FF8C69)',
      provider: 'سارة القحطاني', pAv: 'س', pBg: 'linear-gradient(135deg,#A56BE0,#5DA0FF)', value: '3,200 ر.س',
      escrowTotal: 3200, escrowReleased: 1280, spec: 'تصميم', progress: 40, deadline: '2026-09-20', status: 'active', risk: 'low',
      milestones: [
        { name: 'التصميم الأولي', state: 'done', progress: 100 },
        { name: 'مراجعة العميل', state: 'active', progress: 60 },
        { name: 'التسليم النهائي', state: 'pending', progress: 0 },
      ],
      aiNote: 'المشروع يسير وفق الجدول الزمني — لا مؤشرات خطر.',
    },
    {
      id: 'PR-1298', title: 'تطوير تطبيق iOS لمتجر', client: 'مؤسسة النور', cAv: 'ن', cBg: 'linear-gradient(135deg,#2BD4C7,#0FA99A)',
      provider: 'هيثم القرني', pAv: 'هـ', pBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', value: '28,000 ر.س',
      escrowTotal: 28000, escrowReleased: 11200, spec: 'برمجة', progress: 65, deadline: '2026-10-15', status: 'active', risk: 'low',
      milestones: [
        { name: 'التحليل والتخطيط', state: 'done', progress: 100 },
        { name: 'واجهة المستخدم', state: 'done', progress: 100 },
        { name: 'الربط بالخلفية', state: 'active', progress: 55 },
        { name: 'الاختبار والتسليم', state: 'pending', progress: 0 },
      ],
      aiNote: 'وتيرة العمل ثابتة — تسليم متوقع في الموعد.',
    },
    {
      id: 'PR-1290', title: 'تصميم هوية بصرية كاملة', client: 'فهد العتيبي', cAv: 'ف', cBg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)',
      provider: 'أحمد الزهراني', pAv: 'أ', pBg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)', value: '8,500 ر.س',
      escrowTotal: 8500, escrowReleased: 1700, spec: 'تصميم', progress: 30, deadline: '2026-09-14', status: 'late', risk: 'high',
      milestones: [
        { name: 'تحليل المتطلبات', state: 'done', progress: 100 },
        { name: 'تصميم الشعار', state: 'late', progress: 40 },
        { name: 'دليل الاستخدام', state: 'pending', progress: 0 },
      ],
      aiNote: 'المشروع متأخر 3 أيام — لا تراسل بين الطرفين منذ 48 ساعة، مؤشر خطر على توقف العمل.',
    },
    {
      id: 'PR-1285', title: 'استشارة قانونية عقد تجاري', client: 'ريم الحربي', cAv: 'ر', cBg: 'linear-gradient(135deg,#FFB400,#A56BE0)',
      provider: 'خالد المالكي', pAv: 'خ', pBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', value: '2,000 ر.س',
      escrowTotal: 2000, escrowReleased: 2000, spec: 'استشارات', progress: 100, deadline: '2026-09-05', status: 'completed', risk: 'low',
      milestones: [
        { name: 'مراجعة العقد', state: 'done', progress: 100 },
        { name: 'تسليم التقرير النهائي', state: 'done', progress: 100 },
      ],
      aiNote: 'اكتمل المشروع بنجاح ضمن الجدول الزمني.',
    },
    {
      id: 'PR-1277', title: 'واجهة تطبيق UX/UI', client: 'خالد المطيري', cAv: 'خ', cBg: 'linear-gradient(135deg,#5DA0FF,#2BD4C7)',
      provider: 'سعد الغامدي', pAv: 'س', pBg: 'linear-gradient(135deg,#0FA99A,#2BD4C7)', value: '12,000 ر.س',
      escrowTotal: 12000, escrowReleased: 1200, spec: 'تصميم', progress: 10, deadline: '2026-09-12', status: 'late', risk: 'high',
      milestones: [
        { name: 'استكشاف احتياجات المستخدم', state: 'late', progress: 30 },
        { name: 'نماذج أولية', state: 'pending', progress: 0 },
        { name: 'تسليم نهائي', state: 'pending', progress: 0 },
      ],
      aiNote: 'تقدم بطيء جداً منذ بدء المشروع — يُنصح بالتواصل الفوري مع المقدم.',
    },
    {
      id: 'PR-1265', title: 'بناء موقع متجر إلكتروني', client: 'منى الشمري', cAv: 'م', cBg: 'linear-gradient(135deg,#FFB400,#2BD4C7)',
      provider: 'أحمد الزهراني', pAv: 'أ', pBg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)', value: '15,000 ر.س',
      escrowTotal: 15000, escrowReleased: 15000, spec: 'برمجة', progress: 100, deadline: '2026-09-01', status: 'completed', risk: 'low',
      milestones: [
        { name: 'التطوير', state: 'done', progress: 100 },
        { name: 'الاختبار', state: 'done', progress: 100 },
        { name: 'النشر', state: 'done', progress: 100 },
      ],
      aiNote: 'مشروع مكتمل بتقييم ممتاز من الطرفين.',
    },
  ]);

  activeFilter = signal<FilterKey>('all');
  searchTerm = signal('');
  selected = signal<Project | null>(null);
  showDetail = signal(false);
  actionMessage = signal('');

  filtered = computed(() => {
    const f = this.activeFilter();
    const q = this.searchTerm().trim().toLowerCase();
    return this.items().filter((p) => {
      const matchesFilter = f === 'all' || p.status === f;
      const matchesSearch = !q || p.title.toLowerCase().includes(q) || p.client.toLowerCase().includes(q) || p.provider.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  });

  counts = computed(() => {
    const list = this.items();
    const c: Record<FilterKey, number> = { all: list.length, active: 0, review: 0, late: 0, completed: 0, cancelled: 0 };
    for (const p of list) c[p.status]++;
    return c;
  });

  stats = computed(() => {
    const list = this.items();
    return {
      active: list.filter((p) => p.status === 'active').length,
      completed: list.filter((p) => p.status === 'completed').length,
      late: list.filter((p) => p.status === 'late').length,
      activeValue: list.filter((p) => p.status === 'active' || p.status === 'late').reduce((s, p) => s + p.escrowTotal, 0),
    };
  });

  setFilter(f: FilterKey) {
    this.activeFilter.set(f);
  }

  onSearch(value: string) {
    this.searchTerm.set(value);
  }

  openDetail(item: Project) {
    this.selected.set(item);
    this.actionMessage.set('');
    this.showDetail.set(true);
  }

  closeDetail() {
    this.showDetail.set(false);
    this.selected.set(null);
  }

  extendDeadline() {
    this.actionMessage.set('تم تمديد مهلة المشروع بنجاح');
  }

  messageParties() {
    this.actionMessage.set('تم إرسال إشعار لطرفي المشروع');
  }

  escalate() {
    const item = this.selected();
    if (!item) return;
    this.actionMessage.set('تم تصعيد المشروع إلى قسم النزاعات');
  }
}
