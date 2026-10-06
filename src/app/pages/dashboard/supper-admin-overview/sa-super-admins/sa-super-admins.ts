import { Component, computed, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';

type SpaSection = 'general' | 'fees' | 'security' | 'notifications' | 'ai' | 'integrations' | 'audit' | 'danger';

interface SpaToggle {
  key: string;
  label: string;
  desc?: string;
  on: boolean;
}

interface SpaAuditRow {
  n: number;
  action: string;
  detail: string;
  by: string;
  role: string;
  ip: string;
  date: string;
  sev: 'info' | 'med' | 'high' | 'danger';
}

interface DangerAction {
  key: string;
  label: string;
  desc: string;
  buttonLabel: string;
}

@Component({
  selector: 'app-sa-super-admins',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-super-admins.html',
  styleUrl: './sa-super-admins.css',
})
export class SaSuperAdmins {
  readonly navItems: { key: SpaSection; label: string; danger?: boolean }[] = [
    { key: 'general', label: 'عام' },
    { key: 'fees', label: 'الرسوم والمالية' },
    { key: 'security', label: 'الأمان' },
    { key: 'notifications', label: 'الإشعارات' },
    { key: 'ai', label: 'محركات AI' },
    { key: 'integrations', label: 'التكاملات والـ API' },
    { key: 'audit', label: 'Audit Trail' },
    { key: 'danger', label: 'المنطقة الحمراء', danger: true },
  ];

  readonly activeSection = signal<SpaSection>('general');

  readonly registrationToggles = signal<SpaToggle[]>([
    { key: 'openReg', label: 'فتح التسجيل للعامة', desc: 'السماح بتسجيل حسابات جديدة', on: true },
    { key: 'emailReg', label: 'التسجيل بالبريد الإلكتروني', desc: 'إنشاء حساب بالبريد', on: true },
    { key: 'otpReq', label: 'التحقق بالجوال إلزامي', desc: 'OTP عند التسجيل', on: true },
    { key: 'kyc', label: 'التحقق من الهوية الوطنية', desc: 'KYC إلزامي قبل قبول العروض', on: true },
    { key: 'maintenance', label: 'وضع الصيانة', desc: 'تعطيل النظام مؤقتاً للصيانة', on: false },
  ]);

  readonly contentToggles = signal<SpaToggle[]>([
    { key: 'reviewProjects', label: 'مراجعة المشاريع قبل النشر', desc: 'يراجعها مشرف قبل الظهور', on: false },
    { key: 'reviewProfiles', label: 'مراجعة الملفات الشخصية', desc: 'اعتماد مقدمي الخدمة يدوياً', on: true },
    { key: 'wordFilter', label: 'فلتر الكلمات المسيئة', desc: 'فلترة تلقائية للكلمات المحظورة في الرسائل والمحتوى', on: true },
  ]);

  readonly dealFee = signal(10);
  readonly withdrawFee = signal(0);
  readonly minWithdraw = signal(200);
  readonly escrowHours = signal(72);
  readonly cashback = signal(2);

  readonly securitySession = signal(60);
  readonly securityAttempts = signal(5);
  readonly securityMinPassword = signal(8);
  readonly securityToggles = signal<SpaToggle[]>([
    { key: '2fa', label: 'مصادقة ثنائية (2FA) إلزامية للإدارة', desc: 'Super Admin & Admins', on: true },
    { key: 'anomalyLock', label: 'قفل الحساب تلقائياً عند تكرار المحاولات الفاشلة', desc: 'وفق قواعد أمنية ثابتة', on: true },
  ]);

  readonly notifChannels = signal<SpaToggle[]>([
    { key: 'inApp', label: 'إشعارات داخل النظام', on: true },
    { key: 'email', label: 'إشعارات البريد الإلكتروني', on: true },
    { key: 'sms', label: 'إشعارات SMS', on: true },
    { key: 'whatsapp', label: 'إشعارات WhatsApp Business', on: false },
    { key: 'push', label: 'إشعارات Push (التطبيق)', on: true },
  ]);
  readonly smtpHost = signal('smtp.sendgrid.net');
  readonly smtpPort = signal(587);
  readonly smtpFrom = signal('noreply@waseet.ai');

  readonly aiToggles = signal<SpaToggle[]>([
    { key: 'match', label: 'مطابقة المشاريع', desc: 'إعداد إداري داخلي — لا يغيّر سلوك النظام حالياً', on: true },
    { key: 'recommend', label: 'التوصيات المخصصة', desc: 'إعداد إداري داخلي — لا يغيّر سلوك النظام حالياً', on: true },
    // Batch 6: "AI Fraud Detection" and "AI Content Moderation" toggles were
    // removed entirely — no real capability of any kind (AI or
    // deterministic) exists behind either one, so a reworded label would
    // still misrepresent a nonexistent feature as controllable here.
    { key: 'dispute', label: 'ملخص النزاعات بالذكاء الاصطناعي', desc: 'تلخيص استشاري للنزاع يعرض على المراجع البشري؛ لا يصدر قراراً', on: true },
  ]);
  readonly aiMatchThreshold = signal(70);

  readonly apiKeysMasked = [
    { label: 'بوابة الفوترة (تجهيز مستقبلي)', desc: 'غير مفعّل في V1' },
    { label: 'SMS Gateway (Twilio)', desc: 'مفتاح خدمة الرسائل' },
    { label: 'Payment Gateway (HyperPay)', desc: 'مفتاح بوابة الدفع' },
  ];
  readonly auditRows: SpaAuditRow[] = [
    { n: 4812, action: 'تغيير إعداد', detail: 'رسوم النظام: 8% ← 10%', by: 'مدير النظام', role: 'Super Admin', ip: '192.168.1.1', date: 'اليوم 3:12 م', sev: 'high' },
    { n: 4811, action: 'تسجيل دخول', detail: 'دخول ناجح من الرياض', by: 'مدير النظام', role: 'Super Admin', ip: '192.168.1.1', date: 'اليوم 2:40 م', sev: 'info' },
    { n: 4810, action: 'تعليق حساب', detail: 'حساب U-1024 معلّق', by: 'هيثم القرني', role: 'مشرف نزاعات', ip: '10.0.0.42', date: 'اليوم 1:15 م', sev: 'med' },
    { n: 4809, action: 'حذف تعليق', detail: 'حذف تعليق محتوى مسيء', by: 'هيثم القرني', role: 'مشرف نزاعات', ip: '10.0.0.42', date: 'اليوم 12:02 م', sev: 'med' },
    { n: 4808, action: 'تغيير إعداد', detail: 'تفعيل فلتر الكلمات المسيئة', by: 'مدير النظام', role: 'Super Admin', ip: '192.168.1.1', date: 'أمس 11:44 م', sev: 'high' },
    { n: 4807, action: 'تغيير صلاحية', detail: 'منح صلاحية مشرف لنوف السهلي', by: 'مدير النظام', role: 'Super Admin', ip: '192.168.1.1', date: 'أمس 10:00 م', sev: 'high' },
    { n: 4805, action: 'تسجيل دخول فاشل', detail: '5 محاولات فاشلة — حساب مؤقت', by: 'غير معروف', role: '—', ip: '41.22.x.x', date: 'أمس 2:11 ص', sev: 'danger' },
  ];

  readonly sevConfig: Record<SpaAuditRow['sev'], { bg: string; color: string; lbl: string }> = {
    info: { bg: 'rgba(43,212,199,.10)', color: '#2BD4C7', lbl: 'معلومة' },
    med: { bg: 'rgba(255,180,0,.10)', color: '#D98A0B', lbl: 'متوسط' },
    high: { bg: 'rgba(255,140,105,.10)', color: '#FF8C69', lbl: 'عالي' },
    danger: { bg: 'rgba(255,80,80,.12)', color: '#FF5050', lbl: 'خطر' },
  };

  // Audit Trail filters + pagination — genuine client-side filtering/paging
  // over the mock auditRows array above (no backend audit-log API exists
  // yet; see BACKEND_BLOCKED_ISSUES.md). This mirrors the filter-row +
  // pagination footer specified in design-reference P-AD-021 (Super Admin
  // → Audit Trail tab), which the implementation previously lacked entirely.
  readonly auditSearch = signal('');
  readonly auditTypeFilter = signal('الكل');
  readonly auditActorFilter = signal('الكل');
  readonly auditPage = signal(1);
  readonly auditPageSize = 5;

  readonly auditActionTypes = computed(() => ['الكل', ...Array.from(new Set(this.auditRows.map((r) => r.action)))]);
  readonly auditActors = computed(() => ['الكل', ...Array.from(new Set(this.auditRows.map((r) => r.by)))]);

  readonly filteredAuditRows = computed(() => {
    const type = this.auditTypeFilter();
    const actor = this.auditActorFilter();
    const query = this.auditSearch().trim().toLowerCase();
    return this.auditRows.filter((r) => {
      const matchesType = type === 'الكل' || r.action === type;
      const matchesActor = actor === 'الكل' || r.by === actor;
      const matchesQuery =
        !query ||
        r.action.toLowerCase().includes(query) ||
        r.detail.toLowerCase().includes(query) ||
        r.by.toLowerCase().includes(query);
      return matchesType && matchesActor && matchesQuery;
    });
  });

  readonly totalAuditPages = computed(() => Math.max(1, Math.ceil(this.filteredAuditRows().length / this.auditPageSize)));

  readonly pagedAuditRows = computed(() => {
    const page = Math.min(this.auditPage(), this.totalAuditPages());
    const start = (page - 1) * this.auditPageSize;
    return this.filteredAuditRows().slice(start, start + this.auditPageSize);
  });

  readonly auditPageNumbers = computed(() => Array.from({ length: this.totalAuditPages() }, (_, i) => i + 1));

  readonly auditRangeLabel = computed(() => {
    const total = this.filteredAuditRows().length;
    if (!total) return 'لا توجد نتائج';
    const page = Math.min(this.auditPage(), this.totalAuditPages());
    const start = (page - 1) * this.auditPageSize + 1;
    const end = Math.min(page * this.auditPageSize, total);
    return `عرض ${start}–${end} من ${total}`;
  });

  readonly dangerActions: DangerAction[] = [
    { key: 'maintenance', label: 'تفعيل وضع الصيانة الكامل', desc: 'يعطل النظام لجميع المستخدمين', buttonLabel: 'تفعيل' },
    { key: 'wipeTest', label: 'مسح قاعدة بيانات الاختبار', desc: 'حذف بيانات بيئة التطوير', buttonLabel: 'تنفيذ' },
    { key: 'broadcast', label: 'إرسال إشعار لجميع المستخدمين', desc: 'نشرة إعلانية لـ 12,480 مستخدم', buttonLabel: 'إرسال' },
    { key: 'backup', label: 'تصدير نسخة احتياطية كاملة', desc: 'DB Snapshot — مشفّرة', buttonLabel: 'تصدير' },
  ];

  readonly toastMessage = signal('');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Batch: none of the 4 danger-zone actions (maintenance mode, test-DB wipe,
  // all-user broadcast, full DB backup export) has a backend endpoint —
  // confirmed via grep across AdminSecurityApiService and every
  // system-settings service. Showing a fake "تم تنفيذ" success toast for a
  // destructive/irreversible action would make an admin believe data was
  // wiped or 12,480 users were messaged when nothing happened. These buttons
  // are disabled with an explanatory tooltip until real endpoints exist —
  // see BACKEND_BLOCKED_ISSUES.md.
  readonly dangerBlockedTooltip =
    'قيد التفعيل قريباً — يتطلب ربط هذا الإجراء بالخادم الخلفي؛ لا يوجد حالياً أي تنفيذ فعلي له';

  setSection(s: SpaSection) {
    this.activeSection.set(s);
  }

  toggle(list: WritableSignal<SpaToggle[]>, key: string) {
    list.update((rows) => rows.map((r) => (r.key === key ? { ...r, on: !r.on } : r)));
  }

  save() {
    this.showToast('تم حفظ التغييرات');
  }

  setAuditSearch(value: string) {
    this.auditSearch.set(value);
    this.auditPage.set(1);
  }

  setAuditType(value: string) {
    this.auditTypeFilter.set(value);
    this.auditPage.set(1);
  }

  setAuditActor(value: string) {
    this.auditActorFilter.set(value);
    this.auditPage.set(1);
  }

  prevAuditPage() {
    if (this.auditPage() > 1) this.auditPage.update((p) => p - 1);
  }

  nextAuditPage() {
    if (this.auditPage() < this.totalAuditPages()) this.auditPage.update((p) => p + 1);
  }

  goAuditPage(p: number) {
    this.auditPage.set(p);
  }

  exportAuditCsv() {
    const rows = ['#,الإجراء,التفاصيل,المنفذ,الدور,IP,التاريخ,الخطورة'];
    this.filteredAuditRows().forEach((r) =>
      rows.push(`${r.n},"${r.action}","${r.detail}",${r.by},${r.role},${r.ip},${r.date},${this.sevConfig[r.sev].lbl}`),
    );
    const csv = '﻿' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private showToast(msg: string) {
    this.toastMessage.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage.set(''), 2200);
  }
}
