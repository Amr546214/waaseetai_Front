import { FeePolicyPanel } from '../../../../shared/fee-policy/fee-policy-panel';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { WsDatePipe } from '../../../../shared/ws-date/ws-date.pipe';
import { FormsModule } from '@angular/forms';
import { WsSelectComponent } from '../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { AdminAuditEntry, AdminConsoleApiService, AdminRosterItem } from '../../../../core/services/admin-console-api.service';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { SystemSettingsApi, SystemSettingsStore } from '../../../../core/services/system-settings.store';
import { RouterLink } from '@angular/router';
import { SettingsSectionComponent, saveWithConfirm } from '../../../../shared/system-settings/settings-section.component';
import { AUDIT_SEVERITY_LABELS } from '../sa-audit-trail/sa-audit-trail';

type SpaSection = 'general' | 'fees' | 'security' | 'notifications' | 'ai' | 'integrations' | 'audit' | 'danger';

@Component({
  selector: 'app-sa-super-admins',
  standalone: true,
  imports: [WsDatePipe, CommonModule, WsSelectComponent, FormsModule, SettingsSectionComponent, RouterLink, FeePolicyPanel],
  templateUrl: './sa-super-admins.html',
  styleUrl: './sa-super-admins.css',
})
/**
 * P-AD-021 «Super Admin»: the same server registry as «إعدادات النظام» (one key, one place), the real Audit Trail, and the red zone. Controls are rendered from what the server says
 * each setting is - nothing here keeps its own copy or is stored in the browser.
 */
export class SaSuperAdmins implements OnInit {
  auditTypeOptions = computed(() => [{ value: '', label: 'كل الأحداث' }, ...this.auditEventTypes().map((t) => ({ value: t, label: t }))]);

  private readonly api = inject(AdminConsoleApiService);
  private readonly confirmModal = inject(ConfirmModalService);
  readonly store = inject(SystemSettingsStore);

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

  // the settings of each card (keys of the server registry)
  readonly identity = ['platformName', 'defaultLanguage', 'defaultTimezone', 'baseCurrency'];
  readonly registration = ['registrationOpen', 'emailRegistration', 'phoneOtpAtRegistration', 'kycBeforeOffers', 'maintenanceMode'];
  readonly contentPolicy = ['projectReviewBeforePublish', 'providerProfileApproval', 'profanityFilter'];
  readonly fees = ['escrowHoldHours'];
  readonly billing = ['futureBilling'];
  readonly security = ['sessionIdleMinutes', 'sessionMaxHours', 'loginProtection', 'minPasswordLength', 'adminTwoFactor', 'anomalyLock'];
  readonly channels = ['channelInApp', 'channelEmail', 'channelSms', 'channelWhatsapp', 'channelPush'];
  readonly smtp = ['smtp'];
  readonly ai = ['aiMatchEngine', 'aiFraudDetection', 'aiDisputeArbitration', 'aiMatchMinimum'];
  readonly integrations = ['apiKeys'];

  readonly generalKeys = [...this.identity, ...this.registration, ...this.contentPolicy];
  dirtyIn(keys: string[]) { return this.store.dirtyKeys(keys); }
  saveTab(keys: string[]) { return saveWithConfirm(this.store, this.confirmModal, keys, this.api2); }
  private readonly api2 = inject(SystemSettingsApi);

  readonly admins = signal<AdminRosterItem[]>([]);
  readonly adminsFailed = signal(false);
  readonly adminActionBlockedReason = 'غير متاح: لا يوجد في الخادم إجراء لترقية أو خفض الحسابات الإدارية؛ الدور يُمنح من «فريق الإدارة».';

  readonly dangerError = signal('');
  readonly maintenanceOn = computed(() => this.store.item('maintenanceMode')?.value === true);
  /** the actions that have NO implementation: shown with the reason, never as a button that pretends */
  readonly unavailableActions = [
    { key: 'wipeTest', label: 'مسح قاعدة بيانات الاختبار', desc: 'حذف بيانات بيئة التطوير', buttonLabel: 'تنفيذ', reason: 'غير متاح ولن يُنفَّذ من الواجهة: حذف بيانات خارج نطاق التطبيق.' },
    { key: 'broadcast', label: 'إرسال إشعار لجميع المستخدمين', desc: 'نشرة إعلانية لجميع المستخدمين', buttonLabel: 'إرسال', reason: 'غير متاح: لا يوجد مسار إرسال جماعي منفّذ في الخادم.' },
    { key: 'backup', label: 'تصدير نسخة احتياطية كاملة', desc: 'DB Snapshot — مشفّرة', buttonLabel: 'تصدير', reason: 'غير متاح: النسخ الاحتياطي يتم خارج التطبيق (على الخادم).' },
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
    void this.store.load();
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

  setSection(s: SpaSection) {
    this.activeSection.set(s);
    this.store.notice.set(null);
  }

  /** maintenance from the red zone: DOUBLE confirmation, then the same server setting (and the same audit entry) as everywhere else */
  async toggleMaintenance() {
    this.dangerError.set('');
    const turnOn = !this.maintenanceOn();
    const first = await this.confirmModal.confirm({ title: turnOn ? 'تفعيل وضع الصيانة' : 'إيقاف وضع الصيانة', type: 'danger', size: 'md', confirmText: 'متابعة',
      message: turnOn ? 'سيتوقف الوصول لجميع المستخدمين عدا لوحة الإدارة والدخول والصحة واستدعاءات الدفع الواردة. هل تريد المتابعة؟' : 'سيعود الوصول لجميع المستخدمين. هل تريد المتابعة؟' });
    if (!first) return;
    const second = await this.confirmModal.confirm({ title: 'تأكيد نهائي', type: 'danger', size: 'sm', confirmText: turnOn ? 'نعم، فعّل الصيانة' : 'نعم، أوقف الصيانة', message: turnOn ? 'تأكيد ثانٍ: تفعيل الصيانة الآن؟' : 'تأكيد ثانٍ: إيقاف الصيانة الآن؟' });
    if (!second) return;
    this.store.setDraft('maintenanceMode', turnOn);
    const ok = await this.store.save(['maintenanceMode']);
    if (!ok) this.dangerError.set(this.store.failure()?.text ?? 'تعذّر تنفيذ الإجراء. لم يتغيّر شيء.');
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
