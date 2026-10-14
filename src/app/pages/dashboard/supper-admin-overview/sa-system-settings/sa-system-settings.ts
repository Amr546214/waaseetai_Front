import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WsSelectComponent } from '../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { environment } from '../../../../../environments/environment';
import { PlatformSettings, SaSystemSettingsService, SettingsHistoryRow } from './sa-system-settings.service';

type SettingsSection = 'general' | 'legal' | 'notifications' | 'security' | 'finance' | 'localization' | 'health';

interface ToggleRow {
  key: string;
  label: string;
  desc: string;
  on: boolean;
}

interface HealthRow {
  name: string;
  value: string;
  color: string;
}

/** Shown on every control that is not backed by a stored/enforced setting (nothing is faked as saved). */
export const NOT_WIRED_REASON = 'غير مفعّل حالياً: هذا الخيار غير مرتبط بإعداد محفوظ في النظام، لذا لا يمكن تعديله من هنا.';

@Component({
  selector: 'app-sa-system-settings',
  standalone: true,
  imports: [CommonModule, WsSelectComponent, FormsModule],
  templateUrl: './sa-system-settings.html',
  styleUrl: './sa-system-settings.css',
})
export class SaSystemSettings implements OnInit {
  private api = inject(SaSystemSettingsService);
  private confirmModal = inject(ConfirmModalService);

  readonly notWiredReason = NOT_WIRED_REASON;
  readonly appVersion = environment.appVersion;

  readonly sections: { key: SettingsSection; label: string }[] = [
    { key: 'general', label: 'عام' },
    { key: 'legal', label: 'الشروط والخصوصية' },
    { key: 'notifications', label: 'الإشعارات' },
    { key: 'security', label: 'الأمان' },
    { key: 'finance', label: 'المالية' },
    { key: 'localization', label: 'الإقليمية' },
    { key: 'health', label: 'صحة النظام' },
  ];

  readonly activeSection = signal<SettingsSection>('general');

  // ── Real, saved settings (GET/PUT /admin/settings) ──
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly saving = signal(false);
  /** false until the platform_settings table exists on the server: the page opens with the built-in values and saving is disabled with a visible reason. */
  readonly storageReady = signal(true);
  readonly error = signal('');
  readonly saved = signal<PlatformSettings | null>(null);
  readonly form = signal<PlatformSettings>({
    platformName: '', supportEmail: '', supportPhone: '', maintenanceBannerEnabled: false, maintenanceBannerText: '',
    termsVersion: '', privacyVersion: '', termsContent: '', privacyContent: '', adminNotificationEmail: '',
  });
  readonly history = signal<SettingsHistoryRow[]>([]);
  readonly historyError = signal('');

  // ── Display-only values: not stored, not enforced. Rendered disabled with a visible reason. ──
  readonly generalToggles = signal<ToggleRow[]>([
    { key: 'maintenance', label: 'وضع الصيانة', desc: 'إيقاف الوصول لجميع المستخدمين مؤقتاً', on: false },
    { key: 'registration', label: 'تسجيل حسابات جديدة', desc: 'السماح بإنشاء حسابات جديدة', on: true },
    { key: 'liveSupport', label: 'الدعم الفوري', desc: 'تفعيل مساعد الأسئلة الشائعة للدعم الفوري', on: true },
  ]);
  readonly notificationToggles = signal<ToggleRow[]>([
    { key: 'emailNotif', label: 'إشعارات البريد الإلكتروني', desc: 'إرسال إيميلات للمستخدمين عند الأحداث المهمة', on: true },
    { key: 'pushNotif', label: 'إشعارات الجوال (Push)', desc: 'إرسال إشعارات للتطبيق المحمول', on: true },
    { key: 'disputeNotif', label: 'إشعارات النزاعات للإدارة', desc: 'تنبيه عند فتح نزاع جديد', on: true },
  ]);
  readonly sessionDuration = signal('24');
  readonly securityToggles = signal<ToggleRow[]>([
    { key: '2fa', label: 'التحقق الثنائي (2FA)', desc: 'لحسابات الإدارة', on: true },
    { key: 'auditLog', label: 'تسجيل سجلات التدقيق', desc: 'حفظ كل إجراء إداري في السجل', on: true },
    { key: 'ipBlock', label: 'حظر IP عند الفشل المتكرر', desc: 'حظر تلقائي بعد محاولات فاشلة', on: true },
  ]);
  readonly currency = signal('USD');
  readonly paymentGateway = signal('PayPal');
  readonly financeToggles = signal<ToggleRow[]>([
    { key: 'autoRelease', label: 'الإفراج التلقائي عن الضمان', desc: 'إفراج تلقائي بعد قبول التسليم', on: true },
  ]);
  readonly timezone = signal('Asia/Riyadh (GMT+3)');
  readonly dateFormat = signal('DD/MM/YYYY');
  readonly calendarSystem = signal('ميلادي');

  readonly healthRows: HealthRow[] = [
    { name: 'خوادم التطبيق', value: 'غير متاح: لا يوجد مصدر مراقبة مرتبط', color: '#6B7699' },
    { name: 'قاعدة البيانات', value: 'غير متاح: لا يوجد مصدر مراقبة مرتبط', color: '#6B7699' },
    { name: 'بوابة الدفع', value: 'غير متاح: لا يوجد مصدر مراقبة مرتبط', color: '#6B7699' },
    { name: 'خدمة البريد الإلكتروني', value: 'غير متاح: لا يوجد مصدر مراقبة مرتبط', color: '#6B7699' },
    { name: 'النسخ الاحتياطي', value: 'غير متاح: لا يوجد مصدر مراقبة مرتبط', color: '#6B7699' },
  ];

  readonly savedToast = signal(false);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.loadSettings();
    this.loadHistory();
  }

  private errMsg(e: unknown, fallback: string): string {
    const err = e as HttpErrorResponse;
    return err?.error?.message || err?.error?.error || fallback;
  }

  loadSettings(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.api.get().subscribe({
      next: (r) => { this.saved.set(r.data); this.form.set({ ...r.data }); this.storageReady.set(r.storageReady !== false); this.loading.set(false); },
      error: (e) => { this.loadError.set(this.errMsg(e, 'تعذر تحميل الإعدادات.')); this.loading.set(false); },
    });
  }

  loadHistory(): void {
    this.api.history().subscribe({
      next: (r) => { this.history.set(r.data); this.historyError.set(''); },
      error: (e) => this.historyError.set(this.errMsg(e, 'تعذر تحميل سجل التغييرات.')),
    });
  }

  setSection(s: SettingsSection) {
    this.activeSection.set(s);
    this.error.set('');
  }

  setField<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  /** Keys of the given group that differ from what is stored. */
  private changed(keys: (keyof PlatformSettings)[]): Partial<PlatformSettings> {
    const saved = this.saved();
    const f = this.form();
    const patch: Record<string, unknown> = {};
    for (const k of keys) if (!saved || saved[k] !== f[k]) patch[k] = f[k];
    return patch as Partial<PlatformSettings>;
  }

  hasChanges(keys: (keyof PlatformSettings)[]): boolean {
    return Object.keys(this.changed(keys)).length > 0;
  }

  /** Confirm, then PUT only the changed keys of the visible section. */
  async save(keys: (keyof PlatformSettings)[]) {
    const patch = this.changed(keys);
    if (!Object.keys(patch).length || this.saving()) return;
    const ok = await this.confirmModal.confirm({
      title: 'حفظ الإعدادات',
      message: 'سيتم تطبيق هذه التغييرات على المنصة وتسجيلها في سجل التدقيق. هل تريد المتابعة؟',
      type: 'warning',
      confirmText: 'حفظ التغييرات',
    });
    if (!ok) return;
    this.saving.set(true);
    this.error.set('');
    this.api.save(patch).subscribe({
      next: (r) => {
        this.saved.set(r.data);
        this.form.set({ ...r.data });
        this.saving.set(false);
        this.showToast();
        this.loadHistory();
      },
      error: (e) => { this.saving.set(false); this.error.set(this.errMsg(e, 'تعذر حفظ الإعدادات.')); },
    });
  }

  private showToast() {
    this.savedToast.set(true);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.savedToast.set(false), 2500);
  }
}
