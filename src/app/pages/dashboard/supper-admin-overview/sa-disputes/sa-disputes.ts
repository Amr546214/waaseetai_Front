import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DisputeApiService } from '../../../../core/services/dispute-api.service';
import { Dispute, DisputeStatus, DisputePagination, DisputeAction, ResolveDisputePayload, DisputeAiSummary } from '../../../../core/models/dispute.model';

type StatusFilter = 'all' | DisputeStatus;

@Component({
  selector: 'app-sa-disputes',
  standalone: true,
  imports: [CommonModule],
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

  selectedDispute = signal<Dispute | null>(null);
  detailLoading = signal(false);
  detailError = signal('');
  showDetail = signal(false);

  showResolveForm = signal(false);
  resolveAction = signal<DisputeAction | null>(null);
  resolutionText = signal('');
  resolutionNote = signal('');
  submittingResolve = signal(false);
  resolveError = signal('');
  resolveSuccess = signal('');

  // Advisory-only AI summary — entirely separate from the manual
  // resolve/reject state above. Never pre-fills resolutionText/resolutionNote.
  aiSummary = signal<DisputeAiSummary | null>(null);
  aiSummaryLoading = signal(false);
  aiSummaryError = signal('');

  readonly resolutionPresets = [
    'REFUND_CLIENT',
    'RELEASE_TO_PROVIDER',
    'PARTIAL_REFUND',
    'MUTUAL_CLOSE',
    'REJECTED_INSUFFICIENT_EVIDENCE',
  ];

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

  openDetail(dispute: Dispute) {
    this.showDetail.set(true);
    this.detailError.set('');
    this.selectedDispute.set(dispute);
    this.detailLoading.set(true);
    this.aiSummary.set(null);
    this.aiSummaryError.set('');
    this.disputeApi.getAdminDispute(dispute.id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.selectedDispute.set(res.data);
        }
        this.detailLoading.set(false);
      },
      error: (err) => {
        this.detailError.set(err?.error?.message || 'تعذر تحميل تفاصيل النزاع');
        this.detailLoading.set(false);
      },
    });
  }

  closeDetail() {
    this.showDetail.set(false);
    this.selectedDispute.set(null);
    this.detailError.set('');
    this.aiSummary.set(null);
    this.aiSummaryError.set('');
    this.cancelResolveForm();
  }

  // Advisory-only — purely additive read. Never touches resolutionText/
  // resolutionNote/resolveAction, and never calls resolveAdminDispute.
  requestAiSummary() {
    const dispute = this.selectedDispute();
    if (!dispute || this.aiSummaryLoading()) return;
    this.aiSummaryError.set('');
    this.aiSummaryLoading.set(true);
    this.disputeApi.getDisputeAiSummary(dispute.id).subscribe({
      next: (res) => {
        this.aiSummaryLoading.set(false);
        if (res.success && res.data) {
          this.aiSummary.set(res.data);
        } else {
          this.aiSummaryError.set(res.message || 'تعذر إنشاء ملخص الذكاء الاصطناعي لهذا النزاع حالياً');
        }
      },
      error: (err) => {
        this.aiSummaryLoading.set(false);
        this.aiSummaryError.set(err?.error?.message || 'تعذر إنشاء ملخص الذكاء الاصطناعي لهذا النزاع حالياً');
      },
    });
  }

  openResolveForm(action: DisputeAction) {
    this.resolveAction.set(action);
    this.resolutionText.set('');
    this.resolutionNote.set('');
    this.resolveError.set('');
    this.resolveSuccess.set('');
    this.showResolveForm.set(true);
  }

  cancelResolveForm() {
    this.showResolveForm.set(false);
    this.resolveAction.set(null);
    this.resolutionText.set('');
    this.resolutionNote.set('');
    this.resolveError.set('');
  }

  selectPreset(preset: string) {
    this.resolutionText.set(preset);
  }

  submitResolve() {
    const dispute = this.selectedDispute();
    const action = this.resolveAction();
    if (!dispute || !action) return;
    if (this.submittingResolve()) return;

    const resolution = this.resolutionText().trim();
    if (!resolution) {
      this.resolveError.set('يرجى كتابة قرار النزاع');
      return;
    }

    this.resolveError.set('');
    this.submittingResolve.set(true);

    const payload: ResolveDisputePayload = {
      action,
      resolution,
    };
    const note = this.resolutionNote().trim();
    if (note) payload.resolutionNote = note;

    this.disputeApi.resolveAdminDispute(dispute.id, payload).subscribe({
      next: (res) => {
        this.submittingResolve.set(false);
        if (res.success) {
          this.resolveSuccess.set('تم تحديث حالة النزاع بنجاح');
          this.showResolveForm.set(false);
          this.resolveAction.set(null);
          this.resolutionText.set('');
          this.resolutionNote.set('');
          if (res.data) {
            this.selectedDispute.set(res.data);
          } else {
            this.disputeApi.getAdminDispute(dispute.id).subscribe({
              next: (detail) => {
                if (detail.success && detail.data) {
                  this.selectedDispute.set(detail.data);
                }
              },
              error: () => {},
            });
          }
          this.fetchDisputes();
        } else {
          this.resolveError.set(res.message || 'تعذر تحديث حالة النزاع، حاول مرة أخرى');
        }
      },
      error: (err) => {
        this.submittingResolve.set(false);
        this.resolveError.set(err?.error?.message || 'تعذر تحديث حالة النزاع، حاول مرة أخرى');
      },
    });
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

  canResolve(status: DisputeStatus): boolean {
    return status !== 'RESOLVED' && status !== 'REJECTED';
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
