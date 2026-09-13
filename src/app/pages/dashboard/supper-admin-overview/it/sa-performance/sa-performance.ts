import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface PerfRow {
  label: string;
  value: number;
  displayValue: string;
  color: string;
}

interface ServicePerf {
  name: string;
  p50: string;
  p50Color: string;
  p95: string;
  p95Color: string;
  errorRate: string;
  errorColor: string;
  throughput: string;
  status: 'healthy' | 'slow' | 'watch';
}

@Component({
  selector: 'app-sa-performance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-performance.html',
  styleUrl: './sa-performance.css',
})
export class SaPerformance {
  readonly kpis = [
    { label: 'Response Time P95', value: '142', unit: 'مللي ثانية', sub: 'ضمن الهدف', color: '#0FA99A', bg: 'rgba(15,169,154,.12)' },
    { label: 'CPU Usage', value: '67', unit: 'بالمئة', sub: 'ذروة: 89%', color: '#FFB400', bg: 'rgba(255,180,0,.12)' },
    { label: 'Throughput', value: '3,240', unit: 'طلب/دقيقة', sub: '+8% عن الأمس', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)' },
    { label: 'Error Rate', value: '0.02', unit: 'بالمئة', sub: 'ممتاز', color: '#0FA99A', bg: 'rgba(15,169,154,.12)' },
  ];

  readonly resourceUsage: PerfRow[] = [
    { label: 'CPU', value: 67, displayValue: '67%', color: '#FFB400' },
    { label: 'Memory', value: 54, displayValue: '54%', color: '#2BD4C7' },
    { label: 'Disk I/O', value: 32, displayValue: '32%', color: '#0FA99A' },
    { label: 'Network', value: 48, displayValue: '48%', color: '#5DA0FF' },
  ];

  readonly responseDistribution: PerfRow[] = [
    { label: 'P50', value: 20, displayValue: '42ms', color: '#0FA99A' },
    { label: 'P75', value: 38, displayValue: '84ms', color: '#2BD4C7' },
    { label: 'P95', value: 65, displayValue: '142ms', color: '#FFB400' },
    { label: 'P99', value: 88, displayValue: '480ms', color: '#FF6B6B' },
  ];

  readonly services: ServicePerf[] = [
    { name: 'API Gateway', p50: '42ms', p50Color: '#0FA99A', p95: '142ms', p95Color: '#0FA99A', errorRate: '0.01%', errorColor: '#0FA99A', throughput: '1,840', status: 'healthy' },
    { name: 'Auth Service', p50: '18ms', p50Color: '#0FA99A', p95: '67ms', p95Color: '#0FA99A', errorRate: '0.00%', errorColor: '#0FA99A', throughput: '420', status: 'healthy' },
    { name: 'Match Engine AI', p50: '380ms', p50Color: '#FFB400', p95: '1,240ms', p95Color: '#FF6B6B', errorRate: '0.04%', errorColor: '#0FA99A', throughput: '92', status: 'slow' },
    { name: 'Notification', p50: '8ms', p50Color: '#0FA99A', p95: '24ms', p95Color: '#0FA99A', errorRate: '0.00%', errorColor: '#0FA99A', throughput: '680', status: 'healthy' },
    { name: 'File Upload', p50: '210ms', p50Color: '#FFB400', p95: '890ms', p95Color: '#FFB400', errorRate: '0.12%', errorColor: '#FFB400', throughput: '148', status: 'watch' },
    { name: 'Payment Service', p50: '124ms', p50Color: '#0FA99A', p95: '380ms', p95Color: '#0FA99A', errorRate: '0.02%', errorColor: '#0FA99A', throughput: '84', status: 'healthy' },
  ];

  statusInfo(status: ServicePerf['status']): { bg: string; color: string; label: string } {
    switch (status) {
      case 'healthy': return { bg: 'rgba(15,169,154,.1)', color: '#0FA99A', label: 'صحي ✓' };
      case 'slow': return { bg: 'rgba(255,180,0,.1)', color: '#FFB400', label: 'بطيء ⚠' };
      default: return { bg: 'rgba(255,180,0,.1)', color: '#FFB400', label: 'مراقبة ⚠' };
    }
  }
}
