import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface PopPoint {
  name: string;
  flag: string;
  latency: string;
  latencyColor: string;
  cacheHit: string;
}

interface AssetPerf {
  type: string;
  cacheHit: string;
  cacheHitColor: string;
  transferred: string;
  latency: string;
  latencyColor: string;
  requests: string;
  status: 'excellent' | 'good' | 'fair';
}

@Component({
  selector: 'app-sa-cdn',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-cdn.html',
  styleUrl: './sa-cdn.css',
})
export class SaCdn {
  readonly kpis = [
    { label: 'CDN Cache Hit Rate', value: '94.8', unit: 'بالمئة', sub: '+2.3% هذا الأسبوع', color: '#0FA99A', bg: 'rgba(15,169,154,.12)' },
    { label: 'متوسط Latency', value: '18', unit: 'مللي ثانية', sub: 'جميع المناطق', color: '#2BD4C7', bg: 'rgba(43,212,199,.12)' },
    { label: 'البيانات المنقولة', value: '48.2', unit: 'تيرابايت/يوم', sub: 'هذا الشهر: 1.4 PB', color: '#5DA0FF', bg: 'rgba(43,127,255,.12)' },
    { label: 'نقاط التواجد (PoP)', value: '12', unit: 'منطقة جغرافية', sub: 'الشرق الأوسط + أوروبا', color: '#FFB400', bg: 'rgba(255,180,0,.12)' },
  ];

  readonly pops: PopPoint[] = [
    { name: 'الرياض', flag: '🇸🇦', latency: '8ms', latencyColor: '#0FA99A', cacheHit: '97.2%' },
    { name: 'دبي', flag: '🇦🇪', latency: '11ms', latencyColor: '#0FA99A', cacheHit: '96.8%' },
    { name: 'الكويت', flag: '🇰🇼', latency: '14ms', latencyColor: '#2BD4C7', cacheHit: '89.4%' },
    { name: 'القاهرة', flag: '🇪🇬', latency: '28ms', latencyColor: '#FFB400', cacheHit: '84.2%' },
    { name: 'فرانكفورت', flag: '🇩🇪', latency: '22ms', latencyColor: '#0FA99A', cacheHit: '95.1%' },
    { name: 'لندن', flag: '🇬🇧', latency: '19ms', latencyColor: '#0FA99A', cacheHit: '93.8%' },
    { name: 'عمّان', flag: '🇯🇴', latency: '16ms', latencyColor: '#2BD4C7', cacheHit: '91.2%' },
    { name: 'بيروت', flag: '🇱🇧', latency: '32ms', latencyColor: '#FFB400', cacheHit: '82.4%' },
  ];

  readonly assets: AssetPerf[] = [
    { type: 'صور (JPG/PNG/WebP)', cacheHit: '97.8%', cacheHitColor: '#0FA99A', transferred: '18.4 TB', latency: '12ms', latencyColor: '#0FA99A', requests: '24.2M', status: 'excellent' },
    { type: 'ملفات JS/CSS', cacheHit: '99.1%', cacheHitColor: '#0FA99A', transferred: '2.1 TB', latency: '8ms', latencyColor: '#0FA99A', requests: '8.4M', status: 'excellent' },
    { type: 'ملفات PDF', cacheHit: '88.4%', cacheHitColor: '#2BD4C7', transferred: '4.8 TB', latency: '24ms', latencyColor: '#2BD4C7', requests: '1.2M', status: 'good' },
    { type: 'ملفات الصوت/الفيديو', cacheHit: '82.1%', cacheHitColor: '#FFB400', transferred: '22.8 TB', latency: '48ms', latencyColor: '#FFB400', requests: '480K', status: 'fair' },
    { type: 'API Responses (Cache)', cacheHit: '94.2%', cacheHitColor: '#0FA99A', transferred: '0.8 TB', latency: '6ms', latencyColor: '#0FA99A', requests: '42.8M', status: 'excellent' },
  ];

  statusInfo(status: AssetPerf['status']): { bg: string; color: string; label: string } {
    switch (status) {
      case 'excellent': return { bg: 'rgba(15,169,154,.1)', color: '#0FA99A', label: 'ممتاز ✓' };
      case 'good': return { bg: 'rgba(43,212,199,.1)', color: '#2BD4C7', label: 'جيد' };
      default: return { bg: 'rgba(255,180,0,.1)', color: '#FFB400', label: 'مقبول' };
    }
  }
}
