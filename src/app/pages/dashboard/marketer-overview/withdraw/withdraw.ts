import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarketerOverviewService, MarketerSummary } from '../../../../core/services/marketer-overview.service';

interface WithdrawalLog {
  id: string;
  time: string;
  amount: number;
  account: string;
  status: 'COMPLETED' | 'PENDING';
}

@Component({
  selector: 'app-withdraw',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './withdraw.html',
  styleUrl: './withdraw.css',
})
export class Withdraw implements OnInit {
  private service = inject(MarketerOverviewService);

  summary = signal<MarketerSummary | null>(null);
  isLoading = signal(true);
  
  // Mock data for withdrawals since the backend endpoint is not yet implemented
  withdrawals = signal<WithdrawalLog[]>([
    { id: '1', time: '2026-06-01T10:00:00Z', amount: 2000, account: 'بنك الراجحي', status: 'COMPLETED' },
    { id: '2', time: '2026-05-01T10:00:00Z', amount: 1820, account: 'بنك الراجحي', status: 'COMPLETED' },
    { id: '3', time: '2026-04-01T10:00:00Z', amount: 2000, account: 'بنك الأهلي', status: 'COMPLETED' }
  ]);

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
}
