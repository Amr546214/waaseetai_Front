import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type SecTab = 'all' | 'threats' | 'admin-logins' | 'system-changes' | 'blocked-ips';

interface SecurityEvent {
  time: string;
  type: string;
  ip: string;
  user: string;
  action: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'info';
  allowed: boolean;
  category: Exclude<SecTab, 'all'>;
}

@Component({
  selector: 'app-sa-security',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-security.html',
  styleUrl: './sa-security.css',
})
export class SaSecurity {
  readonly kpis = [
    { label: 'Threat Score', value: 'LOW', unit: 'مستوى الخطر', sub: 'لا تهديدات نشطة', color: '#0FA99A', bg: 'rgba(15,169,154,.12)' },
    { label: 'محاولات فاشلة', value: '847', unit: 'آخر 24 ساعة', sub: '89% محجوبة تلقائياً', color: '#FF8C69', bg: 'rgba(255,140,105,.12)' },
    { label: 'IPs محجوبة', value: '124', unit: 'عنوان IP', sub: 'حجب تلقائي بـ AI', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)' },
    { label: 'Audit Logs اليوم', value: '24,812', unit: 'سجل', sub: 'محفوظ 90 يوم', color: '#5DA0FF', bg: 'rgba(43,127,255,.12)' },
  ];

  readonly tabs: { key: SecTab; label: string }[] = [
    { key: 'all', label: 'كل الأحداث' },
    { key: 'threats', label: 'تهديدات' },
    { key: 'admin-logins', label: 'دخول المدراء' },
    { key: 'system-changes', label: 'تغييرات النظام' },
    { key: 'blocked-ips', label: 'IPs محجوبة' },
  ];

  readonly activeTab = signal<SecTab>('all');

  private readonly events: SecurityEvent[] = [
    { time: '14:32:18', type: 'دخول إداري', ip: '192.168.1.1', user: 'مدير النظام', action: 'تسجيل دخول ناجح', severity: 'low', allowed: true, category: 'admin-logins' },
    { time: '14:28:44', type: 'محاولة Brute Force', ip: '185.220.101.47', user: '—', action: '5 محاولات في دقيقة', severity: 'high', allowed: false, category: 'blocked-ips' },
    { time: '14:15:02', type: 'تغيير إعدادات', ip: '10.0.0.42', user: 'مشرف الموارد', action: 'تعديل عمولات M8', severity: 'medium', allowed: true, category: 'system-changes' },
    { time: '13:58:31', type: 'SQL Injection محاولة', ip: '91.108.56.142', user: '—', action: 'محاولة حقن استعلام', severity: 'critical', allowed: false, category: 'threats' },
    { time: '13:44:12', type: 'تصدير بيانات', ip: '10.0.0.15', user: 'مدير المالية', action: 'تصدير تقرير مالي', severity: 'info', allowed: true, category: 'system-changes' },
  ];

  readonly filteredEvents = computed<SecurityEvent[]>(() => {
    const tab = this.activeTab();
    if (tab === 'all') return this.events;
    if (tab === 'threats') return this.events.filter((e) => e.category === 'threats' || e.severity === 'high' || e.severity === 'critical');
    return this.events.filter((e) => e.category === tab);
  });

  setTab(tab: SecTab): void {
    this.activeTab.set(tab);
  }

  severityLabel(s: SecurityEvent['severity']): string {
    switch (s) {
      case 'low': return 'منخفضة';
      case 'medium': return 'متوسطة';
      case 'high': return 'عالية';
      case 'critical': return 'خطيرة';
      default: return 'معلومات';
    }
  }

  severityStyle(s: SecurityEvent['severity']): { bg: string; color: string } {
    switch (s) {
      case 'low': return { bg: 'rgba(15,169,154,.1)', color: '#0FA99A' };
      case 'medium': return { bg: 'rgba(255,180,0,.1)', color: '#FFB400' };
      case 'high': return { bg: 'rgba(255,140,105,.1)', color: '#FF8C69' };
      case 'critical': return { bg: 'rgba(255,140,105,.15)', color: '#FF8C69' };
      default: return { bg: 'rgba(43,127,255,.1)', color: '#5DA0FF' };
    }
  }
}
