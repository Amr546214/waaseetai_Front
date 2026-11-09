import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { mapHttpError } from '../../../../core/forms/http-error';
import { DisputeApiService } from '../../../../core/services/dispute-api.service';
import { Dispute, DisputeStatus, DisputePagination } from '../../../../core/models/dispute.model';

type StatusFilter = 'all' | 'followUp' | DisputeStatus;

@Component({
  selector: 'app-sa-disputes',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-disputes.html',
  styleUrl: './sa-disputes.css',
})
export class SaDisputes implements OnInit {
  private disputeApi = inject(DisputeApiService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private listRequest?: Subscription;
  readonly followUpCount = signal<number | null>(null);

  disputes = signal<Dispute[]>([]);
  loading = signal(false);
  error = signal('');
  activeFilter = signal<StatusFilter>('all');
  currentPage = signal(1);
  pageSize = signal(10);
  pagination = signal<DisputePagination | null>(null);
  counts = signal<Partial<Record<DisputeStatus, number>>>({});

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
    { key: 'followUp', label: 'تحتاج متابعة' },
    { key: 'OPEN', label: 'مفتوح' },
    { key: 'UNDER_REVIEW', label: 'قيد المراجعة' },
    { key: 'RESOLVED', label: 'تم الحل' },
    { key: 'REJECTED', label: 'مرفوض' },
  ];

  ngOnInit() {
    // The queue state lives in the URL, so coming back from a case (or a refresh) lands on the same filter and page.
    const q = this.route?.snapshot?.queryParamMap;
    const filter = q?.get('filter');
    if (this.filters.some(f => f.key === filter)) this.activeFilter.set(filter as StatusFilter);
    else if (q?.get('followUp') === 'true') this.activeFilter.set('followUp');
    const page = Number(q?.get('page'));
    if (Number.isSafeInteger(page) && page > 0 && page <= 100_000) this.currentPage.set(page);
    this.fetchDisputes();
  }

  private syncUrl() {
    const f = this.activeFilter();
    void this.router.navigate([], { replaceUrl: true, queryParams: {
      filter: f === 'all' ? null : f, followUp: null, page: this.currentPage() === 1 ? null : this.currentPage(),
    } });
  }

  fetchDisputes() {
    this.syncUrl();
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    const filter = this.activeFilter();
    this.listRequest = this.disputeApi.getAdminDisputes({
      status: filter === 'all' || filter === 'followUp' ? undefined : filter,
      ...(filter === 'followUp' ? { followUp: true } : {}),
      page: this.currentPage(),
      limit: this.pageSize(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.disputes.set(res.data.items || []);
          this.pagination.set(res.data.pagination || null);
          this.counts.set(res.data.counts ?? {});
          this.followUpCount.set(res.data.followUpCount ?? null);
        } else {
          this.disputes.set([]);
          this.pagination.set(null);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(mapHttpError(err, { fallback: 'تعذر تحميل النزاعات' }).message);
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

  countFor(key: StatusFilter): number | null {
    if (key === 'followUp') return this.followUpCount();
    const c = this.counts();
    if (key === 'all') {
      const vals = Object.values(c);
      return vals.length ? vals.reduce<number>((a, b) => a + (b ?? 0), 0) : null;
    }
    return c[key] ?? null;
  }

  fullName(u?: { firstName?: string; lastName?: string } | null): string {
    return [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || '—';
  }

  subjectTitle(d: Dispute): string {
    return d.request?.title ?? d.project?.title ?? (d.requestId ? this.shortId(d.requestId) : '—');
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
