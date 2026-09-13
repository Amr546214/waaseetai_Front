import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type ApiTab = 'all' | 'top' | 'slow' | 'integrations';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  usage: number;
  avgLatency: number;
  p99Latency: number;
  errorRate: number;
  status: 'healthy' | 'slow';
}

interface Integration {
  name: string;
  provider: string;
  status: 'connected' | 'degraded';
  lastSync: string;
}

@Component({
  selector: 'app-sa-apis',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-apis.html',
  styleUrl: './sa-apis.css',
})
export class SaApis {
  readonly kpis = [
    { label: 'إجمالي API Endpoints', value: '247', unit: 'نقطة نهاية', sub: 'v1: 189 | v2: 58', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)' },
    { label: 'Requests/دقيقة', value: '4,842', unit: 'req/min الآن', sub: 'الذروة اليومية: 12,400', color: '#0FA99A', bg: 'rgba(15,169,154,.12)' },
    { label: 'متوسط زمن الاستجابة', value: '142', unit: 'ميلي ثانية', sub: 'أقل من 200ms', color: '#5DA0FF', bg: 'rgba(43,127,255,.12)' },
    { label: 'Error Rate', value: '0.02%', unit: 'خطأ/طلب', sub: 'ممتاز < 0.1%', color: '#0FA99A', bg: 'rgba(255,180,0,.12)' },
  ];

  readonly tabs: { key: ApiTab; label: string }[] = [
    { key: 'all', label: 'كل Endpoints' },
    { key: 'top', label: 'الأكثر استخداماً' },
    { key: 'slow', label: 'الأبطأ' },
    { key: 'integrations', label: 'التكاملات' },
  ];

  readonly activeTab = signal<ApiTab>('all');

  private readonly endpoints: Endpoint[] = [
    { method: 'GET', path: '/api/v2/requests', usage: 1240, avgLatency: 48, p99Latency: 124, errorRate: 0.01, status: 'healthy' },
    { method: 'POST', path: '/api/v2/offers', usage: 892, avgLatency: 62, p99Latency: 189, errorRate: 0.02, status: 'healthy' },
    { method: 'GET', path: '/api/v2/users/profile', usage: 784, avgLatency: 34, p99Latency: 98, errorRate: 0.0, status: 'healthy' },
    { method: 'PUT', path: '/api/v2/contracts/:id', usage: 412, avgLatency: 284, p99Latency: 892, errorRate: 0.08, status: 'slow' },
    { method: 'POST', path: '/api/v2/ai/match', usage: 248, avgLatency: 142, p99Latency: 380, errorRate: 0.01, status: 'healthy' },
  ];

  readonly integrations: Integration[] = [
    { name: 'بوابة الدفع', provider: 'Stripe', status: 'connected', lastSync: 'منذ دقيقتين' },
    { name: 'خرائط المواقع', provider: 'Google Maps', status: 'connected', lastSync: 'منذ 5 دقائق' },
    { name: 'الرسائل النصية', provider: 'Twilio', status: 'connected', lastSync: 'منذ دقيقة' },
    { name: 'تخزين الملفات', provider: 'AWS S3', status: 'connected', lastSync: 'منذ 30 ثانية' },
    { name: 'إشعارات Push', provider: 'Firebase FCM', status: 'degraded', lastSync: 'منذ 18 دقيقة' },
  ];

  readonly filteredEndpoints = computed<Endpoint[]>(() => {
    const list = [...this.endpoints];
    switch (this.activeTab()) {
      case 'top':
        return list.sort((a, b) => b.usage - a.usage);
      case 'slow':
        return list.sort((a, b) => b.avgLatency - a.avgLatency);
      default:
        return list;
    }
  });

  setTab(tab: ApiTab): void {
    this.activeTab.set(tab);
  }

  methodStyle(method: Endpoint['method']): { bg: string; color: string } {
    switch (method) {
      case 'GET':
        return { bg: 'rgba(15,169,154,.15)', color: '#0FA99A' };
      case 'POST':
        return { bg: 'rgba(43,127,255,.15)', color: '#5DA0FF' };
      case 'PUT':
        return { bg: 'rgba(255,140,105,.15)', color: '#FF8C69' };
      default:
        return { bg: 'rgba(255,140,105,.15)', color: '#FF8C69' };
    }
  }

  statusLabel(status: Endpoint['status']): string {
    return status === 'healthy' ? 'صحي' : 'بطيء';
  }

  statusStyle(status: Endpoint['status']): { bg: string; color: string } {
    return status === 'healthy'
      ? { bg: 'rgba(15,169,154,.1)', color: '#0FA99A' }
      : { bg: 'rgba(255,180,0,.1)', color: '#FFB400' };
  }

  integrationStyle(status: Integration['status']): { bg: string; color: string; label: string } {
    return status === 'connected'
      ? { bg: 'rgba(15,169,154,.1)', color: '#0FA99A', label: 'متصل ✓' }
      : { bg: 'rgba(255,180,0,.1)', color: '#FFB400', label: 'بطيء ⚠' };
  }
}
