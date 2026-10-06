import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface TopEarner {
  rank: number;
  rankColor: string;
  initial: string;
  avatarGradient: string;
  name: string;
  meta: string;
  barPct: number;
  revenue: string;
  revenueColor: string;
}

interface AtRiskProvider {
  name: string;
  meta: string;
  color: string;
  bg: string;
  border: string;
}

interface UpgradeCandidate {
  name: string;
  meta: string;
}

interface SpecialtyGap {
  name: string;
  status: string;
  color: string;
}

@Component({
  selector: 'app-sa-analytics-providers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sa-analytics-providers.html',
  styleUrl: './sa-analytics-providers.css',
})
export class SaAnalyticsProviders {
  period = signal('يناير 2025');
  readonly periods = ['يناير 2025', 'ديسمبر 2024', 'الربع الأول'];

  private readonly kpisByPeriod: Record<string, { value: string; label: string; color: string }[]> = {
    'يناير 2025': [
      { value: '6,010', label: 'مقدمو خدمة نشطون', color: '#2BD4C7' },
      { value: '4.3★', label: 'متوسط التقييم', color: '#0FA99A' },
      { value: '299M', label: 'إجمالي الإيرادات ($)', color: '#59C1F5' },
      { value: '85%', label: 'معدل إتمام المشاريع', color: '#FFB400' },
    ],
    'ديسمبر 2024': [
      { value: '5,742', label: 'مقدمو خدمة نشطون', color: '#2BD4C7' },
      { value: '4.2★', label: 'متوسط التقييم', color: '#0FA99A' },
      { value: '253M', label: 'إجمالي الإيرادات ($)', color: '#59C1F5' },
      { value: '82%', label: 'معدل إتمام المشاريع', color: '#FFB400' },
    ],
    'الربع الأول': [
      { value: '6,010', label: 'مقدمو خدمة نشطون', color: '#2BD4C7' },
      { value: '4.3★', label: 'متوسط التقييم', color: '#0FA99A' },
      { value: '812M', label: 'إجمالي الإيرادات ($)', color: '#59C1F5' },
      { value: '86%', label: 'معدل إتمام المشاريع', color: '#FFB400' },
    ],
  };

  readonly kpis = computed(() => this.kpisByPeriod[this.period()] ?? this.kpisByPeriod['يناير 2025']);

  private readonly topEarnersByPeriod: Record<string, TopEarner[]> = {
    'يناير 2025': [
      { rank: 1, rankColor: '#FFB400', initial: 'ن', avatarGradient: 'linear-gradient(135deg,#59C1F5,#5DA0FF)', name: 'شركة الرياض للتصميم', meta: 'مقدم شركة · 52 مشروع · 4.8★', barPct: 100, revenue: '210K', revenueColor: '#2BD4C7' },
      { rank: 2, rankColor: '#6B7699', initial: 'ن', avatarGradient: 'linear-gradient(135deg,#59C1F5,#5DA0FF)', name: 'نورة السهلي', meta: 'مقدم فرد · Platinum · 4.9★', barPct: 59, revenue: '124K', revenueColor: '#5DA0FF' },
      { rank: 3, rankColor: '#6B7699', initial: 'أ', avatarGradient: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', name: 'أحمد الزهراني', meta: 'مقدم فرد · Platinum · 4.7★', barPct: 28, revenue: '58K', revenueColor: '#A8B2D1' },
      { rank: 4, rankColor: '#6B7699', initial: 'س', avatarGradient: 'linear-gradient(135deg,#FFB400,#0FA99A)', name: 'سارة القحطاني', meta: 'مقدم فرد · Gold · 4.9★', barPct: 15, revenue: '32K', revenueColor: '#A8B2D1' },
    ],
    'ديسمبر 2024': [
      { rank: 1, rankColor: '#FFB400', initial: 'ن', avatarGradient: 'linear-gradient(135deg,#59C1F5,#5DA0FF)', name: 'شركة الرياض للتصميم', meta: 'مقدم شركة · 47 مشروع · 4.7★', barPct: 100, revenue: '188K', revenueColor: '#2BD4C7' },
      { rank: 2, rankColor: '#6B7699', initial: 'أ', avatarGradient: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', name: 'أحمد الزهراني', meta: 'مقدم فرد · Platinum · 4.6★', barPct: 52, revenue: '98K', revenueColor: '#5DA0FF' },
      { rank: 3, rankColor: '#6B7699', initial: 'ن', avatarGradient: 'linear-gradient(135deg,#59C1F5,#5DA0FF)', name: 'نورة السهلي', meta: 'مقدم فرد · Platinum · 4.8★', barPct: 41, revenue: '77K', revenueColor: '#A8B2D1' },
      { rank: 4, rankColor: '#6B7699', initial: 'خ', avatarGradient: 'linear-gradient(135deg,#FFB400,#0FA99A)', name: 'خالد المطيري', meta: 'مقدم فرد · Gold · 4.6★', barPct: 19, revenue: '36K', revenueColor: '#A8B2D1' },
    ],
    'الربع الأول': [
      { rank: 1, rankColor: '#FFB400', initial: 'ن', avatarGradient: 'linear-gradient(135deg,#59C1F5,#5DA0FF)', name: 'شركة الرياض للتصميم', meta: 'مقدم شركة · 142 مشروع · 4.8★', barPct: 100, revenue: '612K', revenueColor: '#2BD4C7' },
      { rank: 2, rankColor: '#6B7699', initial: 'ن', avatarGradient: 'linear-gradient(135deg,#59C1F5,#5DA0FF)', name: 'نورة السهلي', meta: 'مقدم فرد · Platinum · 4.9★', barPct: 61, revenue: '372K', revenueColor: '#5DA0FF' },
      { rank: 3, rankColor: '#6B7699', initial: 'أ', avatarGradient: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', name: 'أحمد الزهراني', meta: 'مقدم فرد · Platinum · 4.7★', barPct: 30, revenue: '182K', revenueColor: '#A8B2D1' },
      { rank: 4, rankColor: '#6B7699', initial: 'س', avatarGradient: 'linear-gradient(135deg,#FFB400,#0FA99A)', name: 'سارة القحطاني', meta: 'مقدم فرد · Gold · 4.9★', barPct: 16, revenue: '96K', revenueColor: '#A8B2D1' },
    ],
  };

  readonly topEarners = computed(() => this.topEarnersByPeriod[this.period()] ?? this.topEarnersByPeriod['يناير 2025']);

  private readonly atRiskByPeriod: Record<string, AtRiskProvider[]> = {
    'يناير 2025': [
      { name: 'عبدالرحمن الدوسري', meta: 'تقييم انخفض من 4.2 → 3.8 · 2 بلاغات هذا الشهر · في خطر خسارة Silver', color: '#FF8C69', bg: 'rgba(255,140,105,.05)', border: 'rgba(255,140,105,.16)' },
      { name: 'ريم الحربي', meta: 'عدم نشاط 21 يوم · 3 مشاريع معلقة · تحذير', color: '#FFB400', bg: 'rgba(255,180,0,.04)', border: 'rgba(255,180,0,.14)' },
    ],
    'ديسمبر 2024': [
      { name: 'منصور القحطاني', meta: 'تقييم انخفض من 4.0 → 3.5 · 4 بلاغات هذا الشهر · في خطر خسارة Gold', color: '#FF6B6B', bg: 'rgba(255,107,107,.05)', border: 'rgba(255,107,107,.16)' },
    ],
    'الربع الأول': [
      { name: 'عبدالرحمن الدوسري', meta: 'تقييم انخفض من 4.2 → 3.8 · 5 بلاغات هذا الفصل · في خطر خسارة Silver', color: '#FF8C69', bg: 'rgba(255,140,105,.05)', border: 'rgba(255,140,105,.16)' },
      { name: 'ريم الحربي', meta: 'عدم نشاط 40 يوم · 6 مشاريع معلقة · تحذير', color: '#FFB400', bg: 'rgba(255,180,0,.04)', border: 'rgba(255,180,0,.14)' },
      { name: 'منصور القحطاني', meta: 'تقييم انخفض من 4.0 → 3.5 · 9 بلاغات هذا الفصل · في خطر خسارة Gold', color: '#FF6B6B', bg: 'rgba(255,107,107,.05)', border: 'rgba(255,107,107,.16)' },
    ],
  };

  readonly atRisk = computed(() => this.atRiskByPeriod[this.period()] ?? this.atRiskByPeriod['يناير 2025']);

  private readonly upgradeCandidatesByPeriod: Record<string, UpgradeCandidate[]> = {
    'يناير 2025': [
      { name: 'محمد الحربي — Gold → Platinum', meta: '28 مشروع · 4.6★ · يحتاج مشروعاً واحداً فقط' },
      { name: 'هند العتيبي — Bronze → Silver', meta: '15 مشروع · 4.4★ · تستوفي المعايير' },
    ],
    'ديسمبر 2024': [
      { name: 'سلطان الدوسري — Silver → Gold', meta: '22 مشروع · 4.5★ · تستوفي المعايير' },
    ],
    'الربع الأول': [
      { name: 'محمد الحربي — Gold → Platinum', meta: '84 مشروع · 4.6★ · يحتاج مشروعاً واحداً فقط' },
      { name: 'هند العتيبي — Bronze → Silver', meta: '46 مشروع · 4.4★ · تستوفي المعايير' },
      { name: 'سلطان الدوسري — Silver → Gold', meta: '61 مشروع · 4.5★ · تستوفي المعايير' },
    ],
  };

  readonly upgradeCandidates = computed(() => this.upgradeCandidatesByPeriod[this.period()] ?? this.upgradeCandidatesByPeriod['يناير 2025']);

  private readonly gapsByPeriod: Record<string, SpecialtyGap[]> = {
    'يناير 2025': [
      { name: 'Blockchain', status: 'نقص حاد ← فرصة', color: '#FF6B6B' },
      { name: 'الذكاء الاصطناعي', status: 'نقص ← فرصة', color: '#FF8C69' },
      { name: '3D Modeling', status: 'نقص متوسط', color: '#FFB400' },
      { name: 'برمجة ويب', status: 'وفرة كافية', color: '#0FA99A' },
    ],
    'ديسمبر 2024': [
      { name: 'Blockchain', status: 'نقص حاد ← فرصة', color: '#FF6B6B' },
      { name: 'أمن سيبراني', status: 'نقص ← فرصة', color: '#FF8C69' },
      { name: 'تصميم UI/UX', status: 'وفرة كافية', color: '#0FA99A' },
    ],
    'الربع الأول': [
      { name: 'Blockchain', status: 'نقص حاد ← فرصة', color: '#FF6B6B' },
      { name: 'الذكاء الاصطناعي', status: 'نقص حاد ← فرصة', color: '#FF6B6B' },
      { name: '3D Modeling', status: 'نقص متوسط', color: '#FFB400' },
      { name: 'أمن سيبراني', status: 'نقص متوسط', color: '#FFB400' },
      { name: 'برمجة ويب', status: 'وفرة كافية', color: '#0FA99A' },
    ],
  };

  readonly gaps = computed(() => this.gapsByPeriod[this.period()] ?? this.gapsByPeriod['يناير 2025']);
}
