import { Component, signal } from '@angular/core';
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

  readonly kpis = [
    { value: '6,010', label: 'مقدمو خدمة نشطون', color: '#2BD4C7' },
    { value: '4.3★', label: 'متوسط التقييم', color: '#0FA99A' },
    { value: '299M', label: 'إجمالي الإيرادات (ر.س)', color: '#A56BE0' },
    { value: '85%', label: 'معدل إتمام المشاريع', color: '#FFB400' },
  ];

  readonly topEarners: TopEarner[] = [
    { rank: 1, rankColor: '#FFB400', initial: 'ن', avatarGradient: 'linear-gradient(135deg,#A56BE0,#5DA0FF)', name: 'شركة الرياض للتصميم', meta: 'مقدم شركة · 52 مشروع · 4.8★', barPct: 100, revenue: '210K', revenueColor: '#2BD4C7' },
    { rank: 2, rankColor: '#6B7699', initial: 'ن', avatarGradient: 'linear-gradient(135deg,#A56BE0,#5DA0FF)', name: 'نورة السهلي', meta: 'مقدم فرد · Platinum · 4.9★', barPct: 59, revenue: '124K', revenueColor: '#5DA0FF' },
    { rank: 3, rankColor: '#6B7699', initial: 'أ', avatarGradient: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', name: 'أحمد الزهراني', meta: 'مقدم فرد · Platinum · 4.7★', barPct: 28, revenue: '58K', revenueColor: '#A8B2D1' },
    { rank: 4, rankColor: '#6B7699', initial: 'س', avatarGradient: 'linear-gradient(135deg,#FFB400,#0FA99A)', name: 'سارة القحطاني', meta: 'مقدم فرد · Gold · 4.9★', barPct: 15, revenue: '32K', revenueColor: '#A8B2D1' },
  ];

  readonly atRisk: AtRiskProvider[] = [
    { name: 'عبدالرحمن الدوسري', meta: 'تقييم انخفض من 4.2 → 3.8 · 2 بلاغات هذا الشهر · في خطر خسارة Silver', color: '#FF8C69', bg: 'rgba(255,140,105,.05)', border: 'rgba(255,140,105,.16)' },
    { name: 'ريم الحربي', meta: 'عدم نشاط 21 يوم · 3 مشاريع معلقة · تحذير', color: '#FFB400', bg: 'rgba(255,180,0,.04)', border: 'rgba(255,180,0,.14)' },
  ];

  readonly upgradeCandidates: UpgradeCandidate[] = [
    { name: 'محمد الحربي — Gold → Platinum', meta: '28 مشروع · 4.6★ · يحتاج مشروعاً واحداً فقط' },
    { name: 'هند العتيبي — Bronze → Silver', meta: '15 مشروع · 4.4★ · تستوفي المعايير' },
  ];

  readonly gaps: SpecialtyGap[] = [
    { name: 'Blockchain', status: 'نقص حاد ← فرصة', color: '#FF6B6B' },
    { name: 'الذكاء الاصطناعي', status: 'نقص ← فرصة', color: '#FF8C69' },
    { name: '3D Modeling', status: 'نقص متوسط', color: '#FFB400' },
    { name: 'برمجة ويب', status: 'وفرة كافية', color: '#0FA99A' },
  ];
}
