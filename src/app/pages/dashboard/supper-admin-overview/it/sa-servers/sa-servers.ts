import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ServerMetric {
  label: string;
  value: number;
  color: string;
  suffix: string;
}

interface ServerCard {
  name: string;
  status: 'healthy' | 'warning' | 'down';
  metrics: ServerMetric[];
  meta: string;
}

@Component({
  selector: 'app-sa-servers',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-servers.html',
  styleUrl: './sa-servers.css',
})
export class SaServers {
  readonly kpis = [
    { label: 'Uptime', value: '99.98%', unit: 'آخر 30 يوم', sub: 'SLA مضمون 99.9%', color: '#0FA99A', bg: 'rgba(15,169,154,.12)' },
    { label: 'متوسط زمن الاستجابة', value: '142', unit: 'ميلي ثانية', sub: 'أقل من هدف 200ms', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)' },
    { label: 'معدل الأخطاء', value: '0.02%', unit: 'Error Rate', sub: 'جيد جداً', color: '#0FA99A', bg: 'rgba(255,140,105,.12)' },
    { label: 'Requests/دقيقة', value: '4,842', unit: 'req/min', sub: 'الذروة: 12,400', color: '#5DA0FF', bg: 'rgba(43,127,255,.12)' },
  ];

  readonly servers = signal<ServerCard[]>([
    {
      name: 'API Server (Primary)',
      status: 'healthy',
      metrics: [
        { label: 'CPU', value: 34, color: '#2BD4C7', suffix: '%' },
        { label: 'Memory', value: 58, color: '#5DA0FF', suffix: '%' },
      ],
      meta: 'Uptime: 42 يوم | AWS ap-east-1',
    },
    {
      name: 'API Server (Replica)',
      status: 'healthy',
      metrics: [
        { label: 'CPU', value: 28, color: '#2BD4C7', suffix: '%' },
        { label: 'Memory', value: 52, color: '#5DA0FF', suffix: '%' },
      ],
      meta: 'Uptime: 38 يوم | AWS ap-east-2',
    },
    {
      name: 'Database (Primary)',
      status: 'healthy',
      metrics: [
        { label: 'CPU', value: 67, color: '#FFB400', suffix: '%' },
        { label: 'Disk I/O', value: 42, color: '#5DA0FF', suffix: ' MB/s' },
      ],
      meta: 'Uptime: 42 يوم | RDS PostgreSQL',
    },
    {
      name: 'Redis Cache',
      status: 'healthy',
      metrics: [
        { label: 'Hit Rate', value: 94.2, color: '#0FA99A', suffix: '%' },
        { label: 'Memory', value: 34, color: '#5DA0FF', suffix: ' GB (3.4)' },
      ],
      meta: 'Uptime: 42 يوم | ElastiCache',
    },
    {
      name: 'Queue Server',
      status: 'healthy',
      metrics: [
        { label: 'Queue Size', value: 12, color: '#2BD4C7', suffix: ' (124)' },
        { label: 'Process Rate', value: 80, color: '#0FA99A', suffix: ' (2,400/min)' },
      ],
      meta: 'Uptime: 42 يوم | SQS',
    },
    {
      name: 'Load Balancer',
      status: 'healthy',
      metrics: [
        { label: 'Active Connections', value: 17, color: '#2BD4C7', suffix: ' (847)' },
        { label: 'Throughput', value: 57, color: '#5DA0FF', suffix: ' (284 MB/s)' },
      ],
      meta: 'Uptime: 42 يوم | ALB',
    },
  ]);

  readonly lastUpdated = signal(new Date());
  readonly refreshing = signal(false);

  statusColor(status: ServerCard['status']): string {
    return status === 'healthy' ? '#0FA99A' : status === 'warning' ? '#FFB400' : '#FF8C69';
  }

  refresh(): void {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    setTimeout(() => {
      this.servers.update((list) =>
        list.map((s) => ({
          ...s,
          metrics: s.metrics.map((m) => ({
            ...m,
            value: Math.max(1, Math.min(99, Math.round((m.value + (Math.random() * 8 - 4)) * 10) / 10)),
          })),
        })),
      );
      this.lastUpdated.set(new Date());
      this.refreshing.set(false);
    }, 500);
  }

  formatTime(d: Date): string {
    return new Intl.DateTimeFormat('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(d);
  }
}
