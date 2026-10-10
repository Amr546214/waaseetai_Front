import { MarketerLevelTagComponent } from '../../../../shared/levels/marketer-level-tag.component';
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarketerOverviewService, MarketerSummary, CommissionLog } from '../../../../core/services/marketer-overview.service';

@Component({
  selector: 'app-commissions',
  standalone: true,
  imports: [MarketerLevelTagComponent, CommonModule],
  templateUrl: './commissions.html',
  styleUrl: './commissions.css',
})
export class Commissions implements OnInit {
  private service = inject(MarketerOverviewService);

  summary = signal<MarketerSummary | null>(null);
  commissions = signal<CommissionLog[]>([]);
  isLoading = signal(true);
  
  filterStatus = signal<string>('all');

  filteredCommissions = computed(() => {
    const status = this.filterStatus();
    const list = this.commissions();
    if (status === 'all') return list;
    return list.filter(log => log.status === status);
  });

  // "محجوزة" — commissions still pending confirmation, not yet released to the
  // affiliate's withdrawable balance.
  heldAmount = computed(() => this.commissions()
    .filter(log => log.status === 'PENDING')
    .reduce((sum, log) => sum + (log.amount || 0), 0));

  // "منسحبة" — commissions already paid out/withdrawn.
  withdrawnAmount = computed(() => this.commissions()
    .filter(log => log.status === 'PAID')
    .reduce((sum, log) => sum + (log.amount || 0), 0));

  private amountInMonth(date: Date): number {
    return this.commissions()
      .filter(log => {
        const d = new Date(log.time);
        return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth();
      })
      .reduce((sum, log) => sum + (log.amount || 0), 0);
  }

  // "هذا الشهر" — real month-scoped total, computed from the loaded commission
  // log rather than reusing the all-time total.
  thisMonthAmount = computed(() => this.amountInMonth(new Date()));

  private lastMonthAmount = computed(() => {
    const now = new Date();
    return this.amountInMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  });

  // Real month-over-month delta instead of a hardcoded "+0%".
  monthDeltaPercentage = computed(() => {
    const last = this.lastMonthAmount();
    const current = this.thisMonthAmount();
    if (last === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - last) / last) * 100);
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
      }
    });

    // Fetch up to 100 recent commissions for the log page
    this.service.getRecentCommissions(100).subscribe({
      next: (res) => {
        if (res.success) {
          this.commissions.set(res.data);
        }
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  setFilter(status: string) {
    this.filterStatus.set(status);
  }
}
