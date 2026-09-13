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
  sendResult = signal('');

  readonly audiences = [
    'كل المستخدمين (12,480)',
    'طالبو الخدمة (6,070)',
    'مقدمو الخدمة (6,010)',
    'مشتركو الباقة المتقدمة',
    'غير نشطين 30 يوم',
    'مستخدمون بدون مشروع',
  ];

  readonly campaigns: Campaign[] = [
    { name: 'تحديث شروط الاستخدام', meta: '12,480 مستلم · فتح 62% · 20 يناير', status: 'مكتمل', statusColor: '#0FA99A' },
    { name: 'إشعار عروض رمضان', meta: '8,400 مستلم · فتح 78% · 15 يناير', status: 'مكتمل', statusColor: '#0FA99A' },
    { name: 'تذكير مستخدمين غير نشطين', meta: '2,100 مستلم · فتح 44% · 10 يناير', status: 'مكتمل', statusColor: '#0FA99A' },
    { name: 'ترحيب بالمستخدمين الجدد', meta: 'مجدولة · 1 فبراير 10:00 ص', status: 'مجدولة', statusColor: '#FFB400' },
  ];

  readonly monthStats = [
    { value: '4', label: 'حملات أُرسلت', color: '#2BD4C7' },
    { value: '68%', label: 'متوسط الفتح', color: '#0FA99A' },
    { value: '35K', label: 'رسائل أُرسلت', color: '#fff' },
    { value: '0.2%', label: 'إلغاء اشتراك', color: '#FFB400' },
  ];

  toggleChannel(key: 'email' | 'sms' | 'push' | 'inApp'): void {
    this.channels.update((c) => ({ ...c, [key]: !c[key] }));
  }

  sendNow(): void {
    this.sendResult.set('تم الإرسال بنجاح');
    setTimeout(() => this.sendResult.set(''), 3000);
  }

  scheduleIt(): void {
    this.sendResult.set('تمت جدولة الإرسال');
    setTimeout(() => this.sendResult.set(''), 3000);
  }
}
