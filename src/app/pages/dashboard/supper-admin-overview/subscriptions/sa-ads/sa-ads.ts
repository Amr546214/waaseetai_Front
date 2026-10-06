import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

type AdStatus = 'active' | 'expiring';

interface AdCampaign {
  name: string;
  audience: string;
  dailyBudget: number;
  impressions: number;
  ctr: number;
  endDate: string;
  status: AdStatus;
}

@Component({
  selector: 'app-sa-ads',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-ads.html',
  styleUrl: './sa-ads.css',
})
export class SaAds {
  readonly statusLabels: Record<AdStatus, string> = {
    active: 'نشطة',
    expiring: 'تنتهي قريباً',
  };

  readonly statusColors: Record<AdStatus, string> = {
    active: '#0FA99A',
    expiring: '#FFB400',
  };

  readonly kpis = [
    { label: 'حملات نشطة', value: '24', unit: 'حملة', sub: '+3 هذا الأسبوع', color: '#2BD4C7', subColor: '#0FA99A' },
    { label: 'إجمالي الانطباعات', value: '2.4M', unit: 'هذا الشهر', sub: '+18% شهرياً', color: '#0FA99A', subColor: '#0FA99A' },
    { label: 'معدل CTR', value: '12.4%', unit: 'متوسط الحملات', sub: 'الصناعة: 2.1%', color: '#FFB400', subColor: '#6B7699' },
    { label: 'إيراد الإعلانات', value: '248k', unit: 'دولار — هذا الشهر', sub: '+22% شهرياً', color: '#5DA0FF', subColor: '#0FA99A' },
  ];

  readonly campaigns: AdCampaign[] = [
    { name: 'ابحث عن محاسب', audience: 'طالبو الخدمة — شركات', dailyBudget: 200, impressions: 124800, ctr: 14.2, endDate: '31 يوليو', status: 'active' },
    { name: 'مقدمو الخدمات الجدد', audience: 'مقدمو خدمات — جدد', dailyBudget: 150, impressions: 98400, ctr: 11.8, endDate: '15 أغسطس', status: 'active' },
    { name: 'Pro Package Offer', audience: 'مستخدمو الباقة الأساسية', dailyBudget: 80, impressions: 48240, ctr: 9.4, endDate: '20 يوليو', status: 'expiring' },
    { name: 'Boost Your Profile', audience: 'مقدمو خدمات نشطون', dailyBudget: 120, impressions: 62880, ctr: 13.1, endDate: '30 أغسطس', status: 'active' },
    { name: 'انضم كوسيط معتمد', audience: 'وسطاء محتملون', dailyBudget: 100, impressions: 41200, ctr: 10.6, endDate: '5 سبتمبر', status: 'active' },
    { name: 'تجديد اشتراك Business', audience: 'مشتركو Business المنتهية قريباً', dailyBudget: 70, impressions: 22960, ctr: 12.9, endDate: '18 يوليو', status: 'expiring' },
  ];
}
