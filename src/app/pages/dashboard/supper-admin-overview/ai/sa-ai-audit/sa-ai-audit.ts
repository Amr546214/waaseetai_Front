import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type RecTab = 'all' | 'upgrade' | 'match' | 'risk' | 'rejected';

interface RecRow {
  time: string;
  type: 'upgrade' | 'match' | 'risk';
  typeLabel: string;
  typeColor: string;
  user: string;
  recommendation: string;
  recColor: string;
  confidence: number;
  confColor: string;
  reason: string;
  outcome: string;
  outcomeColor: string;
  status: 'accepted' | 'pending' | 'rejected' | 'review';
}

@Component({
  selector: 'app-sa-ai-audit',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-ai-audit.html',
  styleUrl: './sa-ai-audit.css',
})
export class SaAiAudit {
  activeTab = signal<RecTab>('all');

  readonly tabs: { key: RecTab; label: string }[] = [
    { key: 'all', label: 'كل التوصيات' },
    { key: 'upgrade', label: 'ترقية الباقة' },
    { key: 'match', label: 'المطابقة' },
    { key: 'risk', label: 'تحليل المخاطر' },
    { key: 'rejected', label: 'مرفوضة' },
  ];

  readonly kpis = [
    { label: 'توصيات اليوم', value: '42k', color: '#2BD4C7', unit: 'توصية', sub: 'عبر كل النماذج', subColor: '#6B7699' },
    { label: 'معدل القبول', value: '89.4%', color: '#0FA99A', unit: 'من التوصيات', sub: 'قبلها المستخدمون', subColor: '#0FA99A' },
    { label: 'وقت الاستجابة', value: '184', color: '#FFB400', unit: 'ميلي ثانية', sub: 'متوسط توليد التوصية', subColor: '#6B7699' },
    { label: 'سجلات Audit', value: '42M', color: '#A56BE0', unit: 'سجل محفوظ', sub: 'محفوظ 1 سنة', subColor: '#6B7699' },
  ];

  private readonly allRows: RecRow[] = [
    { time: '14:32:18', type: 'upgrade', typeLabel: 'ترقية باقة', typeColor: '#2BD4C7', user: 'هيثم القرني', recommendation: 'ترقية من Basic → Pro', recColor: '#A56BE0', confidence: 89, confColor: '#0FA99A', reason: 'نشاط مرتفع + تجاوز حد الطلبات', outcome: 'قُبل ✓', outcomeColor: '#0FA99A', status: 'accepted' },
    { time: '14:28:44', type: 'risk', typeLabel: 'تحليل مخاطر', typeColor: '#FF8C69', user: 'معاملة T-9118', recommendation: 'تأجيل سحب — مخاطرة متوسطة', recColor: '#FF8C69', confidence: 76, confColor: '#FFB400', reason: 'نمط سحب غير معتاد', outcome: 'تحت المراجعة', outcomeColor: '#FFB400', status: 'review' },
    { time: '14:15:02', type: 'match', typeLabel: 'مطابقة', typeColor: '#A56BE0', user: 'طلب RQ-4821', recommendation: 'أحمد الزهراني (97.2%)', recColor: '#A56BE0', confidence: 97, confColor: '#A56BE0', reason: 'تطابق تخصص + تقييم عالٍ', outcome: 'قُبل ✓', outcomeColor: '#0FA99A', status: 'accepted' },
    { time: '13:58:31', type: 'upgrade', typeLabel: 'ترقية باقة', typeColor: '#2BD4C7', user: 'شركة الأفق', recommendation: 'ترقية من Pro → Business', recColor: '#A56BE0', confidence: 92, confColor: '#0FA99A', reason: '4 مستخدمون + طلبات enterprise', outcome: 'معلقة', outcomeColor: '#FFB400', status: 'pending' },
    { time: '13:44:12', type: 'match', typeLabel: 'مطابقة', typeColor: '#A56BE0', user: 'طلب RQ-4819', recommendation: 'ريم الحربي (84.4%)', recColor: '#FF8C69', confidence: 84, confColor: '#FFB400', reason: 'تطابق جزئي للتخصص', outcome: 'رُفض ✗', outcomeColor: '#FF8C69', status: 'rejected' },
  ];

  filteredRows = computed(() => {
    const tab = this.activeTab();
    if (tab === 'all') return this.allRows;
    if (tab === 'rejected') return this.allRows.filter((r) => r.status === 'rejected');
    return this.allRows.filter((r) => r.type === tab);
  });

  setTab(tab: RecTab): void {
    this.activeTab.set(tab);
  }
}
