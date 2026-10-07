import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { SaBrokerKycRequests } from './kyc-requests/sa-broker-kyc-requests';
import { AdminBrokerApiService } from '../../../../core/services/admin-broker-api.service';
import {
  AdminBrokerListItem,
  AdminBrokerPagination,
  BrokerUserStatus,
} from '../../../../core/models/admin-broker.model';

type StatusFilter = 'all' | BrokerUserStatus;

// Implementation Batch 3, Part B. Every field/KPI below is real
// (AffiliateProfile/Referral/CommissionLog/AffiliateChannelMetric via
// GET /api/admin/brokers). The previous mock's fictional "15-level MLM
// commission structure", per-broker aiFlag/aiNotes, and hardcoded top-line
// KPIs (8,420 total referrals / 84,200 USD) have all been removed — none
// of that has a real backend source. The three action buttons
// (suspendBroker/freezeCommissions/sendForWithdrawal) were also removed:
// none had any backend behind them, and no new mutation was authorized
// for this batch.

@Component({
  selector: 'app-sa-brokers',
  standalone: true,
  imports: [CommonModule, RouterLink, SaBrokerKycRequests],
  templateUrl: './sa-brokers.html',
  styleUrl: './sa-brokers.css',
})
export class SaBrokers implements OnInit {
  private brokerApi = inject(AdminBrokerApiService);

  brokers = signal<AdminBrokerListItem[]>([]);
  loading = signal(false);
  error = signal('');
  pagination = signal<AdminBrokerPagination | null>(null);
  currentPage = signal(1);
  pageSize = signal(20);

  activeFilter = signal<StatusFilter>('all');
  searchTerm = signal('');

  statusCounts = signal<Record<StatusFilter, number>>({
    all: 0,
    ACTIVE: 0,
    SUSPENDED: 0,
    PENDING_VERIFICATION: 0,
    SUSPENDED_REVIEW: 0,
  });
  countsLoading = signal(false);

  readonly filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'ACTIVE', label: 'نشط' },
    { key: 'PENDING_VERIFICATION', label: 'قيد التحقق' },
    { key: 'SUSPENDED', label: 'موقوف' },
    { key: 'SUSPENDED_REVIEW', label: 'قيد المراجعة' },
  ];

  readonly statusLabels: Record<BrokerUserStatus, string> = {
    ACTIVE: 'نشط',
    SUSPENDED: 'موقوف',
    PENDING_VERIFICATION: 'قيد التحقق',
    SUSPENDED_REVIEW: 'قيد المراجعة',
  };

  readonly statusClasses: Record<BrokerUserStatus, string> = {
    ACTIVE: 'bk-st-active',
    SUSPENDED: 'bk-st-suspended',
    PENDING_VERIFICATION: 'bk-st-pending',
    SUSPENDED_REVIEW: 'bk-st-review',
  };

  ngOnInit() {
    this.fetchBrokers();
    this.fetchStatusCounts();
  }

  fetchBrokers() {
    this.loading.set(true);
    this.error.set('');
    const filter = this.activeFilter();
    this.brokerApi
      .getBrokers({
        status: filter === 'all' ? undefined : filter,
        page: this.currentPage(),
        limit: this.pageSize(),
        search: this.searchTerm().trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.brokers.set(res.data.items || []);
            this.pagination.set(res.data.pagination || null);
          } else {
            this.brokers.set([]);
            this.pagination.set(null);
          }
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message || 'تعذر تحميل قائمة الوسطاء');
          this.loading.set(false);
        },
      });
  }

  fetchStatusCounts() {
    this.countsLoading.set(true);
    const statuses: BrokerUserStatus[] = ['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'SUSPENDED_REVIEW'];
    forkJoin(
      statuses.map((status) =>
        this.brokerApi.getBrokers({ status, page: 1, limit: 1 }).pipe(
          map((res) => res.data?.pagination?.total ?? 0),
          catchError(() => of(0)),
        ),
      ),
    ).subscribe((totals) => {
      const counts: Record<StatusFilter, number> = {
        all: 0,
        ACTIVE: totals[0],
        SUSPENDED: totals[1],
        PENDING_VERIFICATION: totals[2],
        SUSPENDED_REVIEW: totals[3],
      };
      counts.all = totals.reduce((a, b) => a + b, 0);
      this.statusCounts.set(counts);
      this.countsLoading.set(false);
    });
  }

  setFilter(filter: StatusFilter) {
    this.activeFilter.set(filter);
    this.currentPage.set(1);
    this.fetchBrokers();
  }

  onSearch(value: string) {
    this.searchTerm.set(value);
    this.currentPage.set(1);
    this.fetchBrokers();
  }

  nextPage() {
    const p = this.pagination();
    if (p && this.currentPage() < p.totalPages) {
      this.currentPage.update((v) => v + 1);
      this.fetchBrokers();
    }
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update((v) => v - 1);
      this.fetchBrokers();
    }
  }

  initial(name: string | null): string {
    return name?.trim() ? name.trim().charAt(0) : '؟';
  }
}
