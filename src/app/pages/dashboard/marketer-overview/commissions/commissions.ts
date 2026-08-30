import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarketerOverviewService, MarketerSummary, CommissionLog } from '../../../../core/services/marketer-overview.service';

@Component({
  selector: 'app-commissions',
  standalone: true,
  imports: [CommonModule],
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
