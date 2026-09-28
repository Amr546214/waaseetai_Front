import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type BoostStatus = 'active' | 'expiring' | 'ended' | 'pending';
type TabKey = 'all' | 'active' | 'ended' | 'pending';

interface BoostCampaign {
  provider: string;
  specialty: string;
  dailyCost: number;
  impressions: number;
  clicks: number;
  ctr: number;
  endDate: string;
  status: BoostStatus;
}

@Component({
  selector: 'app-sa-boost',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sa-boost.html',
  styleUrl: './sa-boost.css',
})
export class SaBoost {
  activeTab = signal<TabKey>('all');
  bidCost = signal(50);
  bidDays = signal(7);

  readonly tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'active', label: 'نشطة' },
    { key: 'ended', label: 'منتهية' },
    { key: 'pending', label: 'معلقة الموافقة' },
  ];

  readonly statusLabels: Record<BoostStatus, string> = {
    active: 'نشطة',
    expiring: 'تنتهي قريباً',
    ended: 'منتهية',
    pending: 'معلقة الموافقة',
  };

  readonly statusColors: Record<BoostStatus, string> = {
    active: '#0FA99A',
    expiring: '#FFB400',
    ended: '#6B7699',
    pending: '#59C1F5',
  };

  readonly kpis = [
    { label: 'Boosts نشطة', value: '348', unit: 'حملة نشطة', sub: '+28 هذا الأسبوع', color: '#2BD4C7', subColor: '#0FA99A' },
    { label: 'إيراد Boost', value: '1.18M', unit: 'ريال — 2026', sub: '8% من الإيرادات', color: '#0FA99A', subColor: '#6B7699' },
    { label: 'متوسط CTR', value: '8.4%', unit: 'معدل النقر', sub: 'عام: 2.1%', color: '#FFB400', subColor: '#6B7699' },
    { label: 'متوسط ROI', value: '4.2x', unit: 'عائد الاستثمار', sub: 'أعلى من المعيار', color: '#5DA0FF', subColor: '#0FA99A' },
  ];

  readonly campaigns: BoostCampaign[] = [
    { provider: 'نورة السهلي', specialty: 'تصميم جرافيك', dailyCost: 45, impressions: 12480, clicks: 1048, ctr: 8.4, endDate: '31 يوليو', status: 'active' },
    { provider: 'محمد الزهراني', specialty: 'برمجة', dailyCost: 80, impressions: 8240, clicks: 742, ctr: 9.0, endDate: '15 أغسطس', status: 'active' },
    { provider: 'فاطمة العتيبي', specialty: 'محاسبة', dailyCost: 30, impressions: 4120, clicks: 288, ctr: 7.0, endDate: '20 يوليو', status: 'expiring' },
    { provider: 'علي الشمري', specialty: 'تسويق رقمي', dailyCost: 60, impressions: 6840, clicks: 616, ctr: 9.0, endDate: '30 أغسطس', status: 'active' },
    { provider: 'ريم القحطاني', specialty: 'ترجمة', dailyCost: 25, impressions: 3020, clicks: 190, ctr: 6.3, endDate: '2 يوليو', status: 'ended' },
    { provider: 'سلطان العنزي', specialty: 'استشارات قانونية', dailyCost: 90, impressions: 5460, clicks: 481, ctr: 8.8, endDate: '10 سبتمبر', status: 'pending' },
  ];

  filteredCampaigns = computed(() => {
    const tab = this.activeTab();
    if (tab === 'all') return this.campaigns;
    if (tab === 'active') return this.campaigns.filter((c) => c.status === 'active' || c.status === 'expiring');
    return this.campaigns.filter((c) => c.status === tab);
  });

  simResults = computed(() => {
    const cost = this.bidCost();
    const days = this.bidDays();
    const total = cost * days;
    const impressions = Math.round(cost * 180 + days * 120);
    const clicks = Math.round(impressions * 0.084);
    const leads = Math.round(clicks * 0.18);
    const roi = total > 0 ? Math.round((leads * 180 * 100) / total) : 0;

    let insight: string;
    if (cost < 20) {
      insight = 'تكلفة منخفضة — ظهور محدود، AI ينصح 30+ ر.س/يوم';
    } else if (cost > 100) {
      insight = 'تكلفة مرتفعة — تأكد من اكتمال الملف الشخصي قبل البدء';
    } else {
      insight = `نطاق مثالي — CTR 8.4% · عائد متوقع ${roi}%`;
    }

    return { total, impressions, clicks, leads, roi, insight };
  });

  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
  }
}
