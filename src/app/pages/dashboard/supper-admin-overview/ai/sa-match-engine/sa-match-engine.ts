import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface MatchFactor {
  label: string;
  weight: number;
  color: string;
}

interface MatchDecision {
  request: string;
  provider: string;
  score: string;
  scoreGood: boolean;
  topFactor: string;
  accepted: boolean;
}

interface ExplainFactor {
  label: string;
  value: number;
  note: string;
  color: string;
}

interface Candidate {
  name: string;
  score: string;
  factors: ExplainFactor[];
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
    { label: 'التخصص المهني', weight: 30, color: '#2BD4C7' },
    { label: 'تقييمات المستخدم', weight: 25, color: '#0FA99A' },
    { label: 'الميزانية / السعر', weight: 20, color: '#FFB400' },
    { label: 'سجل إتمام المشاريع', weight: 15, color: '#A56BE0' },
    { label: 'الموقع الجغرافي', weight: 10, color: '#6B7699' },
  ];

  readonly decisions: MatchDecision[] = [
    { request: 'تصميم تطبيق جوال', provider: 'أحمد الزهراني', score: '97.2%', scoreGood: true, topFactor: 'تخصص (30%) + تقييم (24%)', accepted: true },
    { request: 'تطوير قاعدة بيانات', provider: 'سارة المالكي', score: '92.4%', scoreGood: true, topFactor: 'سجل إتمام (15%) + تخصص (28%)', accepted: true },
    { request: 'ترجمة وثائق قانونية', provider: 'خالد العمري', score: '84.8%', scoreGood: false, topFactor: 'تخصص (28%) + ميزانية (19%)', accepted: false },
    { request: 'استشارة محاسبية', provider: 'ريم الحربي', score: '96.1%', scoreGood: true, topFactor: 'تقييم (24.5%) + تخصص (29%)', accepted: true },
  ];

  readonly candidates: Candidate[] = [
    {
      name: 'نورة السهلي', score: '94.8%',
      factors: [
        { label: 'تطابق التخصص', value: 98, note: 'تصميم ويب — مطابق تماماً للطلب', color: '#0FA99A' },
        { label: 'التقييم (4.9★)', value: 95, note: 'أعلى من متوسط السوق 4.2★', color: '#0FA99A' },
        { label: 'معدل إنجاز في الوقت', value: 92, note: '23 مشروع، 91% في الموعد', color: '#2BD4C7' },
        { label: 'سعر vs السوق', value: 88, note: 'أقل بـ 8% من متوسط السوق', color: '#FFB400' },
        { label: 'نشاط حديث', value: 80, note: 'آخر مشروع منذ 3 أيام', color: '#5DA0FF' },
      ],
    },
    {
      name: 'أحمد الزهراني', score: '87.2%',
      factors: [
        { label: 'تطابق التخصص', value: 90, note: 'تصميم ويب — مطابق مع خبرة أقل', color: '#2BD4C7' },
        { label: 'التقييم (4.6★)', value: 85, note: 'جيد لكن أقل من المقدمة الأولى', color: '#2BD4C7' },
        { label: 'معدل إنجاز في الوقت', value: 88, note: '18 مشروع، 88% في الموعد', color: '#2BD4C7' },
        { label: 'سعر vs السوق', value: 82, note: 'مطابق للمتوسط', color: '#FFB400' },
        { label: 'نشاط حديث', value: 91, note: 'آخر مشروع منذ يوم', color: '#0FA99A' },
      ],
    },
    {
      name: 'سارة القحطاني', score: '81.5%',
      factors: [
        { label: 'تطابق التخصص', value: 85, note: 'تصميم — تخصص أوسع', color: '#2BD4C7' },
        { label: 'التقييم (4.7★)', value: 87, note: 'جيد جداً', color: '#2BD4C7' },
        { label: 'معدل إنجاز في الوقت', value: 78, note: '15 مشروع، 80% في الموعد', color: '#FFB400' },
        { label: 'سعر vs السوق', value: 72, note: 'أعلى بـ 15% من المتوسط', color: '#FF8C69' },
        { label: 'نشاط حديث', value: 85, note: 'آخر مشروع منذ أسبوع', color: '#5DA0FF' },
      ],
    },
  ];

  activeCandidate = signal(0);

  selectCandidate(i: number): void {
    this.activeCandidate.set(i);
  }

  get activeCandidateData(): Candidate {
    return this.candidates[this.activeCandidate()];
  }
}
