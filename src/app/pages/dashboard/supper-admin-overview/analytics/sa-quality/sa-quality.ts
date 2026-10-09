import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ScoreItem {
  label: string;
  value: number;
  display: string;
  color: string;
}

interface ReviewItem {
  stars: string;
  pair: string;
  text: string;
  time: string;
  tone: 'good' | 'ok' | 'bad';
}

interface WorstProvider {
  initial: string;
  avatarGradient: string;
  name: string;
  meta: string;
  tone: 'critical' | 'warn' | 'notice';
}

interface ContestedReview {
  stars: string;
  pair: string;
  text: string;
}

@Component({
  selector: 'app-sa-quality',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-quality.html',
  styleUrl: './sa-quality.css',
})
export class SaQuality {
  readonly kpis = [
    { value: '4.6★', label: 'تقييم وسيط AI العام', color: '#2BD4C7' },
    { value: '92.4%', label: 'رضا طالبي الخدمة', color: '#0FA99A' },
    { value: '74', label: 'NPS Score', color: '#FFB400' },
    { value: '64.8%', label: 'معدل العودة', color: '#5DA0FF' },
  ];

  readonly scoreItems: ScoreItem[] = [
    { label: 'رضا طالبي الخدمة', value: 92, display: '92%', color: '#0FA99A' },
    { label: 'رضا مقدمي الخدمة', value: 88, display: '88%', color: '#2BD4C7' },
    { label: 'معدل إتمام المشاريع', value: 85, display: '85%', color: '#5DA0FF' },
    { label: 'حل النزاعات خلال 7 أيام', value: 94, display: '94%', color: '#59C1F5' },
    { label: 'متوسط وقت الرد (دعم)', value: 68, display: '3.2h', color: '#FFB400' },
    { label: 'تقييمات سلبية (<3★)', value: 12, display: '12%', color: '#FF8C69' },
  ];

  readonly reviews: ReviewItem[] = [
    { stars: '5★', pair: 'نورة السهلي → شركة الخليج', text: '"خدمة ممتازة وتسليم في الوقت المحدد، أنصح بها"', time: 'قبل 2 ساعة', tone: 'good' },
    { stars: '4★', pair: 'أحمد الزهراني → منى الشمري', text: '"جيد لكن كان يمكن أن يكون التواصل أفضل"', time: 'قبل 5 ساعات', tone: 'ok' },
    { stars: '2★', pair: 'مجهول → ريم الحربي', text: '"تأخر كبير في التسليم دون إبلاغ مسبق"', time: 'أمس', tone: 'bad' },
  ];

  readonly alerts = [
    { text: '⚠ 3 مقدمين تراجع تقييمهم تحت 3.5★ هذا الشهر', color: '#FF8C69' },
    { text: '⚠ تخصص Blockchain: معدل إتمام 58% — أقل من المعيار', color: '#FFB400' },
    { text: '✓ NPS ارتفع +4 نقاط من الشهر الماضي', color: '#0FA99A' },
  ];

  readonly worstProviders: WorstProvider[] = [
    { initial: 'ع', avatarGradient: 'linear-gradient(135deg,#FF6B6B,#59C1F5)', name: 'عبدالرحمن الدوسري', meta: '2.8★ · 4 بلاغات · احتيال مشتبه', tone: 'critical' },
    { initial: 'ر', avatarGradient: 'linear-gradient(135deg,#FFB400,#FF8C69)', name: 'ريم الحربي', meta: '3.1★ · تأخر متكرر · 21 يوم بلا نشاط', tone: 'warn' },
    { initial: 'خ', avatarGradient: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', name: 'خالد الدوسري', meta: '3.3★ · عقدان ملغيان · تحذير أول', tone: 'notice' },
  ];

  contestedReviews = signal<ContestedReview[]>([
    { stars: '1★', pair: 'نورة السهلي ← طالب مجهول', text: '"لم يُسلَّم العمل أبداً" — المقدمة تعترض' },
    { stars: '2★', pair: 'أحمد الزهراني ← شركة الخليج', text: '"خدمة سيئة" — بدون تفاصيل، مشبوه' },
  ]);


  toast = signal<string>('');

  handleReview(action: 'keep' | 'remove', item: ContestedReview): void {
    this.contestedReviews.update((list) => list.filter((r) => r !== item));
    this.toast.set(action === 'keep' ? 'تم إبقاء التقييم كما هو' : 'تم حذف التقييم');
    setTimeout(() => this.toast.set(''), 2500);
  }
}
