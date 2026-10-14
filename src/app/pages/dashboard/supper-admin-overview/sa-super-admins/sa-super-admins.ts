import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WsSelectComponent } from '../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { AdminSecurityApiService, SecurityEventItem } from '../../../../core/services/admin-security-api.service';

type SpaSection = 'general' | 'fees' | 'security' | 'notifications' | 'integrations' | 'audit' | 'danger';

interface DangerAction {
  key: string;
  label: string;
  desc: string;
  buttonLabel: string;
}

const SEVERITY: Record<string, { bg: string; color: string; lbl: string }> = {
  INFO: { bg: 'rgba(43,212,199,.10)', color: '#2BD4C7', lbl: 'معلومة' },
  WARNING: { bg: 'rgba(255,180,0,.10)', color: '#D98A0B', lbl: 'تحذير' },
  CRITICAL: { bg: 'rgba(255,80,80,.12)', color: '#FF5050', lbl: 'حرج' },
};

@Component({
  selector: 'app-sa-super-admins',
  standalone: true,
  imports: [CommonModule, WsSelectComponent, FormsModule],
  templateUrl: './sa-super-admins.html',
  styleUrl: './sa-super-admins.css',
})
export class SaSuperAdmins implements OnInit {
  private security = inject(AdminSecurityApiService);

  readonly navItems: { key: SpaSection; label: string; danger?: boolean }[] = [
    { key: 'general', label: 'عام' },
    { key: 'fees', label: 'الرسوم والمالية' },
    { key: 'security', label: 'الأمان' },
    { key: 'notifications', label: 'الإشعارات' },
    { key: 'integrations', label: 'التكاملات والـ API' },
    { key: 'audit', label: 'Audit Trail' },
    { key: 'danger', label: 'المنطقة الحمراء', danger: true },
  ];

  readonly activeSection = signal<SpaSection>('general');

  // No settings backend exists: every settings section is shown read-only with a visible note (see the template); nothing is saved from here.
  // Labels only: the on/off state of these settings is not available from the server, so none is shown.
  readonly registrationToggles = signal([
    { key: 'openReg', label: 'فتح التسجيل للعامة', desc: 'السماح بتسجيل حسابات جديدة' },
    { key: 'emailReg', label: 'التسجيل بالبريد الإلكتروني', desc: 'إنشاء حساب بالبريد' },
    { key: 'otpReq', label: 'التحقق بالجوال إلزامي', desc: 'OTP عند التسجيل' },
    { key: 'kyc', label: 'التحقق من الهوية', desc: 'توثيق الهوية قبل قبول العروض' },
    { key: 'maintenance', label: 'وضع الصيانة', desc: 'تعطيل النظام مؤقتاً للصيانة' },
  ]);
  readonly contentToggles = signal([
    { key: 'reviewProjects', label: 'مراجعة المشاريع قبل النشر', desc: 'يراجعها مشرف قبل الظهور' },
    { key: 'reviewProfiles', label: 'مراجعة الملفات الشخصية', desc: 'اعتماد مقدمي الخدمة يدوياً' },
  ]);
  readonly securityToggles = signal([
    { key: '2fa', label: 'مصادقة ثنائية (2FA) للإدارة', desc: 'Super Admin & Admins' },
    { key: 'anomalyLock', label: 'قفل الحساب عند تكرار المحاولات الفاشلة', desc: '' },
  ]);
  readonly notifChannels = signal([
    { key: 'inApp', label: 'إشعارات داخل النظام', desc: '' },
    { key: 'email', label: 'إشعارات البريد الإلكتروني', desc: '' },
    { key: 'sms', label: 'إشعارات SMS', desc: '' },
    { key: 'push', label: 'إشعارات Push (التطبيق)', desc: '' },
  ]);

  readonly apiKeysMasked = [
    { label: 'بوابة الفوترة (تجهيز مستقبلي)', desc: 'غير مفعّل في V1' },
    { label: 'SMS Gateway', desc: 'مفتاح خدمة الرسائل' },
    { label: 'Payment Gateway', desc: 'مفتاح بوابة الدفع' },
  ];

  // Audit Trail: the real security / admin events (GET /admin/security/events); filters and paging act on what was loaded.
  readonly auditRows = signal<SecurityEventItem[]>([]);
  readonly auditLoading = signal(false);
  readonly auditError = signal('');
  readonly auditSearch = signal('');
  readonly auditTypeFilter = signal('الكل');
  readonly auditActorFilter = signal('الكل');
  readonly auditPage = signal(1);
  readonly auditPageSize = 10;

  readonly auditActionTypes = computed(() => ['الكل', ...Array.from(new Set(this.auditRows().map((r) => r.title)))]);
  readonly auditActors = computed(() => ['الكل', ...Array.from(new Set(this.auditRows().map((r) => r.source)))]);

  readonly filteredAuditRows = computed(() => {
    const type = this.auditTypeFilter();
    const actor = this.auditActorFilter();
    const query = this.auditSearch().trim().toLowerCase();
    return this.auditRows().filter((r) => {
      const matchesType = type === 'الكل' || r.title === type;
      const matchesActor = actor === 'الكل' || r.source === actor;
      const matchesQuery = !query || r.title.toLowerCase().includes(query) || (r.summary ?? '').toLowerCase().includes(query) || r.source.toLowerCase().includes(query);
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
    { key: 'broadcast', label: 'إرسال إشعار لجميع المستخدمين', desc: 'نشرة إعلانية لكل المستخدمين', buttonLabel: 'إرسال' },
    { key: 'backup', label: 'تصدير نسخة احتياطية كاملة', desc: 'DB Snapshot — مشفّرة', buttonLabel: 'تصدير' },
  ];

  // None of the 4 danger-zone actions has a backend endpoint: disabled with a visible reason (a fake success would mislead).
  readonly dangerBlockedTooltip =
    'غير متاح حاليًا — يتطلب ربط هذا الإجراء بالخادم الخلفي؛ لا يوجد حالياً أي تنفيذ فعلي له';

  ngOnInit() { this.loadAudit(); }

  loadAudit() {
    this.auditLoading.set(true);
    this.auditError.set('');
    this.security.getSecurityEvents().subscribe({
      next: (res) => { this.auditRows.set(res.data.events); this.auditLoading.set(false); },
      error: (err) => { this.auditError.set(err?.error?.message || 'تعذر تحميل السجل'); this.auditLoading.set(false); },
    });
  }

  sevOf(sev: string) { return SEVERITY[sev] ?? SEVERITY['INFO']; }

  setSection(s: SpaSection) {
    this.activeSection.set(s);
  }

  setAuditSearch(value: string) { this.auditSearch.set(value); this.auditPage.set(1); }
  setAuditType(value: string) { this.auditTypeFilter.set(value); this.auditPage.set(1); }
  setAuditActor(value: string) { this.auditActorFilter.set(value); this.auditPage.set(1); }
  prevAuditPage() { if (this.auditPage() > 1) this.auditPage.update((p) => p - 1); }
  nextAuditPage() { if (this.auditPage() < this.totalAuditPages()) this.auditPage.update((p) => p + 1); }
  goAuditPage(p: number) { this.auditPage.set(p); }

  exportAuditCsv() {
    const esc = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const rows = ['الحدث,التفاصيل,المصدر,IP,التاريخ,الخطورة'];
    this.filteredAuditRows().forEach((r) =>
      rows.push([esc(r.title), esc(r.summary), esc(r.source), esc(r.ipAddress), esc(r.occurredAt), esc(this.sevOf(r.severity).lbl)].join(',')),
    );
    const csv = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
