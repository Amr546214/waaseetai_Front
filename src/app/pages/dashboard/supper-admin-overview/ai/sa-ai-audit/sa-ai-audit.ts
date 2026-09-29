import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type RecType = 'upgrade' | 'match' | 'risk';
type TabKey = 'all' | 'upgrade' | 'match' | 'risk' | 'rejected';
type Outcome = 'accepted' | 'review' | 'pending' | 'rejected';

interface AiKpi {
  label: string;
  value: string;
  unit: string;
  sub: string;
  color: string;
  subColor: string;
}

interface RecommendationRow {
  time: string;
  type: RecType;
  typeLabel: string;
  typeColor: string;
  user: string;
  recommendation: string;
  recColor: string;
  confidence: number;
  confColor: string;
  reason: string;
  outcome: Outcome;
}

@Component({
  selector: 'app-sa-ai-audit',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-ai-audit.html',
  styleUrl: './sa-ai-audit.css',
})
export class SaAiAudit {
  readonly kpis: AiKpi[] = [
    { label: 'توصيات اليوم', value: '42k', unit: 'توصية', sub: 'عبر كل النماذج', color: '#2BD4C7', subColor: '#6B7699' },
    { label: 'معدل القبول', value: '89.4%', unit: 'من التوصيات', sub: 'قبلها المستخدمون', color: '#0FA99A', subColor: '#0FA99A' },
    { label: 'وقت الاستجابة', value: '184', unit: 'ميلي ثانية', sub: 'متوسط توليد التوصية', color: '#FFB400', subColor: '#6B7699' },
    { label: 'سجلات Audit', value: '42M', unit: 'سجل محفوظ', sub: 'محفوظ 1 سنة', color: '#A56BE0', subColor: '#6B7699' },
  ];

  readonly tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'كل التوصيات' },
    { key: 'upgrade', label: 'ترقية الباقة' },
    { key: 'match', label: 'المطابقة' },
    { key: 'risk', label: 'تحليل المخاطر' },
    { key: 'rejected', label: 'مرفوضة' },
  ];

  readonly outcomeLabels: Record<Outcome, string> = {
    accepted: 'قُبل ✓',
    review: 'تحت المراجعة',
    pending: 'معلقة',
    rejected: 'رُفض ✗',
  };

  readonly outcomeColors: Record<Outcome, string> = {
    accepted: '#0FA99A',
    review: '#FFB400',
    pending: '#FFB400',
    rejected: '#FF8C69',
  };

  readonly rows: RecommendationRow[] = [
    { time: '14:32:18', type: 'upgrade', typeLabel: 'ترقية باقة', typeColor: '#2BD4C7', user: 'هيثم القرني', recommendation: 'ترقية من Basic → Pro', recColor: '#A56BE0', confidence: 89, confColor: '#0FA99A', reason: 'نشاط مرتفع + تجاوز حد الطلبات', outcome: 'accepted' },
    { time: '14:28:44', type: 'risk', typeLabel: 'تحليل مخاطر', typeColor: '#FF8C69', user: 'معاملة T-9118', recommendation: 'تأجيل سحب — مخاطرة متوسطة', recColor: '#FF8C69', confidence: 76, confColor: '#FFB400', reason: 'نمط سحب غير معتاد', outcome: 'review' },
    { time: '14:15:02', type: 'match', typeLabel: 'مطابقة', typeColor: '#A56BE0', user: 'طلب RQ-4821', recommendation: 'أحمد الزهراني (97.2%)', recColor: '#A56BE0', confidence: 97, confColor: '#A56BE0', reason: 'تطابق تخصص + تقييم عالٍ', outcome: 'accepted' },
    { time: '13:58:31', type: 'upgrade', typeLabel: 'ترقية باقة', typeColor: '#2BD4C7', user: 'شركة الأفق', recommendation: 'ترقية من Pro → Business', recColor: '#A56BE0', confidence: 92, confColor: '#0FA99A', reason: '4 مستخدمون + طلبات enterprise', outcome: 'pending' },
    { time: '13:44:12', type: 'match', typeLabel: 'مطابقة', typeColor: '#A56BE0', user: 'طلب RQ-4819', recommendation: 'ريم الحربي (84.4%)', recColor: '#FF8C69', confidence: 84, confColor: '#FFB400', reason: 'تطابق جزئي للتخصص', outcome: 'rejected' },
    { time: '13:31:07', type: 'risk', typeLabel: 'تحليل مخاطر', typeColor: '#FF8C69', user: 'معاملة T-9114', recommendation: 'موافقة سحب فوري — مخاطرة منخفضة', recColor: '#0FA99A', confidence: 95, confColor: '#0FA99A', reason: 'سجل سحب منتظم + حساب موثّق', outcome: 'accepted' },
    { time: '13:20:52', type: 'upgrade', typeLabel: 'ترقية باقة', typeColor: '#2BD4C7', user: 'سلمى العتيبي', recommendation: 'ترقية من Basic → Pro', recColor: '#A56BE0', confidence: 81, confColor: '#FFB400', reason: 'استخدام متكرر لميزات Pro المقفلة', outcome: 'rejected' },
  ];

  activeTab = signal<TabKey>('all');

  filteredRows = computed(() => {
    const tab = this.activeTab();
    if (tab === 'all') return this.rows;
    if (tab === 'rejected') return this.rows.filter((r) => r.outcome === 'rejected');
    return this.rows.filter((r) => r.type === tab);
  });

  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
  }
}
