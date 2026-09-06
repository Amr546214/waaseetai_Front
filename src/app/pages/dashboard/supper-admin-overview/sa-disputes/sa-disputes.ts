import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DisputeApiService } from '../../../../core/services/dispute-api.service';
import {
  Dispute,
  DisputeStatus,
  AdminDisputesQuery,
  ResolveDisputePayload,
} from '../../../../core/models/dispute.model';

@Component({
  selector: 'app-sa-disputes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-disputes.html',
  styleUrls: ['./sa-disputes.css']
})
export class SaDisputes implements OnInit {
  private disputeApi = inject(DisputeApiService);

  disputes = signal<Dispute[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  currentPage = signal<number>(1);
  totalPages = signal<number>(1);
  total = signal<number>(0);
  readonly limit = 10;

  statusFilter = signal<DisputeStatus | 'all'>('all');

  readonly statusOptions: { value: DisputeStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'الكل' },
    { value: 'OPEN', label: 'مفتوح' },
    { value: 'UNDER_REVIEW', label: 'قيد المراجعة' },
    { value: 'RESOLVED', label: 'تم الحل' },
    { value: 'REJECTED', label: 'مرفوض' },
  ];

  // Detail modal
  selectedDispute = signal<Dispute | null>(null);
  detailLoading = signal<boolean>(false);
  detailError = signal<string | null>(null);
  showDetailModal = signal<boolean>(false);

  // Resolve/reject modal
  showResolveModal = signal<boolean>(false);
  resolveAction = signal<'resolve' | 'reject'>('resolve');
  resolutionText = signal<string>('');
  resolutionNoteText = signal<string>('');
  resolving = signal<boolean>(false);

  ngOnInit() {
    this.loadDisputes();
  }

  loadDisputes() {
    this.loading.set(true);
    this.error.set(null);

    const query: AdminDisputesQuery = {
      page: this.currentPage(),
      limit: this.limit,
    };
    if (this.statusFilter() !== 'all') {
      query.status = this.statusFilter() as DisputeStatus;
    }

    this.disputeApi.getAdminDisputes(query).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res?.data?.items) {
          this.disputes.set(res.data.items);
          this.total.set(res.data.pagination?.total ?? 0);
          this.totalPages.set(res.data.pagination?.totalPages ?? 1);
        } else {
          this.disputes.set([]);
          this.total.set(0);
          this.totalPages.set(1);
        }
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 204) {
          this.disputes.set([]);
          this.total.set(0);
          this.totalPages.set(1);
          this.error.set(null);
        } else {
          this.error.set(err?.error?.message || err?.message || 'تعذر تحميل النزاعات');
        }
      },
    });
  }

  onStatusFilterChange(status: DisputeStatus | 'all') {
    this.statusFilter.set(status);
    this.currentPage.set(1);
    this.loadDisputes();
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadDisputes();
  }

  viewDetail(id: string) {
    this.showDetailModal.set(true);
    this.detailLoading.set(true);
    this.detailError.set(null);
    this.selectedDispute.set(null);

    this.disputeApi.getAdminDispute(id).subscribe({
      next: (res) => {
        this.detailLoading.set(false);
        if (res?.data) {
          this.selectedDispute.set(res.data);
        } else {
          this.detailError.set('لم يتم العثور على النزاع');
        }
      },
      error: (err) => {
        this.detailLoading.set(false);
        this.detailError.set(err?.error?.message || err?.message || 'تعذر تحميل تفاصيل النزاع');
      },
    });
  }

  closeDetailModal() {
    this.showDetailModal.set(false);
    this.selectedDispute.set(null);
    this.detailError.set(null);
  }

  openResolveModal(action: 'resolve' | 'reject') {
    this.resolveAction.set(action);
    this.resolutionText.set('');
    this.resolutionNoteText.set('');
    this.showResolveModal.set(true);
  }

  closeResolveModal() {
    this.showResolveModal.set(false);
    this.resolutionText.set('');
    this.resolutionNoteText.set('');
  }

  confirmResolve() {
    const dispute = this.selectedDispute();
    if (!dispute) return;
    if (!this.resolutionText().trim()) return;

    this.resolving.set(true);

    const payload: ResolveDisputePayload = {
      action: this.resolveAction(),
      resolution: this.resolutionText().trim(),
    };
    if (this.resolutionNoteText().trim()) {
      payload.resolutionNote = this.resolutionNoteText().trim();
    }

    this.disputeApi.resolveAdminDispute(dispute.id, payload).subscribe({
      next: (res) => {
        this.resolving.set(false);
        this.showResolveModal.set(false);
        if (res?.data) {
          this.selectedDispute.set(res.data);
        }
        this.loadDisputes();
      },
      error: (err) => {
        this.resolving.set(false);
        this.detailError.set(err?.error?.message || err?.message || 'تعذر تنفيذ الإجراء');
      },
    });
  }

  getStatusLabel(status: DisputeStatus): string {
    const map: Record<DisputeStatus, string> = {
      OPEN: 'مفتوح',
      UNDER_REVIEW: 'قيد المراجعة',
      RESOLVED: 'تم الحل',
      REJECTED: 'مرفوض',
    };
    return map[status] || status;
  }

  getStatusClass(status: DisputeStatus): string {
    const map: Record<DisputeStatus, string> = {
      OPEN: 'st-open',
      UNDER_REVIEW: 'st-review',
      RESOLVED: 'st-resolved',
      REJECTED: 'st-rejected',
    };
    return map[status] || 'st-open';
  }

  getShortId(id: string): string {
    return id?.length > 8 ? id.substring(0, 8) : id;
  }

  formatDate(date?: string | null): string {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return date;
    }
  }

  getEvidenceCount(evidence?: string[]): number {
    return evidence?.length ?? 0;
  }

  canResolve(status: DisputeStatus): boolean {
    return status !== 'RESOLVED' && status !== 'REJECTED';
  }

  getPagesArray(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages(); i++) {
      pages.push(i);
    }
    return pages;
  }
}
