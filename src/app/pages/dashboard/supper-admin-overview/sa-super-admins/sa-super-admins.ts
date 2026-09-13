import { Component, signal, WritableSignal } from '@angular/core';
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
    { key: 'wordFilter', label: 'فلتر الكلمات المسيئة', desc: 'AI يفلتر الرسائل والمحتوى', on: true },
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
    { key: 'anomalyLock', label: 'قفل الحساب تلقائياً عند الشذوذ', desc: 'AI يرصد تسجيل الدخول المشبوه', on: true },
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
    { key: 'match', label: 'AI Match Engine', desc: 'مطابقة المشاريع بمقدمي الخدمة', on: true },
    { key: 'recommend', label: 'AI Recommendations', desc: 'توصيات مخصصة لكل مستخدم', on: true },
    { key: 'fraud', label: 'AI Fraud Detection', desc: 'كشف النشاطات المشبوهة', on: true },
    { key: 'dispute', label: 'AI Dispute Resolution', desc: 'مساعدة في حل النزاعات', on: true },
    { key: 'moderation', label: 'AI Content Moderation', desc: 'فلترة المحتوى المسيء', on: true },
  ]);
  readonly aiMatchThreshold = signal(70);

  readonly apiKeysMasked = [
    { label: 'بوابة الفوترة (تجهيز مستقبلي)', desc: 'غير مفعّل في V1' },
    { label: 'SMS Gateway (Twilio)', desc: 'مفتاح خدمة الرسائل' },
    { label: 'Payment Gateway (HyperPay)', desc: 'مفتاح بوابة الدفع' },
  ];
  readonly revealedKeys = signal<Set<number>>(new Set());

  readonly auditRows: SpaAuditRow[] = [
    { n: 4812, action: 'تغيير إعداد', detail: 'رسوم النظام: 8% ← 10%', by: 'مدير النظام', role: 'Super Admin', ip: '192.168.1.1', date: 'اليوم 3:12 م', sev: 'high' },
    { n: 4811, action: 'تسجيل دخول', detail: 'دخول ناجح من الرياض', by: 'مدير النظام', role: 'Super Admin', ip: '192.168.1.1', date: 'اليوم 2:40 م', sev: 'info' },
    { n: 4810, action: 'تعليق حساب', detail: 'حساب U-1024 معلّق', by: 'هيثم القرني', role: 'مشرف نزاعات', ip: '10.0.0.42', date: 'اليوم 1:15 م', sev: 'med' },
    { n: 4809, action: 'حذف تعليق', detail: 'حذف تعليق محتوى مسيء', by: 'هيثم القرني', role: 'مشرف نزاعات', ip: '10.0.0.42', date: 'اليوم 12:02 م', sev: 'med' },
    { n: 4808, action: 'تغيير إعداد', detail: 'تفعيل AI Fraud Detection', by: 'مدير النظام', role: 'Super Admin', ip: '192.168.1.1', date: 'أمس 11:44 م', sev: 'high' },
    { n: 4807, action: 'تغيير صلاحية', detail: 'منح صلاحية مشرف لنوف السهلي', by: 'مدير النظام', role: 'Super Admin', ip: '192.168.1.1', date: 'أمس 10:00 م', sev: 'high' },
    { n: 4805, action: 'تسجيل دخول فاشل', detail: '5 محاولات فاشلة — حساب مؤقت', by: 'غير معروف', role: '—', ip: '41.22.x.x', date: 'أمس 2:11 ص', sev: 'danger' },
  ];

  readonly sevConfig: Record<SpaAuditRow['sev'], { bg: string; color: string; lbl: string }> = {
    info: { bg: 'rgba(43,212,199,.10)', color: '#2BD4C7', lbl: 'معلومة' },
    med: { bg: 'rgba(255,180,0,.10)', color: '#D98A0B', lbl: 'متوسط' },
    high: { bg: 'rgba(255,140,105,.10)', color: '#FF8C69', lbl: 'عالي' },
    danger: { bg: 'rgba(255,80,80,.12)', color: '#FF5050', lbl: 'خطر' },
  };

  readonly dangerActions: DangerAction[] = [
    { key: 'maintenance', label: 'تفعيل وضع الصيانة الكامل', desc: 'يعطل النظام لجميع المستخدمين', buttonLabel: 'تفعيل' },
    { key: 'wipeTest', label: 'مسح قاعدة بيانات الاختبار', desc: 'حذف بيانات بيئة التطوير', buttonLabel: 'تنفيذ' },
    { key: 'broadcast', label: 'إرسال إشعار لجميع المستخدمين', desc: 'نشرة إعلانية لـ 12,480 مستخدم', buttonLabel: 'إرسال' },
    { key: 'backup', label: 'تصدير نسخة احتياطية كاملة', desc: 'DB Snapshot — مشفّرة', buttonLabel: 'تصدير' },
  ];

  readonly confirmingAction = signal<DangerAction | null>(null);
  readonly toastMessage = signal('');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  setSection(s: SpaSection) {
    this.activeSection.set(s);
  }

  toggle(list: WritableSignal<SpaToggle[]>, key: string) {
    list.update((rows) => rows.map((r) => (r.key === key ? { ...r, on: !r.on } : r)));
  }

  toggleReveal(index: number) {
    this.revealedKeys.update((set) => {
      const next = new Set(set);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  isRevealed(index: number): boolean {
    return this.revealedKeys().has(index);
  }

  requestDanger(action: DangerAction) {
    this.confirmingAction.set(action);
  }

  cancelDanger() {
    this.confirmingAction.set(null);
  }

  confirmDanger() {
    const action = this.confirmingAction();
    if (!action) return;
    this.confirmingAction.set(null);
    this.showToast(`تم تنفيذ: ${action.label}`);
  }

  save() {
    this.showToast('تم حفظ التغييرات');
  }

  private showToast(msg: string) {
    this.toastMessage.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage.set(''), 2200);
  }
}
