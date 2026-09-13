import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface AiModelCard {
  name: string;
  color: string;
  accuracy: number;
  requestsToday: string;
  avgLatency: string;
  latencyGood: boolean;
  lastTrained: string;
}

@Component({
  selector: 'app-sa-ai-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-ai-dashboard.html',
  styleUrl: './sa-ai-dashboard.css',
})
export class SaAiDashboard {
  retraining = signal(false);

  readonly kpis = [
    { label: 'إجمالي نماذج AI', value: '12', color: '#2BD4C7', unit: 'نموذج نشط', sub: 'كلها تعمل بشكل سليم', subColor: '#0FA99A' },
    { label: 'متوسط الدقة', value: '94.2%', color: '#0FA99A', unit: 'عبر كل النماذج', sub: '+2.1% من الشهر الماضي', subColor: '#0FA99A' },
    { label: 'طلبات AI اليوم', value: '284k', color: '#5DA0FF', unit: 'استدعاء نموذج', sub: 'متوسط: 142ms/طلب', subColor: '#6B7699' },
    { label: 'آخر إعادة تدريب', value: '3', color: '#A56BE0', unit: 'أيام مضت', sub: 'القادم: 7 أيام', subColor: '#6B7699' },
  ];

  readonly models: AiModelCard[] = [
    { name: 'AI Match Engine', color: '#2BD4C7', accuracy: 94.8, requestsToday: '124k', avgLatency: '142ms', latencyGood: true, lastTrained: '3 أيام' },
    { name: 'AI Risk Score', color: '#FF8C69', accuracy: 96.2, requestsToday: '48k', avgLatency: '84ms', latencyGood: true, lastTrained: '7 أيام' },
    { name: 'AI Fraud Detection', color: '#A56BE0', accuracy: 98.1, requestsToday: '28k', avgLatency: '62ms', latencyGood: true, lastTrained: '14 يوم' },
    { name: 'AI Recommendations', color: '#FFB400', accuracy: 89.4, requestsToday: '42k', avgLatency: '184ms', latencyGood: false, lastTrained: '3 أيام' },
    { name: 'AI Forecast', color: '#5DA0FF', accuracy: 91.8, requestsToday: '12k', avgLatency: '98ms', latencyGood: true, lastTrained: '7 أيام' },
    { name: 'AI Health Monitor', color: '#0FA99A', accuracy: 94.0, requestsToday: '8.4k', avgLatency: '48ms', latencyGood: true, lastTrained: '1 يوم' },
  ];

  gradientFor(color: string): string {
    return `linear-gradient(90deg, ${color}, #2B7FFF)`;
  }

  retrain(): void {
    if (this.retraining()) return;
    this.retraining.set(true);
    setTimeout(() => this.retraining.set(false), 1400);
  }
}
