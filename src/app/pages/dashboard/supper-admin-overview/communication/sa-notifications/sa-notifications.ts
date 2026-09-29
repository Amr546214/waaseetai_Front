import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './sa-notifications.html',
  styleUrl: './sa-notifications.css',
})
export class SaNotifications {
  showSendModal = signal(false);

  // Batch: bulk-send modal fields were previously unbound to any component
  // state — "إرسال الآن"/"جدولة الإرسال" just called closeSendModal() with
  // no validation, no feedback, and no effect. Bound here so send/schedule
  // can validate input and honestly mutate mock state (no backend bulk-send
  // endpoint exists).
  readonly bulkAudiences = [
    'كل المستخدمين (12,480)',
    'طالبو الخدمة فقط (6,070)',
    'مقدمو الخدمة فقط (6,010)',
    'المشتركون في الباقة المتقدمة',
    'المستخدمون غير النشطين (30 يوم)',
  ];
  bulkAudience = signal(this.bulkAudiences[0]);
  bulkChannels = signal({ email: true, sms: false, push: true });
  bulkSubject = signal('');
  bulkMessage = signal('');
  bulkScheduleDate = signal('');
  bulkError = signal('');
  bulkResult = signal('');

  readonly stats = signal([
    { value: '284K', label: 'إشعارات أُرسلت هذا الشهر', color: '#2BD4C7' },
    { value: '68.4%', label: 'معدل الفتح (Open Rate)', color: '#0FA99A' },
    { value: '12.8%', label: 'معدل النقر (CTR)', color: '#5DA0FF' },
    { value: '0.3%', label: 'معدل إلغاء الاشتراك', color: '#FFB400' },
  ]);

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

  readonly history = signal<SendHistoryRow[]>([
    { template: 'قبول الحساب الجديد', recipients: '218', openRate: '94%', openRateColor: '#0FA99A', date: 'قبل 18 دقيقة' },
    { template: 'تحذير نزاع مفتوح', recipients: '12', openRate: '96%', openRateColor: '#0FA99A', date: 'قبل 3 ساعات' },
    { template: 'إشعار جماعي — تحديث شروط الاستخدام', recipients: '12,480', openRate: '62%', openRateColor: '#FFB400', date: '20 يناير 2025' },
  ]);

  toggleChannel(t: NotifTemplate, ch: Channel): void {
    t.channels[ch] = !t.channels[ch];
  }

  toggleBulkChannel(ch: Channel): void {
    this.bulkChannels.update((c) => ({ ...c, [ch]: !c[ch] }));
  }

  openSendModal(): void {
    this.resetBulkForm();
    this.showSendModal.set(true);
  }

  closeSendModal(): void {
    this.showSendModal.set(false);
    this.resetBulkForm();
  }

  sendBulkNow(): void {
    if (!this.validateBulk()) return;
    this.commitBulkSend('الآن');
    this.bulkResult.set('تم إرسال الإشعار الجماعي بنجاح');
    this.showSendModal.set(false);
    this.resetBulkForm();
    setTimeout(() => this.bulkResult.set(''), 3000);
  }

  scheduleBulkSend(): void {
    if (!this.validateBulk()) return;
    if (!this.bulkScheduleDate()) {
      this.bulkError.set('يرجى تحديد تاريخ ووقت الجدولة');
      return;
    }
    this.commitBulkSend(this.formatScheduleDate(this.bulkScheduleDate()));
    this.bulkResult.set('تمت جدولة الإشعار الجماعي');
    this.showSendModal.set(false);
    this.resetBulkForm();
    setTimeout(() => this.bulkResult.set(''), 3000);
  }

  private validateBulk(): boolean {
    this.bulkError.set('');
    if (!this.bulkSubject().trim()) {
      this.bulkError.set('يرجى إدخال عنوان الإشعار');
      return false;
    }
    if (!this.bulkMessage().trim()) {
      this.bulkError.set('يرجى إدخال نص الرسالة');
      return false;
    }
    const ch = this.bulkChannels();
    if (!ch.email && !ch.sms && !ch.push) {
      this.bulkError.set('يرجى اختيار قناة إرسال واحدة على الأقل');
      return false;
    }
    return true;
  }

  private commitBulkSend(dateLabel: string): void {
    const recipients = this.parseAudienceCount(this.bulkAudience());
    this.history.update((rows) => [
      {
        template: `إشعار جماعي — ${this.bulkSubject().trim()}`,
        recipients: recipients.toLocaleString('ar'),
        openRate: '—',
        openRateColor: '#6B7699',
        date: dateLabel,
      },
      ...rows,
    ]);

    this.stats.update((s) =>
      s.map((row, i) => {
        if (i !== 0) return row;
        const total = this.parseCompactCount(row.value) + recipients;
        return { ...row, value: this.formatCompactCount(total) };
      }),
    );
  }

  private resetBulkForm(): void {
    this.bulkSubject.set('');
    this.bulkMessage.set('');
    this.bulkScheduleDate.set('');
    this.bulkError.set('');
  }

  private parseAudienceCount(audience: string): number {
    const match = audience.match(/\(([\d,]+)\)/);
    return match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
  }

  private parseCompactCount(value: string): number {
    const num = parseFloat(value.replace(/[^\d.]/g, '')) || 0;
    return /K$/i.test(value) ? num * 1000 : num;
  }

  private formatCompactCount(value: number): string {
    if (value >= 1000) {
      const k = value / 1000;
      return `${k % 1 === 0 ? k : k.toFixed(1)}K`;
    }
    return String(Math.round(value));
  }

  private formatScheduleDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('ar-SA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(d);
  }
}
