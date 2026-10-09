import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  DetailTab,
  TEAM_MEMBERS,
  TeamCaseRow,
  TeamCsat,
  TeamLogRow,
  TeamMember,
  TeamMetricRow,
  TeamPerfHistory,
  TeamPermRow,
  TeamQuickLink,
  TeamTaskRow,
} from '../sa-team.data';

@Component({
  selector: 'app-sa-team-member-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-team-member-detail.html',
  styleUrls: ['../sa-team.css', './sa-team-member-detail.css'],
})
export class SaTeamMemberDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  toast = signal('');
  memberKey = signal<string | null>(null);
  detailTab = signal<DetailTab>('overview');
  modalPerms = signal<TeamPermRow[]>([]);
  permsSavedMsg = signal(false);

  // MOCK — see sa-team.data.ts. Members have no id; the routed `:id` is the
  // member's unique email. Pending invites (no email) never match.
  members = signal<TeamMember[]>(TEAM_MEMBERS);

  selectedMember = computed(() => {
    const key = this.memberKey();
    return this.members().find((m) => !m.pending && !!m.email && String(m.email) === key) ?? null;
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.memberKey.set(params.get('id'));
      this.detailTab.set('overview');
      const m = this.selectedMember();
      this.modalPerms.set(m ? this.permsFor(m) : []);
      this.permsSavedMsg.set(false);
    });
  }

  goBack(): void {
    this.router.navigate(['/supper-admin-overview/team']);
  }

  readonly detailTabs: { key: DetailTab; label: string }[] = [
    { key: 'overview', label: 'نظرة عامة' },
    { key: 'tasks', label: 'مهامه الحالية' },
    { key: 'perms', label: 'صلاحياته' },
    { key: 'log', label: 'سجل النشاط' },
  ];

  private readonly deptPerms: Record<string, string[]> = {
    'النزاعات والبلاغات': ['عرض النزاعات', 'حل النزاعات', 'تعليق المستخدمين مؤقتاً', 'حذف المحتوى المسيء', 'عرض البلاغات', 'حل البلاغات', 'عرض سجلات المستخدمين', 'تعديل إعدادات النظام', 'الوصول للمالية', 'حذف الحسابات نهائياً'],
    'الدعم الفني': ['عرض تذاكر الدعم', 'الرد على التذاكر', 'تصعيد التذاكر الفنية', 'إغلاق التذاكر', 'عرض سجلات المستخدمين', 'إرسال إشعارات جماعية', 'تعديل إعدادات النظام', 'الوصول للمالية', 'حذف الحسابات نهائياً'],
    'اعتماد التخصصات': ['مراجعة طلبات الانضمام', 'اعتماد المزودين الجدد', 'رفض طلبات الاعتماد', 'عرض الوثائق الرسمية', 'تعديل معايير الاعتماد', 'إرسال إشعارات جماعية', 'تعديل إعدادات النظام', 'حذف الحسابات نهائياً'],
    'المالية والسحوبات': ['عرض طلبات السحب', 'الموافقة على السحوبات', 'رفض طلبات السحب', 'عرض كشوف الحسابات', 'تعديل حدود السحب اليومية', 'الوصول الكامل للمالية', 'تعديل إعدادات النظام', 'حذف الحسابات نهائياً'],
  };

  private readonly taskPool: Record<string, { title: string; type: string }[]> = {
    'النزاعات والبلاغات': [
      { title: 'مراجعة نزاع D-2', type: 'نزاع' },
      { title: 'مراجعة بلاغ FL-04', type: 'بلاغ' },
      { title: 'تقرير النزاعات الأسبوعي', type: 'تقرير' },
      { title: 'تصعيد نزاع معقد للإدارة', type: 'نزاع' },
      { title: 'متابعة استئناف قرار سابق', type: 'نزاع' },
    ],
    'الدعم الفني': [
      { title: 'الرد على تذكرة دعم TKT-', type: 'تذكرة' },
      { title: 'تصعيد مشكلة تقنية', type: 'تذكرة' },
      { title: 'مراجعة شكوى مستخدم', type: 'شكوى' },
      { title: 'تحديث قاعدة المعرفة', type: 'مهمة' },
      { title: 'تدريب موظف دعم جديد', type: 'مهمة' },
    ],
    'اعتماد التخصصات': [
      { title: 'مراجعة طلب انضمام مزود', type: 'اعتماد' },
      { title: 'التحقق من وثائق رسمية', type: 'توثيق' },
      { title: 'مراجعة تحديث ملف مزود', type: 'اعتماد' },
      { title: 'تقييم نموذج أعمال جديد', type: 'مراجعة' },
      { title: 'تدقيق تخصصات معتمدة سابقاً', type: 'تدقيق' },
    ],
    'المالية والسحوبات': [
      { title: 'مراجعة طلب سحب WD-', type: 'سحب' },
      { title: 'التحقق من بريد PayPal', type: 'تحقق' },
      { title: 'إعداد كشف حساب شهري', type: 'تقرير' },
      { title: 'مراجعة معاملة مشبوهة', type: 'مراجعة' },
      { title: 'تسوية فرق مالي', type: 'تسوية' },
    ],
  };

  private readonly priorityCycle = [
    { label: 'عالية', color: '#FF8C69', bg: 'rgba(255,140,105,.10)' },
    { label: 'متوسطة', color: '#D98A0B', bg: 'rgba(255,180,0,.10)' },
    { label: 'عادية', color: '#2BD4C7', bg: 'rgba(43,212,199,.08)' },
  ];
  private readonly dueCycle = [
    { label: 'اليوم', color: '#FF8C69' },
    { label: 'غداً', color: '#D98A0B' },
    { label: 'بعد غد', color: '#6B7699' },
  ];
  private readonly statusCycle = [
    { label: 'جارٍ', color: '#D98A0B', bg: 'rgba(255,180,0,.10)' },
    { label: 'معلق', color: '#5DA0FF', bg: 'rgba(43,127,255,.10)' },
    { label: 'قيد المراجعة', color: '#A56BE0', bg: 'rgba(165,107,224,.10)' },
  ];

  private readonly caseLabels: Record<string, { prefix: string; idBase: number }[]> = {
    'النزاعات والبلاغات': [{ prefix: 'نزاع D-', idBase: 240 }, { prefix: 'بلاغ FL-', idBase: 470 }],
    'الدعم الفني': [{ prefix: 'تذكرة TKT-', idBase: 1020 }, { prefix: 'شكوى CMP-', idBase: 330 }],
    'اعتماد التخصصات': [{ prefix: 'اعتماد ACC-', idBase: 810 }, { prefix: 'مراجعة REV-', idBase: 150 }],
    'المالية والسحوبات': [{ prefix: 'سحب WD-', idBase: 605 }, { prefix: 'تسوية STL-', idBase: 90 }],
  };

  private readonly outcomePool = [
    { label: 'حُلَّ بالتراضي', color: '#0FA99A', bg: 'rgba(15,169,154,.05)' },
    { label: 'رضا 5★', color: '#0FA99A', bg: 'rgba(15,169,154,.05)' },
    { label: 'قُبِل', color: '#2BD4C7', bg: 'rgba(43,212,199,.04)' },
    { label: 'تصعيد مطلوب', color: '#FF8C69', bg: 'rgba(255,140,105,.04)' },
  ];

  private readonly activityPool: Record<string, { action: string; color: string }[]> = {
    'النزاعات والبلاغات': [{ action: 'حل نزاع D-', color: '#2BD4C7' }, { action: 'رفض بلاغ FL-', color: '#0FA99A' }, { action: 'تعليق حساب مؤقتاً', color: '#FF8C69' }],
    'الدعم الفني': [{ action: 'إغلاق تذكرة دعم TKT-', color: '#2BD4C7' }, { action: 'الرد على شكوى CMP-', color: '#0FA99A' }, { action: 'تصعيد مشكلة تقنية', color: '#FF8C69' }],
    'اعتماد التخصصات': [{ action: 'اعتماد مزود ACC-', color: '#2BD4C7' }, { action: 'رفض طلب انضمام', color: '#FF8C69' }, { action: 'تحديث معايير الاعتماد', color: '#0FA99A' }],
    'المالية والسحوبات': [{ action: 'الموافقة على سحب WD-', color: '#2BD4C7' }, { action: 'رفض طلب سحب مشبوه', color: '#FF8C69' }, { action: 'إعداد كشف حساب شهري', color: '#0FA99A' }],
  };

  private readonly cities = ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة'];
  private readonly timePool = ['اليوم 1:12 م', 'اليوم 11:30 ص', 'اليوم 10:05 ص', 'أمس 4:20 م', 'أمس 2:10 م', 'أول أمس 9:40 ص'];

  private readonly metricLabelByDept: Record<string, string> = {
    'النزاعات والبلاغات': 'معدل حل النزاعات',
    'الدعم الفني': 'معدل حل التذاكر',
    'اعتماد التخصصات': 'معدل اعتماد الطلبات',
    'المالية والسحوبات': 'معدل معالجة السحوبات',
  };

  scoreColor(score: number): string {
    if (score >= 90) return '#0FA99A';
    if (score >= 80) return '#FFB400';
    return '#FF8C69';
  }

  setDetailTab(tab: DetailTab) {
    this.detailTab.set(tab);
  }

  togglePerm(i: number) {
    this.modalPerms.update((list) => list.map((p, idx) => (idx === i ? { ...p, granted: !p.granted } : p)));
  }

  savePermissions() {
    this.permsSavedMsg.set(true);
    this.showToast('تم حفظ الصلاحيات بنجاح');
    setTimeout(() => this.permsSavedMsg.set(false), 2500);
  }

  goQuickLink(tab: DetailTab) {
    this.detailTab.set(tab);
  }

  avgResolutionTimeFor(m: TeamMember): string {
    const hours = Math.max(0.8, 5 - m.score / 28);
    return `${hours.toFixed(1)}h`;
  }

  lastLoginFor(m: TeamMember): string {
    if (m.online) return `قبل ${5 + ((m.tasksOpen * 3) % 50)} دقيقة`;
    const days = 1 + (m.solved % 3);
    return days === 1 ? 'أمس الساعة 6:40 م' : `منذ ${days} أيام`;
  }

  permsFor(m: TeamMember): TeamPermRow[] {
    const pool = this.deptPerms[m.dept] || this.deptPerms['الدعم الفني'];
    const grantCount = m.score >= 90 ? pool.length - 1 : m.score >= 80 ? Math.ceil(pool.length * 0.7) : Math.ceil(pool.length * 0.5);
    return pool.map((label, i) => ({ label, granted: i < grantCount }));
  }

  tasksFor(m: TeamMember): TeamTaskRow[] {
    const pool = this.taskPool[m.dept] || this.taskPool['الدعم الفني'];
    const count = Math.min(Math.max(m.tasksOpen, 1), 5);
    const seed = m.name.length + m.solved;
    return Array.from({ length: count }).map((_, i) => {
      const t = pool[i % pool.length];
      const priority = this.priorityCycle[(seed + i) % this.priorityCycle.length];
      const due = this.dueCycle[(seed + i * 2) % this.dueCycle.length];
      const status = this.statusCycle[(seed + i) % this.statusCycle.length];
      return {
        title: t.title + (t.title.endsWith('-') ? String(100 + seed + i) : ''),
        type: t.type,
        priority,
        due,
        status,
      };
    });
  }

  caseHistoryFor(m: TeamMember): TeamCaseRow[] {
    const labels = this.caseLabels[m.dept] || this.caseLabels['الدعم الفني'];
    const seed = m.solved;
    return this.outcomePool.map((o, i) => {
      const src = labels[i % labels.length];
      return { case: src.prefix + (src.idBase + seed - i * 3), outcome: o.label, color: o.color, bg: o.bg };
    });
  }

  activityLogFor(m: TeamMember): TeamLogRow[] {
    const pool = this.activityPool[m.dept] || this.activityPool['الدعم الفني'];
    const seed = m.solved;
    const city = this.cities[m.name.length % this.cities.length];
    const entries: TeamLogRow[] = pool.map((p, i) => ({
      action: p.action + (p.action.endsWith('-') ? String(200 + seed - i * 4) : ''),
      time: this.timePool[i] || this.timePool[0],
      color: p.color,
    }));
    entries.splice(2, 0, { action: `تسجيل دخول من ${city}`, time: this.timePool[3], color: '#6B7699' });
    return entries.slice(0, 6);
  }

  perfMetricsFor(m: TeamMember): TeamMetricRow[] {
    const resolution = Math.min(98, m.score + 2);
    const sla = Math.min(99, m.score + 5);
    const satisfaction = Math.max(60, m.score - 6);
    const label = this.metricLabelByDept[m.dept] || 'معدل إنجاز المهام';
    return [
      { label, value: resolution, from: '#2BD4C7', to: '#2B7FFF', color: '#2BD4C7' },
      { label: 'الالتزام بـ SLA', value: sla, from: '#0FA99A', to: '#2BD4C7', color: '#0FA99A' },
      { label: 'رضا المستخدمين', value: satisfaction, from: '#FFB400', to: '#D98A0B', color: '#FFB400' },
    ];
  }

  perfHistoryFor(m: TeamMember): TeamPerfHistory {
    const s = m.score;
    const months = ['أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر'];
    const values = [Math.max(35, s - 24), Math.max(38, s - 18), Math.max(42, s - 9), Math.max(40, s - 13), Math.max(45, s - 4), s];
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    return { months, values, avg, trendUp: values[values.length - 1] >= values[0] };
  }

  perfBarHeight(values: number[], v: number): number {
    const max = Math.max(...values, 1);
    return Math.max(6, Math.round((v / max) * 100));
  }

  csatFor(m: TeamMember): TeamCsat {
    const tier = m.score >= 90 ? 'high' : m.score >= 80 ? 'mid' : 'low';
    const table = {
      high: { avg: 4.7, satisfaction: 89, breakdown: [72, 17, 7, 4] },
      mid: { avg: 4.3, satisfaction: 81, breakdown: [55, 28, 11, 6] },
      low: { avg: 3.8, satisfaction: 68, breakdown: [38, 32, 18, 12] },
    } as const;
    const t = table[tier];
    const total = Math.max(8, Math.round(m.solved / 3));
    return {
      avg: t.avg,
      satisfaction: t.satisfaction,
      total,
      breakdown: [
        { stars: '5★', pct: t.breakdown[0], color: '#0FA99A' },
        { stars: '4★', pct: t.breakdown[1], color: '#2BD4C7' },
        { stars: '3★', pct: t.breakdown[2], color: '#FFB400' },
        { stars: '<3★', pct: t.breakdown[3], color: '#FF8C69' },
      ],
    };
  }

  quickLinksFor(m: TeamMember): TeamQuickLink[] {
    return [
      { label: `المهام المكلَّفة (${m.tasksOpen})`, tab: 'tasks', highlight: true },
      { label: 'تقرير الأداء', tab: 'overview', highlight: false },
      { label: 'إدارة الصلاحيات', tab: 'perms', highlight: false },
    ];
  }

  showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
