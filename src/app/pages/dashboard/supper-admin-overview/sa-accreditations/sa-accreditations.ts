import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AccreditationApiService } from '../../../../core/services/accreditation-api.service';
import {
  AccreditationPagination,
  AccreditationSample,
  AccreditationStatus,
} from '../../../../core/models/accreditation.model';

type StatusFilter = 'all' | AccreditationStatus;

@Component({
  selector: 'app-sa-accreditations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-accreditations.html',
  styleUrl: './sa-accreditations.css',
})
export class SaAccreditations implements OnInit {
  private accreditationApi = inject(AccreditationApiService);

  samples = signal<AccreditationSample[]>([]);
  loading = signal(false);
  error = signal('');
  pagination = signal<AccreditationPagination | null>(null);
  currentPage = signal(1);
  pageSize = signal(10);

  activeFilter = signal<StatusFilter>('all');
  searchTerm = signal('');

  // Real per-status totals fetched with limit=1 requests (only the honest
  // pagination.total is used) — never invented "this month" aggregates,
  // since no such endpoint exists on the backend.
  statusCounts = signal<Record<StatusFilter, number>>({
    all: 0,
    PENDING_AI_AUDIT: 0,
    AI_VERIFIED: 0,
    REJECTED: 0,
    MANUAL_REVIEW: 0,
  });
  countsLoading = signal(false);

  selected = signal<AccreditationSample | null>(null);
  detailLoading = signal(false);
  detailError = signal('');
  showDetail = signal(false);

  showRejectForm = signal(false);
  rejectionReason = signal('');
  submittingAction = signal(false);
  actionError = signal('');
  actionSuccess = signal('');

  readonly filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'PENDING_AI_AUDIT', label: 'قيد الفحص الآلي' },
    { key: 'MANUAL_REVIEW', label: 'يتطلب مراجعة يدوية' },
    { key: 'AI_VERIFIED', label: 'معتمد' },
    { key: 'REJECTED', label: 'مرفوض' },
  ];

  readonly statusLabels: Record<AccreditationStatus, string> = {
    PENDING_AI_AUDIT: 'قيد الفحص الآلي',
    AI_VERIFIED: 'معتمد',
    REJECTED: 'مرفوض',
    MANUAL_REVIEW: 'يتطلب مراجعة يدوية',
  };

  readonly statusClasses: Record<AccreditationStatus, string> = {
    PENDING_AI_AUDIT: 'acc-st-pending',
    AI_VERIFIED: 'acc-st-verified',
    REJECTED: 'acc-st-rejected',
    MANUAL_REVIEW: 'acc-st-manual',
  };

  // Client-side refinement over the currently loaded page only — the
  // backend has no full-text search endpoint for accreditation samples,
  // so this narrows what's already fetched rather than simulating a
  // server-side search.
  filtered = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    if (!q) return this.samples();
    return this.samples().filter((s) => {
      const name = `${s.providerProfile?.user?.firstName ?? ''} ${s.providerProfile?.user?.lastName ?? ''}`.toLowerCase();
      const email = (s.providerProfile?.user?.email ?? '').toLowerCase();
      const title = s.title.toLowerCase();
      return name.includes(q) || email.includes(q) || title.includes(q);
    });
  });

  ngOnInit() {
    this.fetchSamples();
    this.fetchStatusCounts();
  }

  fetchSamples() {
    this.loading.set(true);
    this.error.set('');
    const filter = this.activeFilter();
    this.accreditationApi
      .getAdminSamples({
        status: filter === 'all' ? undefined : filter,
        page: this.currentPage(),
        limit: this.pageSize(),
      })
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.samples.set(res.data.items || []);
            this.pagination.set(res.data.pagination || null);
          } else {
            this.samples.set([]);
            this.pagination.set(null);
          }
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message || 'تعذر تحميل طلبات الاعتماد');
          this.loading.set(false);
        },
      });
  }

  fetchStatusCounts() {
    this.countsLoading.set(true);
    const statuses: AccreditationStatus[] = ['PENDING_AI_AUDIT', 'MANUAL_REVIEW', 'AI_VERIFIED', 'REJECTED'];
    forkJoin(
      statuses.map((status) =>
        this.accreditationApi.getAdminSamples({ status, page: 1, limit: 1 }).pipe(
          map((res) => res.data?.pagination?.total ?? 0),
          catchError(() => of(0)),
        ),
      ),
    ).subscribe((totals) => {
      const counts: Record<StatusFilter, number> = {
        all: 0,
        PENDING_AI_AUDIT: totals[0],
        MANUAL_REVIEW: totals[1],
        AI_VERIFIED: totals[2],
        REJECTED: totals[3],
      };
      counts.all = totals.reduce((a, b) => a + b, 0);
      this.statusCounts.set(counts);
      this.countsLoading.set(false);
    });
  }

  setFilter(filter: StatusFilter) {
    this.activeFilter.set(filter);
    this.currentPage.set(1);
    this.fetchSamples();
  }

  onSearch(value: string) {
    this.searchTerm.set(value);
  }

  nextPage() {
    const p = this.pagination();
    if (p && this.currentPage() < p.totalPages) {
      this.currentPage.update((v) => v + 1);
      this.fetchSamples();
    }
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update((v) => v - 1);
      this.fetchSamples();
    }
  }

  openDetail(sample: AccreditationSample) {
    this.showDetail.set(true);
    this.detailError.set('');
    this.actionError.set('');
    this.actionSuccess.set('');
    this.showRejectForm.set(false);
    this.selected.set(sample);
    this.detailLoading.set(true);
    this.accreditationApi.getAdminSample(sample.id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.selected.set(res.data);
        }
        this.detailLoading.set(false);
      },
      error: (err) => {
        this.detailError.set(err?.error?.message || 'تعذر تحميل تفاصيل نموذج الاعتماد');
        this.detailLoading.set(false);
      },
    });
  }

  closeDetail() {
    this.showDetail.set(false);
    this.selected.set(null);
    this.detailError.set('');
    this.cancelRejectForm();
  }

  // AI_VERIFIED on the sample itself now only ever means "AI recommends
  // approval, pending final confirmation" — the real "already granted"
  // condition is whether the linked ProviderSpecialty has actually been
  // approved (by a prior explicit admin action), not the sample's own label.
  canApprove(sample: AccreditationSample): boolean {
    return sample.providerSpecialty?.status !== 'APPROVED';
  }

  canReject(status: AccreditationStatus): boolean {
    return status !== 'REJECTED';
  }

  submitApprove() {
    const sample = this.selected();
    if (!sample || this.submittingAction()) return;
    this.actionError.set('');
    this.submittingAction.set(true);
    this.accreditationApi.approveSample(sample.id).subscribe({
      next: (res) => {
        this.submittingAction.set(false);
        if (res.success) {
          this.actionSuccess.set('تم اعتماد نموذج الاعتماد بنجاح');
          if (res.data) this.selected.update((cur) => (cur ? { ...cur, ...res.data } : cur));
          this.fetchSamples();
          this.fetchStatusCounts();
        } else {
          this.actionError.set(res.message || 'تعذر اعتماد النموذج، حاول مرة أخرى');
        }
      },
      error: (err) => {
        this.submittingAction.set(false);
        this.actionError.set(err?.error?.message || 'تعذر اعتماد النموذج، حاول مرة أخرى');
      },
    });
  }

  openRejectForm() {
    this.rejectionReason.set('');
    this.actionError.set('');
    this.actionSuccess.set('');
    this.showRejectForm.set(true);
  }

  cancelRejectForm() {
    this.showRejectForm.set(false);
    this.rejectionReason.set('');
    this.actionError.set('');
  }

  submitReject() {
    const sample = this.selected();
    if (!sample || this.submittingAction()) return;
    const reason = this.rejectionReason().trim();
    if (reason.length < 2) {
      this.actionError.set('يرجى كتابة سبب الرفض (حرفان على الأقل)');
      return;
    }
    this.actionError.set('');
    this.submittingAction.set(true);
    this.accreditationApi.rejectSample(sample.id, { rejectionReason: reason }).subscribe({
      next: (res) => {
        this.submittingAction.set(false);
        if (res.success) {
          this.actionSuccess.set('تم رفض نموذج الاعتماد');
          this.showRejectForm.set(false);
          this.rejectionReason.set('');
          if (res.data) this.selected.update((cur) => (cur ? { ...cur, ...res.data } : cur));
          this.fetchSamples();
          this.fetchStatusCounts();
        } else {
          this.actionError.set(res.message || 'تعذر رفض النموذج، حاول مرة أخرى');
        }
      },
      error: (err) => {
        this.submittingAction.set(false);
        this.actionError.set(err?.error?.message || 'تعذر رفض النموذج، حاول مرة أخرى');
      },
    });
  }

  providerName(sample: AccreditationSample): string {
    const u = sample.providerProfile?.user;
    if (!u) return '—';
    const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
    return name || '—';
  }

  providerInitial(sample: AccreditationSample): string {
    const name = this.providerName(sample);
    return name !== '—' ? name.charAt(0) : '؟';
  }

  specialtyName(sample: AccreditationSample): string {
    return sample.providerSpecialty?.specialty?.nameAr || sample.providerSpecialty?.specialty?.name || '—';
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

  shortId(id: string): string {
    return id.length > 8 ? id.slice(0, 8) + '…' : id;
  }
}
