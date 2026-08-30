import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../../../environments/environment';

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  category: string;
  amount: number;
  currency: 'SAR';
  title: string;
  description: string;
  projectId?: string;
  projectTitle?: string;
  stageId?: string | null;
  status: 'COMPLETED' | 'HELD' | 'PENDING';
  createdAt: string;
}

export interface WalletData {
  summary: {
    availableBalance: number;
    totalEarnings: number;
    escrowBalance: number;
    releasedThisMonth: number;
    releasedTransactionsCount: number;
    fundedProjectsCount: number;
    completedProjectsCount: number;
    currency: 'SAR';
  };
  transactions: WalletTransaction[];
  escrows: Array<{ id: string; projectId: string; projectTitle: string; total: number; released: number; held: number; status: string; updatedAt: string }>;
}

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './wallet.html',
  styleUrl: './wallet.css'
})
export class Wallet implements OnInit {
  private http = inject(HttpClient);
  data = signal<WalletData | null>(null);
  loading = signal(true);
  error = signal('');

  availableRatio = computed(() => {
    const d = this.data();
    if (!d) return 66;
    const avail = d.summary?.availableBalance || 0;
    const total = (d.summary?.availableBalance || 0) + (d.summary?.escrowBalance || 0);
    if (total <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round((avail / total) * 100)));
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.http.get<{ success: boolean; data: WalletData }>(`${environment.url_api}/provider/finance/wallet`).subscribe({
      next: response => {
        this.data.set(response.data);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err.error?.message || 'تعذر تحميل بيانات المحفظة');
        this.loading.set(false);
      }
    });
  }
}

