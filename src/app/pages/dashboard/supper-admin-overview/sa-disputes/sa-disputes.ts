import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DisputeApiService } from '../../../../core/services/dispute-api.service';
import { Dispute, DisputeStatus, DisputePagination } from '../../../../core/models/dispute.model';

type StatusFilter = 'all' | DisputeStatus;

@Component({
  selector: 'app-sa-disputes',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-disputes.html',
  styleUrl: './sa-disputes.css',
})
export class SaDisputes implements OnInit {
  private disputeApi = inject(DisputeApiService);

  disputes = signal<Dispute[]>([]);
  loading = signal(false);
  error = signal('');
  activeFilter = signal<StatusFilter>('all');
  currentPage = signal(1);
  pageSize = signal(10);
  pagination = signal<DisputePagination | null>(null);

  readonly statusLabels: Record<DisputeStatus, string> = {
    OPEN: 'مفتوح',
    UNDER_REVIEW: 'قيد المراجعة',
    RESOLVED: 'تم الحل',
    REJECTED: 'مرفوض',
  };

  readonly statusClasses: Record<DisputeStatus, string> = {
    OPEN: 'dp-st-open',
    UNDER_REVIEW: 'dp-st-review',
    RESOLVED: 'dp-st-resolved',
    REJECTED: 'dp-st-rejected',
  };

  readonly filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'OPEN', label: 'مفتوح' },
    { key: 'UNDER_REVIEW', label: 'قيد المراجعة' },
    { key: 'RESOLVED', label: 'تم الحل' },
    { key: 'REJECTED', label: 'مرفوض' },
  ];

  ngOnInit() {
    this.fetchDisputes();
  }

  fetchDisputes() {
    this.loading.set(true);
    this.error.set('');
    const filter = this.activeFilter();
    this.disputeApi.getAdminDisputes({
      status: filter === 'all' ? undefined : filter,
      page: this.currentPage(),
      limit: this.pageSize(),
    }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.disputes.set(res.data.items || []);
          this.pagination.set(res.data.pagination || null);
        } else {
          this.disputes.set([]);
          this.pagination.set(null);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'تعذر تحميل النزاعات');
        this.loading.set(false);
      },
    });
  }

  setFilter(filter: StatusFilter) {
    this.activeFilter.set(filter);
    this.currentPage.set(1);
    this.fetchDisputes();
  }

  nextPage() {
    const p = this.pagination();
    if (p && this.currentPage() < p.totalPages) {
      this.currentPage.update((v) => v + 1);
      this.fetchDisputes();
    }
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update((v) => v - 1);
      this.fetchDisputes();
    }
  }

  shortId(id: string): string {
    return id.length > 8 ? id.slice(0, 8) + '…' : id;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('ar-SA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }
}
