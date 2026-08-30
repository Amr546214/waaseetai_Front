import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarketerOverviewService, MarketerSummary } from '../../../../core/services/marketer-overview.service';

export interface ReferralItem {
  id: string;
  name: string;
  service: string;
  channel: string;
  date: string;
  status: 'qualified' | 'pending' | 'cancelled';
  statusLabel: string;
  commission: string;
}

@Component({
  selector: 'app-referrals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './referrals.html',
  styleUrl: './referrals.css',
})
export class Referrals implements OnInit {
  private service = inject(MarketerOverviewService);

  summary = signal<MarketerSummary | null>(null);
  isLoading = signal(true);
  
  filterStatus = signal<string>('all');
  searchQuery = signal<string>('');
  selectedReferral = signal<ReferralItem | null>(null);

  // Referral list data
  referrals = signal<ReferralItem[]>([
    { id: '1', name: 'سارة الزهراني', service: 'طلب خدمة', channel: 'تيك توك', date: '2026-06-28', status: 'qualified', statusLabel: 'أول مشروع مؤهل', commission: '+120 ريال' },
    { id: '2', name: 'فهد العتيبي', service: 'اشتراك باقة', channel: 'إكس', date: '2026-06-20', status: 'pending', statusLabel: 'بانتظار الاكتمال', commission: '80 ريال معلقة' },
    { id: '3', name: 'نورة القحطاني', service: 'طلب خدمة', channel: 'إنستقرام', date: '2026-06-15', status: 'qualified', statusLabel: 'أول مشروع مؤهل', commission: '+150 ريال' },
    { id: '4', name: 'محمد الشمري', service: 'طلب خدمة', channel: 'تيك توك', date: '2026-06-10', status: 'qualified', statusLabel: 'أول مشروع مؤهل', commission: '+200 ريال' },
    { id: '5', name: 'لمى الدوسري', service: 'تسجيل فقط', channel: 'إكس', date: '2026-05-30', status: 'cancelled', statusLabel: 'ملغاة', commission: 'لا عمولة' }
  ]);

  filteredReferrals = computed(() => {
    const status = this.filterStatus();
    const query = this.searchQuery().trim().toLowerCase();
    
    return this.referrals().filter(ref => {
      const matchesStatus = status === 'all' || ref.status === status;
      const matchesQuery = !query || ref.name.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    this.service.getSummary().subscribe({
      next: (res) => {
        if (res.success) {
          this.summary.set(res.data);
        }
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  setFilter(status: string) {
    this.filterStatus.set(status);
  }

  openRefModal(ref: ReferralItem) {
    this.selectedReferral.set(ref);
  }

  closeRefModal() {
    this.selectedReferral.set(null);
  }
}
