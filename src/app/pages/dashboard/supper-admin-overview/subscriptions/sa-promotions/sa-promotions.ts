import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface PromoService {
  name: string;
  color: string;
  desc: string;
  price: string;
  period: string;
  subscribers: number;
  ctr: number;
  roi: number;
}

@Component({
  selector: 'app-sa-promotions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-promotions.html',
  styleUrl: './sa-promotions.css',
})
export class SaPromotions {
  readonly kpis = [
    { label: 'خدمات ترويجية نشطة', value: '6', unit: 'خدمة', sub: 'متاحة للشراء', color: '#2BD4C7', subColor: '#6B7699' },
    { label: 'إجمالي الإيرادات', value: '1.18M', unit: 'ريال — 2026', sub: '8% من الإجمالي', color: '#0FA99A', subColor: '#6B7699' },
    { label: 'إجمالي المشترين', value: '2,847', unit: 'مقدم خدمة', sub: '59% من المقدمين', color: '#FFB400', subColor: '#D98A0B' },
    { label: 'متوسط ROI', value: '3.8x', unit: 'عائد على الاستثمار', sub: 'أعلى من هدف 3x', color: '#5DA0FF', subColor: '#0FA99A' },
  ];

  readonly services: PromoService[] = [
    { name: 'Boost يومي', color: '#2BD4C7', desc: 'ظهور مميز في أعلى نتائج البحث لمدة 24 ساعة', price: '45 ر.س', period: '/يوم', subscribers: 892, ctr: 8.4, roi: 4.2 },
    { name: 'بروفايل مميز', color: '#5DA0FF', desc: 'شارة مميزة + ظهور أولوية لمدة أسبوع كامل', price: '199 ر.س', period: '/أسبوع', subscribers: 614, ctr: 11.2, roi: 5.1 },
    { name: 'اشتراك Elite', color: '#59C1F5', desc: 'كل مزايا الترويج + أولوية في عروض الطلبات الجديدة', price: '599 ر.س', period: '/شهر', subscribers: 247, ctr: 14.8, roi: 6.2 },
  ];
}
