import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface AiKpi {
  label: string;
  value: string;
  unit: string;
  sub: string;
  color: string;
  subColor: string;
}

interface AiModel {
  name: string;
  color: string;
  status: 'نشط' | 'صيانة';
  accuracy: number;
  requestsToday: string;
  avgResponse: string;
  lastTraining: string;
}

@Component({
  selector: 'app-sa-ai-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-ai-dashboard.html',
  styleUrl: './sa-ai-dashboard.css',
})
export class SaAiDashboard {
  readonly kpis: AiKpi[] = [
    { label: 'إجمالي نماذج AI', value: '12', unit: 'نموذج نشط', sub: 'كلها تعمل بشكل سليم', color: '#2BD4C7', subColor: '#0FA99A' },
    { label: 'متوسط الدقة', value: '94.2%', unit: 'عبر كل النماذج', sub: '+2.1% من الشهر الماضي', color: '#0FA99A', subColor: '#0FA99A' },
    { label: 'طلبات AI اليوم', value: '284k', unit: 'استدعاء نموذج', sub: 'متوسط: 142ms/طلب', color: '#5DA0FF', subColor: '#6B7699' },
    { label: 'آخر إعادة تدريب', value: '3', unit: 'أيام مضت', sub: 'الجاي: 7 أيام', color: '#A56BE0', subColor: '#6B7699' },
  ];

  readonly models: AiModel[] = [
    { name: 'AI Match Engine', color: '#2BD4C7', status: 'نشط', accuracy: 94.8, requestsToday: '124k', avgResponse: '142ms', lastTraining: '3 أيام' },
    { name: 'AI Risk Score', color: '#FF8C69', status: 'نشط', accuracy: 96.2, requestsToday: '48k', avgResponse: '84ms', lastTraining: '7 أيام' },
    { name: 'AI Fraud Detection', color: '#A56BE0', status: 'نشط', accuracy: 98.1, requestsToday: '28k', avgResponse: '62ms', lastTraining: '14 يوم' },
    { name: 'AI Recommendations', color: '#FFB400', status: 'نشط', accuracy: 89.4, requestsToday: '42k', avgResponse: '184ms', lastTraining: '3 أيام' },
    { name: 'AI Forecast', color: '#5DA0FF', status: 'نشط', accuracy: 91.8, requestsToday: '12k', avgResponse: '98ms', lastTraining: '7 أيام' },
    { name: 'AI Health Monitor', color: '#0FA99A', status: 'نشط', accuracy: 94.0, requestsToday: '8.4k', avgResponse: '48ms', lastTraining: '1 يوم' },
  ];
}
