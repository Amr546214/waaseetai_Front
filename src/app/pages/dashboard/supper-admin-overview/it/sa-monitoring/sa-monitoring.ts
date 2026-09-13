import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ResourceGauge {
  icon: string;
  label: string;
  value: number;
  displayValue: string;
  unit: string;
  color: string;
  sub: string;
}

interface AlertRule {
  rule: string;
  cond: string;
  status: string;
  level: 'normal' | 'warning';
}

@Component({
  selector: 'app-sa-monitoring',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-monitoring.html',
  styleUrl: './sa-monitoring.css',
})
export class SaMonitoring {
  readonly gauges: ResourceGauge[] = [
    { icon: '🖥️', label: 'CPU (Primary)', value: 34, displayValue: '34', unit: '%', color: '#2BD4C7', sub: 'الذروة اليومية: 72% | Cores: 32' },
    { icon: '💾', label: 'Memory', value: 58, displayValue: '58', unit: '%', color: '#5DA0FF', sub: 'المستخدم: 18.6 GB من 32 GB' },
    { icon: '💿', label: 'Disk Usage', value: 67, displayValue: '67', unit: '%', color: '#FFB400', sub: 'المستخدم: 2.14 TB من 3.2 TB' },
    { icon: '🌐', label: 'Network I/O', value: 28, displayValue: '284', unit: 'MB/s', color: '#0FA99A', sub: 'Bandwidth: 10 Gbps | Packets: 42k/s' },
  ];

  readonly alertRules: AlertRule[] = [
    { rule: 'CPU > 80%', cond: 'إذا تجاوز CPU 80% لأكثر من 5 دقائق → إشعار فوري', status: 'طبيعي', level: 'normal' },
    { rule: 'Memory > 85%', cond: 'إذا تجاوز الذاكرة 85% → تنبيه تلقائي', status: 'طبيعي', level: 'normal' },
    { rule: 'Disk > 80%', cond: 'الديسك الحالي 67% — AI يتوقع وصوله 80% خلال 18 يوم', status: 'تحذير AI', level: 'warning' },
    { rule: 'Error Rate > 1%', cond: 'إذا تجاوز معدل الأخطاء 1% → إغلاق تلقائي + إشعار', status: 'طبيعي (0.02%)', level: 'normal' },
  ];

  levelColor(level: AlertRule['level']): string {
    return level === 'normal' ? '#0FA99A' : '#FFB400';
  }
}
