import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface MatchFactor {
  name: string;
  weight: number;
  color: string;
}

interface MatchDecisionRow {
  request: string;
  bestMatch: string;
  score: number;
  scoreColor: string;
  topFactor: string;
  accepted: boolean;
}

interface DecisionFactor {
  label: string;
  val: number;
  note: string;
  color: string;
}

interface Decision {
  name: string;
  score: string;
  factors: DecisionFactor[];
}

@Component({
  selector: 'app-sa-match-engine',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-match-engine.html',
  styleUrl: './sa-match-engine.css',
})
export class SaMatchEngine {
  readonly factors: MatchFactor[] = [
    { name: 'التخصص المهني', weight: 30, color: '#2BD4C7' },
    { name: 'تقييمات المستخدم', weight: 25, color: '#0FA99A' },
    { name: 'الميزانية / السعر', weight: 20, color: '#FFB400' },
    { name: 'سجل إتمام المشاريع', weight: 15, color: '#A56BE0' },
    { name: 'الموقع الجغرافي', weight: 10, color: '#6B7699' },
  ];

  readonly liveMatch = {
    score: '94.8%',
    request: 'تصميم موقع تجاري',
    matched: 'نورة السهلي',
    breakdown: [
      { label: 'تخصص مطابق', value: '+28.5', color: '#2BD4C7' },
      { label: 'تقييم 4.9/5', value: '+24.4', color: '#0FA99A' },
      { label: 'ضمن الميزانية', value: '+18.2', color: '#FFB400' },
      { label: 'إتمام 98%', value: '+14.8', color: '#A56BE0' },
      { label: 'موقع جغرافي', value: '+8.9', color: '#6B7699' },
    ],
    lastTraining: '3 أيام',
    trainingSize: '2.4M طلب',
    model: 'Gradient Boosting v3.2',
  };

  readonly decisionRows: MatchDecisionRow[] = [
    { request: 'تصميم تطبيق جوال', bestMatch: 'أحمد الزهراني', score: 97.2, scoreColor: '#0FA99A', topFactor: 'تخصص (30%) + تقييم (24%)', accepted: true },
    { request: 'تطوير قاعدة بيانات', bestMatch: 'سارة المالكي', score: 92.4, scoreColor: '#0FA99A', topFactor: 'سجل إتمام (15%) + تخصص (28%)', accepted: true },
    { request: 'ترجمة وثائق قانونية', bestMatch: 'خالد العمري', score: 84.8, scoreColor: '#FFB400', topFactor: 'تخصص (28%) + ميزانية (19%)', accepted: false },
    { request: 'استشارة محاسبية', bestMatch: 'ريم الحربي', score: 96.1, scoreColor: '#0FA99A', topFactor: 'تقييم (24.5%) + تخصص (29%)', accepted: true },
  ];

  readonly decisions: Decision[] = [
    {
      name: 'نورة السهلي', score: '94.8%', factors: [
        { label: 'تطابق التخصص', val: 98, note: 'تصميم ويب — مطابق تماماً للطلب', color: '#0FA99A' },
        { label: 'التقييم (4.9★)', val: 95, note: 'أعلى من متوسط السوق 4.2★', color: '#0FA99A' },
        { label: 'معدل إنجاز في الوقت', val: 92, note: '23 مشروع، 91% في الموعد', color: '#2BD4C7' },
        { label: 'سعر vs السوق', val: 88, note: 'أقل بـ 8% من متوسط السوق', color: '#FFB400' },
        { label: 'نشاط حديث', val: 80, note: 'آخر مشروع منذ 3 أيام', color: '#5DA0FF' },
      ]
    },
    {
      name: 'أحمد الزهراني', score: '87.2%', factors: [
        { label: 'تطابق التخصص', val: 90, note: 'تصميم ويب — مطابق مع خبرة أقل', color: '#2BD4C7' },
        { label: 'التقييم (4.6★)', val: 85, note: 'جيد لكن أقل من المقدمة الأولى', color: '#2BD4C7' },
        { label: 'معدل إنجاز في الوقت', val: 88, note: '18 مشروع، 88% في الموعد', color: '#2BD4C7' },
        { label: 'سعر vs السوق', val: 82, note: 'مطابق للمتوسط', color: '#FFB400' },
        { label: 'نشاط حديث', val: 91, note: 'آخر مشروع منذ يوم', color: '#0FA99A' },
      ]
    },
    {
      name: 'سارة القحطاني', score: '81.5%', factors: [
        { label: 'تطابق التخصص', val: 85, note: 'تصميم — تخصص أوسع', color: '#2BD4C7' },
        { label: 'التقييم (4.7★)', val: 87, note: 'جيد جداً', color: '#2BD4C7' },
        { label: 'معدل إنجاز في الوقت', val: 78, note: '15 مشروع، 80% في الموعد', color: '#FFB400' },
        { label: 'سعر vs السوق', val: 72, note: 'أعلى بـ 15% من المتوسط', color: '#FF8C69' },
        { label: 'نشاط حديث', val: 85, note: 'آخر مشروع منذ أسبوع', color: '#5DA0FF' },
      ]
    },
  ];

  selectedDecision = signal(0);

  activeDecision = computed(() => this.decisions[this.selectedDecision()]);

  showDecision(i: number): void {
    this.selectedDecision.set(i);
  }
}
