import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface CommissionTier {
  code: string;
  name: string;
  rate: string;
  minReferrals: number;
  minSales: string;
  brokerCount: number;
  totalPaid: string;
  color: string;
}

@Component({
  selector: 'app-sa-commissions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-commissions.html',
  styleUrl: './sa-commissions.css',
})
export class SaCommissions {
  toast = signal<string | null>(null);

  readonly tiers: CommissionTier[] = [
    { code: 'M1', name: 'مبتدئ', rate: '3%', minReferrals: 1, minSales: '1k', brokerCount: 142, totalPaid: '84k', color: '#6B7699' },
    { code: 'M2', name: 'ناشئ', rate: '4%', minReferrals: 5, minSales: '5k', brokerCount: 198, totalPaid: '142k', color: '#6B7699' },
    { code: 'M3', name: 'نشيط', rate: '5%', minReferrals: 10, minSales: '10k', brokerCount: 221, totalPaid: '194k', color: '#6B7699' },
    { code: 'M4', name: 'متمرس', rate: '6%', minReferrals: 20, minSales: '20k', brokerCount: 204, totalPaid: '228k', color: '#6B7699' },
    { code: 'M5', name: 'فضي', rate: '7%', minReferrals: 30, minSales: '30k', brokerCount: 389, totalPaid: '342k', color: '#A8B2D1' },
    { code: 'M6', name: 'ذهبي', rate: '8%', minReferrals: 50, minSales: '50k', brokerCount: 98, totalPaid: '156k', color: '#FFB400' },
    { code: 'M7', name: 'بلاتيني', rate: '9%', minReferrals: 75, minSales: '75k', brokerCount: 67, totalPaid: '189k', color: '#FFB400' },
    { code: 'M8', name: 'ألماسي', rate: '10%', minReferrals: 100, minSales: '100k', brokerCount: 44, totalPaid: '176k', color: '#2BD4C7' },
    { code: 'M9', name: 'ملكي', rate: '11%', minReferrals: 150, minSales: '150k', brokerCount: 32, totalPaid: '164k', color: '#2BD4C7' },
    { code: 'M10', name: 'أسطوري', rate: '12%', minReferrals: 200, minSales: '200k', brokerCount: 21, totalPaid: '142k', color: '#2BD4C7' },
    { code: 'M11', name: 'إمبراطور', rate: '13%', minReferrals: 300, minSales: '300k', brokerCount: 9, totalPaid: '98k', color: '#5DA0FF' },
    { code: 'M12', name: 'سيد الإحالة', rate: '14%', minReferrals: 400, minSales: '400k', brokerCount: 6, totalPaid: '94k', color: '#5DA0FF' },
    { code: 'M13', name: 'محترف', rate: '15%', minReferrals: 500, minSales: '500k', brokerCount: 5, totalPaid: '84k', color: '#5DA0FF' },
    { code: 'M14', name: 'نخبة', rate: '16%', minReferrals: 750, minSales: '750k', brokerCount: 4, totalPaid: '72k', color: '#59C1F5' },
    { code: 'M15', name: 'أفضل الوسطاء', rate: '18%', minReferrals: 1000, minSales: '1M', brokerCount: 12, totalPaid: '198k', color: '#FF8C69' },
  ];

  showToast(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(null), 2500);
  }

  exportStructure() {
    this.showToast('تم تصدير هيكل العمولات');
  }

  editStructure() {
    this.showToast('تعديل هيكل العمولات — تجهيز مستقبلي غير مفعّل في V1');
  }

  editTier(tier: CommissionTier) {
    this.showToast(`تعديل المستوى ${tier.code} — تجهيز مستقبلي غير مفعّل في V1`);
  }
}
