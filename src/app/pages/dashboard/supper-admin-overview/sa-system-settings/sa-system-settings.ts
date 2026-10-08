import { Component, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WsSelectComponent } from '../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';

type SettingsSection = 'general' | 'notifications' | 'security' | 'finance' | 'localization' | 'health';

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

interface ChangeLogRow {
  time: string;
  message: string;
  ip: string;
  warn?: boolean;
}

@Component({
  selector: 'app-sa-system-settings',
  standalone: true,
  imports: [CommonModule, WsSelectComponent, FormsModule],
  templateUrl: './sa-system-settings.html',
  styleUrl: './sa-system-settings.css',
})
export class SaSystemSettings {
  readonly sections: { key: SettingsSection; label: string }[] = [
    { key: 'general', label: 'عام' },
    { key: 'notifications', label: 'الإشعارات' },
    { key: 'security', label: 'الأمان' },
    { key: 'finance', label: 'المالية' },
    { key: 'localization', label: 'الإقليمية' },
    { key: 'health', label: 'صحة النظام' },
  ];

  readonly activeSection = signal<SettingsSection>('general');

  readonly systemName = signal('وسيط AI');
  readonly generalToggles = signal<ToggleRow[]>([
    { key: 'maintenance', label: 'وضع الصيانة', desc: 'يوقف الوصول لجميع المستخدمين مؤقتاً', on: false },
    { key: 'registration', label: 'تسجيل حسابات جديدة', desc: 'السماح بإنشاء حسابات جديدة', on: true },
    { key: 'liveSupport', label: 'الدعم الفوري', desc: 'تفعيل مساعد الأسئلة الشائعة للدعم الفوري', on: true },
  ]);

  readonly adminEmail = signal('admin@waseet.ai');
  readonly notificationToggles = signal<ToggleRow[]>([
    { key: 'emailNotif', label: 'إشعارات البريد الإلكتروني', desc: 'إرسال إيميلات للمستخدمين عند الأحداث المهمة', on: true },
    { key: 'pushNotif', label: 'إشعارات الجوال (Push)', desc: 'إرسال إشعارات للتطبيق المحمول', on: true },
    { key: 'disputeNotif', label: 'إشعارات النزاعات للإدارة', desc: 'تنبيه فوري عند فتح نزاع جديد', on: true },
  ]);

  readonly sessionDuration = signal('24');
  readonly securityToggles = signal<ToggleRow[]>([
    { key: '2fa', label: 'التحقق الثنائي (2FA)', desc: 'إلزامي لجميع حسابات الإدارة', on: true },
    { key: 'auditLog', label: 'تسجيل سجلات التدقيق', desc: 'حفظ كل إجراء إداري في السجل', on: true },
    { key: 'ipBlock', label: 'حظر IP عند الفشل المتكرر', desc: 'حظر تلقائي بعد 5 محاولات فاشلة', on: true },
  ]);

  readonly currency = signal('USD');
  readonly paymentGateway = signal('PayPal');
  readonly financeToggles = signal<ToggleRow[]>([
    { key: 'futureBilling', label: 'تجهيز فوترة مستقبلية غير مفعّلة في V1', desc: 'تكامل مستقبلي مع الجهات الحكومية المختصة — Phase 2', on: true },
    { key: 'autoRelease', label: 'الإفراج التلقائي عن الضمان', desc: 'إفراج بعد 72 ساعة من قبول التسليم', on: true },
  ]);

  readonly timezone = signal('Asia/Riyadh (GMT+3)');
  readonly dateFormat = signal('DD/MM/YYYY');
  readonly calendarSystem = signal('ميلادي');

  readonly healthRows: HealthRow[] = [
    { name: 'خوادم التطبيق', value: '99.8% uptime', color: '#0FA99A' },
    { name: 'قاعدة البيانات', value: 'نشطة', color: '#0FA99A' },
    { name: 'بوابة الدفع (PayPal)', value: 'متصلة', color: '#0FA99A' },
    { name: 'بوابة الفوترة (تجهيز مستقبلي)', value: 'غير مفعّلة في V1', color: '#6B7699' },
    { name: 'CDN وتسليم الملفات', value: 'نشط', color: '#0FA99A' },
    { name: 'خدمة البريد الإلكتروني', value: 'نشطة', color: '#0FA99A' },
    { name: 'النسخ الاحتياطي', value: 'آخر نسخة: اليوم 3:00 ص', color: '#0FA99A' },
  ];

  readonly changeLog: ChangeLogRow[] = [
    { time: 'منذ 2h', message: 'مدير النظام غيّر نسبة الرسوم من 10% ← 10% (لا تغيير)', ip: 'IP: 197.32.14.88' },
    { time: 'أمس', message: 'مدير النظام أضاف قالب إشعار جديد (قبول الحساب)', ip: 'IP: 197.32.14.88' },
    { time: '3 أيام', message: 'مدير النظام غيّر مدة الجلسة من 8 ← 24 ساعة', ip: 'IP: 197.32.14.88' },
  ];

  readonly savedToast = signal(false);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  setSection(s: SettingsSection) {
    this.activeSection.set(s);
  }

  toggle(list: WritableSignal<ToggleRow[]>, key: string) {
    list.update((rows) => rows.map((r) => (r.key === key ? { ...r, on: !r.on } : r)));
  }

  save() {
    this.savedToast.set(true);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.savedToast.set(false), 2000);
  }
}
