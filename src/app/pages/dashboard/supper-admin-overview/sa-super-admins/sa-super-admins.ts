import { Component, OnInit, computed, inject, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WsSelectComponent } from '../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { AdminAuditEntry, AdminConsoleApiService, AdminRosterItem } from '../../../../core/services/admin-console-api.service';
import { AUDIT_SEVERITY_LABELS } from '../sa-audit-trail/sa-audit-trail';

type SpaSection = 'admins' | 'general' | 'fees' | 'security' | 'notifications' | 'integrations' | 'audit' | 'danger';

interface SpaToggle {
  key: string;
  label: string;
  desc?: string;
  on: boolean;
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
  imports: [CommonModule, WsSelectComponent, FormsModule],
  templateUrl: './sa-super-admins.html',
  styleUrl: './sa-super-admins.css',
})
export class SaSuperAdmins implements OnInit {
  auditTypeOptions = computed(() => [{ value: '', label: 'كل الأحداث' }, ...this.auditEventTypes().map((t) => ({ value: t, label: t }))]);

  private readonly api = inject(AdminConsoleApiService);

  readonly navItems: { key: SpaSection; label: string; danger?: boolean }[] = [
    { key: 'admins', label: 'الحسابات الإدارية' },
    { key: 'general', label: 'عام' },
    { key: 'fees', label: 'الرسوم والمالية' },
    { key: 'security', label: 'الأمان' },
    { key: 'notifications', label: 'الإشعارات' },
    { key: 'integrations', label: 'التكاملات والـ API' },
    { key: 'audit', label: 'Audit Trail' },
    { key: 'danger', label: 'المنطقة الحمراء', danger: true },
  ];

  readonly activeSection = signal<SpaSection>('admins');

  /** None of the platform settings below has a backend store yet, so every control is shown read-only (never a fake "saved"). */
  readonly settingsBlockedReason = 'غير متاح حاليًا: لا يوجد تخزين لهذا الإعداد في الخادم، لذلك لا يمكن تغييره أو حفظه من هذه الصفحة';
  readonly adminActionBlockedReason = 'غير متاح حاليًا: لا يوجد في الخادم إجراء لترقية أو خفض الحسابات الإدارية';
  readonly twoFaBlockedReason = 'غير متاح: لا يوجد دعم للمصادقة الثنائية (2FA) في الخادم حاليًا';

  readonly admins = signal<AdminRosterItem[]>([]);
  readonly adminsFailed = signal(false);

  readonly registrationToggles = signal<SpaToggle[]>([
    { key: 'openReg', label: 'فتح التسجيل للعامة', desc: 'السماح بتسجيل حسابات جديدة', on: false },
    { key: 'emailReg', label: 'التسجيل بالبريد الإلكتروني', desc: 'إنشاء حساب بالبريد', on: false },
    { key: 'otpReq', label: 'التحقق بالجوال إلزامي', desc: 'OTP عند التسجيل', on: false },
    { key: 'kyc', label: 'التحقق من الهوية الوطنية', desc: 'KYC إلزامي قبل قبول العروض', on: false },
    { key: 'maintenance', label: 'وضع الصيانة', desc: 'تعطيل النظام مؤقتاً للصيانة', on: false },
  ]);

  readonly contentToggles = signal<SpaToggle[]>([
    { key: 'reviewProjects', label: 'مراجعة المشاريع قبل النشر', desc: 'يراجعها مشرف قبل الظهور', on: false },
    { key: 'reviewProfiles', label: 'مراجعة الملفات الشخصية', desc: 'اعتماد مقدمي الخدمة يدوياً', on: false },
    { key: 'wordFilter', label: 'فلتر الكلمات المسيئة', desc: 'فلترة تلقائية للكلمات المحظورة في الرسائل والمحتوى', on: false },
  ]);

  readonly securitySession = signal<number | null>(null);
  readonly securityAttempts = signal<number | null>(null);
  readonly securityMinPassword = signal(8);
  readonly securityToggles = signal<SpaToggle[]>([
    { key: '2fa', label: 'مصادقة ثنائية (2FA) إلزامية للإدارة', desc: 'Super Admin & Admins', on: false },
    { key: 'anomalyLock', label: 'قفل الحساب تلقائياً عند تكرار المحاولات الفاشلة', desc: 'وفق قواعد أمنية ثابتة', on: false },
  ]);

  readonly notifChannels = signal<SpaToggle[]>([
    { key: 'inApp', label: 'إشعارات داخل النظام', on: false },
    { key: 'email', label: 'إشعارات البريد الإلكتروني', on: false },
    { key: 'sms', label: 'إشعارات SMS', on: false },
    { key: 'whatsapp', label: 'إشعارات WhatsApp Business', on: false },
    { key: 'push', label: 'إشعارات Push (التطبيق)', on: false },
  ]);
  readonly smtpHost = signal('');
  readonly smtpPort = signal<number | null>(null);
  readonly smtpFrom = signal('');


  readonly apiKeysMasked = [
    { label: 'بوابة الفوترة (تجهيز مستقبلي)', desc: 'غير مفعّل في V1' },
    { label: 'SMS Gateway (Twilio)', desc: 'مفتاح خدمة الرسائل' },
    { label: 'Payment Gateway (HyperPay)', desc: 'مفتاح بوابة الدفع' },
  ];
  // Audit Trail tab: real AccountAuditLog rows from the server (filters + pagination run server-side).
  readonly auditSearch = signal('');
  readonly auditTypeFilter = signal('');
  readonly auditPage = signal(1);
  readonly auditRows = signal<AdminAuditEntry[]>([]);
  readonly auditTotal = signal(0);
  readonly totalAuditPages = signal(1);
  readonly auditEventTypes = signal<string[]>([]);
  readonly auditLoading = signal(false);
  readonly auditFailed = signal(false);
  readonly sevLabels = AUDIT_SEVERITY_LABELS;
  readonly auditPageNumbers = computed(() => Array.from({ length: this.totalAuditPages() }, (_, i) => i + 1));
  readonly auditRangeLabel = computed(() => {
    const total = this.auditTotal();
    if (!total) return 'لا توجد نتائج';
    const start = (this.auditPage() - 1) * 20 + 1;
    return `عرض ${start}–${Math.min(this.auditPage() * 20, total)} من ${total}`;
  });

  ngOnInit(): void {
    this.api.getAdmins().subscribe({ next: (r) => this.admins.set(r.data ?? []), error: () => this.adminsFailed.set(true) });
    this.loadAudit();
  }

  loadAudit(): void {
    this.auditLoading.set(true);
    this.auditFailed.set(false);
    this.api.getAuditLog({ page: this.auditPage(), limit: 20, q: this.auditSearch().trim(), eventType: this.auditTypeFilter(), scope: 'admin' }).subscribe({
      next: (r) => {
        this.auditRows.set(r.data.items);
        this.auditTotal.set(r.data.pagination.total);
        this.totalAuditPages.set(r.data.pagination.pages);
        this.auditEventTypes.set(r.data.eventTypes);
        this.auditLoading.set(false);
      },
      error: () => { this.auditRows.set([]); this.auditTotal.set(0); this.auditFailed.set(true); this.auditLoading.set(false); },
    });
  }

  readonly dangerActions: DangerAction[] = [
    { key: 'maintenance', label: 'تفعيل وضع الصيانة الكامل', desc: 'يعطل النظام لجميع المستخدمين', buttonLabel: 'تفعيل' },
    { key: 'wipeTest', label: 'مسح قاعدة بيانات الاختبار', desc: 'حذف بيانات بيئة التطوير', buttonLabel: 'تنفيذ' },
    { key: 'broadcast', label: 'إرسال إشعار لجميع المستخدمين', desc: 'نشرة إعلانية لجميع المستخدمين', buttonLabel: 'إرسال' },
    { key: 'backup', label: 'تصدير نسخة احتياطية كاملة', desc: 'DB Snapshot — مشفّرة', buttonLabel: 'تصدير' },
  ];

  // Batch: none of the 4 danger-zone actions (maintenance mode, test-DB wipe,
  // all-user broadcast, full DB backup export) has a backend endpoint —
  // confirmed via grep across AdminSecurityApiService and every
  // system-settings service. Showing a fake "تم تنفيذ" success toast for a
  // destructive/irreversible action would make an admin believe data was
  // wiped or 12,480 users were messaged when nothing happened. These buttons
  // are disabled with an explanatory tooltip until real endpoints exist —
  // see BACKEND_BLOCKED_ISSUES.md.
  readonly dangerBlockedTooltip =
    'غير متاح حاليًا — يتطلب ربط هذا الإجراء بالخادم الخلفي؛ لا يوجد حالياً أي تنفيذ فعلي له';

  setSection(s: SpaSection) {
    this.activeSection.set(s);
  }

  toggle(list: WritableSignal<SpaToggle[]>, key: string) {
    list.update((rows) => rows.map((r) => (r.key === key ? { ...r, on: !r.on } : r)));
  }

  setAuditSearch(value: string) { this.auditSearch.set(value); this.auditPage.set(1); this.loadAudit(); }
  setAuditType(value: string) { this.auditTypeFilter.set(value); this.auditPage.set(1); this.loadAudit(); }
  prevAuditPage() { if (this.auditPage() > 1) { this.auditPage.update((p) => p - 1); this.loadAudit(); } }
  nextAuditPage() { if (this.auditPage() < this.totalAuditPages()) { this.auditPage.update((p) => p + 1); this.loadAudit(); } }
  goAuditPage(p: number) { this.auditPage.set(p); this.loadAudit(); }

  /** Exports the rows currently on screen (the filtered page). */
  exportAuditCsv() {
    const esc = (v: string | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = ['الحدث,العنوان,التفاصيل,الحساب,IP,التاريخ,المستوى'];
    this.auditRows().forEach((r) => rows.push([esc(r.eventType), esc(r.title), esc(r.summary), esc(r.account.name || r.actorLabel), esc(r.ipAddress), esc(r.occurredAt), esc(this.sevLabels[r.severity] ?? r.severity)].join(',')));
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
