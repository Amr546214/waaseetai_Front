import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Campaign {
  name: string;
  meta: string;
  status: 'مكتمل' | 'مجدولة';
  statusColor: string;
}

@Component({
  selector: 'app-sa-broadcast',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sa-broadcast.html',
  styleUrl: './sa-broadcast.css',
})
export class SaBroadcast {
  audience = signal('كل المستخدمين (12,480)');
  channels = signal({ email: true, sms: false, push: true, inApp: false });
  subject = signal('');
  message = signal('');
  actionLink = signal('');
  scheduleDate = signal('');
  sendResult = signal('');
  errorMessage = signal('');

  readonly audiences = [
    'كل المستخدمين (12,480)',
    'طالبو الخدمة (6,070)',
    'مقدمو الخدمة (6,010)',
    'مشتركو الباقة المتقدمة',
    'غير نشطين 30 يوم',
    'مستخدمون بدون مشروع',
  ];

  // Batch: campaigns/monthStats converted from plain readonly arrays to
  // signals so sendNow()/scheduleIt() can honestly mutate mock state (no
  // backend send endpoint exists) instead of showing a no-op success toast.
  readonly campaigns = signal<Campaign[]>([
    { name: 'تحديث شروط الاستخدام', meta: '12,480 مستلم · فتح 62% · 20 يناير', status: 'مكتمل', statusColor: '#0FA99A' },
    { name: 'إشعار عروض رمضان', meta: '8,400 مستلم · فتح 78% · 15 يناير', status: 'مكتمل', statusColor: '#0FA99A' },
    { name: 'تذكير مستخدمين غير نشطين', meta: '2,100 مستلم · فتح 44% · 10 يناير', status: 'مكتمل', statusColor: '#0FA99A' },
    { name: 'ترحيب بالمستخدمين الجدد', meta: 'مجدولة · 1 فبراير 10:00 ص', status: 'مجدولة', statusColor: '#FFB400' },
  ]);

  readonly monthStats = signal([
    { value: '4', label: 'حملات أُرسلت', color: '#2BD4C7' },
    { value: '68%', label: 'متوسط الفتح', color: '#0FA99A' },
    { value: '35K', label: 'رسائل أُرسلت', color: '#fff' },
    { value: '0.2%', label: 'إلغاء اشتراك', color: '#FFB400' },
  ]);

  toggleChannel(key: 'email' | 'sms' | 'push' | 'inApp'): void {
    this.channels.update((c) => ({ ...c, [key]: !c[key] }));
  }

  sendNow(): void {
    if (!this.validate()) return;
    this.commitCampaign('مكتمل', '#0FA99A');
    this.sendResult.set('تم الإرسال بنجاح');
    this.resetForm();
    setTimeout(() => this.sendResult.set(''), 3000);
  }

  scheduleIt(): void {
    if (!this.validate()) return;
    if (!this.scheduleDate()) {
      this.errorMessage.set('يرجى تحديد تاريخ ووقت الجدولة');
      return;
    }
    this.commitCampaign('مجدولة', '#FFB400');
    this.sendResult.set('تمت جدولة الإرسال');
    this.resetForm();
    setTimeout(() => this.sendResult.set(''), 3000);
  }

  private validate(): boolean {
    this.errorMessage.set('');
    if (!this.subject().trim()) {
      this.errorMessage.set('يرجى إدخال عنوان الرسالة');
      return false;
    }
    if (!this.message().trim()) {
      this.errorMessage.set('يرجى إدخال نص الرسالة');
      return false;
    }
    const ch = this.channels();
    if (!ch.email && !ch.sms && !ch.push && !ch.inApp) {
      this.errorMessage.set('يرجى اختيار قناة إرسال واحدة على الأقل');
      return false;
    }
    return true;
  }

  private commitCampaign(status: Campaign['status'], statusColor: string): void {
    const recipients = this.parseAudienceCount(this.audience());
    const dateStr = new Intl.DateTimeFormat('ar-SA', { day: 'numeric', month: 'long' }).format(new Date());
    const meta =
      status === 'مجدولة'
        ? `مجدولة · ${this.formatScheduleDate(this.scheduleDate())}`
        : `${recipients.toLocaleString('ar')} مستلم · فتح 0% · ${dateStr}`;

    this.campaigns.update((list) => [{ name: this.subject().trim(), meta, status, statusColor }, ...list]);

    this.monthStats.update((stats) =>
      stats.map((s, i) => {
        if (i === 0) return { ...s, value: String(parseInt(s.value, 10) + 1) };
        if (i === 2) {
          const newTotal = this.parseCompactCount(s.value) + recipients;
          return { ...s, value: this.formatCompactCount(newTotal) };
        }
        return s;
      }),
    );
  }

  private resetForm(): void {
    this.subject.set('');
    this.message.set('');
    this.actionLink.set('');
    this.scheduleDate.set('');
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
