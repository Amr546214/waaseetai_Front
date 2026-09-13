import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type Channel = 'email' | 'sms' | 'push';

interface NotifTemplate {
  name: string;
  iconColor: string;
  channels: Record<Channel, boolean>;
  preview: string;
  meta: string;
}

interface SendHistoryRow {
  template: string;
  recipients: string;
  openRate: string;
  openRateColor: string;
  date: string;
}

@Component({
  selector: 'app-sa-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-notifications.html',
  styleUrl: './sa-notifications.css',
})
export class SaNotifications {
  showSendModal = signal(false);

  readonly stats = [
    { value: '284K', label: 'إشعارات أُرسلت هذا الشهر', color: '#2BD4C7' },
    { value: '68.4%', label: 'معدل الفتح (Open Rate)', color: '#0FA99A' },
    { value: '12.8%', label: 'معدل النقر (CTR)', color: '#5DA0FF' },
    { value: '0.3%', label: 'معدل إلغاء الاشتراك', color: '#FFB400' },
  ];

  templates: NotifTemplate[] = [
    {
      name: 'قبول الحساب الجديد', iconColor: '#0FA99A',
      channels: { email: true, sms: true, push: true },
      preview: 'مرحباً [الاسم]، تم قبول حسابك في وسيط AI. يمكنك الآن البدء في استخدام كامل ميزات وسيط AI. انضم إلى [رابط]',
      meta: 'آخر تعديل: 15 يناير 2025 · أُرسل 218 مرة هذا الشهر · معدل فتح: 94%',
    },
    {
      name: 'رفض الحساب الجديد', iconColor: '#FF8C69',
      channels: { email: true, sms: true, push: false },
      preview: 'نأسف، [الاسم]. لم نتمكن من قبول حسابك حالياً بسبب: [السبب]. يمكنك التواصل معنا للاستفسار عبر [رابط الدعم]',
      meta: 'آخر تعديل: 20 يناير 2025 · معدل فتح: 78%',
    },
    {
      name: 'بدء مشروع جديد', iconColor: '#2BD4C7',
      channels: { email: true, sms: false, push: true },
      preview: 'تهانينا! بدأ المشروع [اسم المشروع] مع [اسم المقدم/الطالب]. يمكنك متابعة التقدم في لوحة التحكم. [رابط المشروع]',
      meta: 'أُرسل 284 مرة هذا الشهر · معدل فتح: 82%',
    },
    {
      name: 'تحذير نزاع مفتوح', iconColor: '#FFB400',
      channels: { email: true, sms: true, push: true },
      preview: 'تنبيه: تم فتح نزاع على مشروعك [اسم المشروع]. فريق الإدارة يتولى المراجعة. يُرجى تقديم أدلتك خلال 48 ساعة. [رابط]',
      meta: 'معدل فتح: 96% (الأعلى) · حساس — يُرسل تلقائياً فور فتح نزاع',
    },
  ];

  readonly history: SendHistoryRow[] = [
    { template: 'قبول الحساب الجديد', recipients: '218', openRate: '94%', openRateColor: '#0FA99A', date: 'قبل 18 دقيقة' },
    { template: 'تحذير نزاع مفتوح', recipients: '12', openRate: '96%', openRateColor: '#0FA99A', date: 'قبل 3 ساعات' },
    { template: 'إشعار جماعي — تحديث شروط الاستخدام', recipients: '12,480', openRate: '62%', openRateColor: '#FFB400', date: '20 يناير 2025' },
  ];

  toggleChannel(t: NotifTemplate, ch: Channel): void {
    t.channels[ch] = !t.channels[ch];
  }

  openSendModal(): void {
    this.showSendModal.set(true);
  }

  closeSendModal(): void {
    this.showSendModal.set(false);
  }
}
