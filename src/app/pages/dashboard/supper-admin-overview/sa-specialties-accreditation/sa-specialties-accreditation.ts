import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  FilterKey, SpecialtyDecision, SpecialtyReviewCounts, SpecialtyReviewItem, STATUS_CLASS, STATUS_TEXT, initialOf,
} from './sa-specialties-accreditation.data';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { SaSpecialtyReviewService } from './sa-specialty-review.service';
import { SaSpecialtyDecisionModal } from './sa-specialty-decision-modal';

@Component({
  selector: 'app-sa-specialties-accreditation',
  standalone: true,
  imports: [CommonModule, RouterLink, SaSpecialtyDecisionModal],
  templateUrl: './sa-specialties-accreditation.html',
  styleUrl: './sa-specialties-accreditation.css',
})
export class SaSpecialtiesAccreditation implements OnInit, OnDestroy {
  private api = inject(SaSpecialtyReviewService);
  private notify = inject(UiNotificationService);

  activeFilter = signal<FilterKey>('pending');
  searchTerm = signal('');
  page = signal(1);
  readonly limit = 10;

  items = signal<SpecialtyReviewItem[]>([]);
  counts = signal<SpecialtyReviewCounts>({ pending: 0, approved: 0, rejected: 0, all: 0 });
  totalPages = signal(1);
  total = signal(0);
  loading = signal(false);
  error = signal('');

  // Quick-action modal (same confirmation + required reason as the detail page).
  decisionTarget = signal<{ item: SpecialtyReviewItem; decision: SpecialtyDecision } | null>(null);
  deciding = signal(false);
  decisionError = signal('');

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'pending', label: 'بانتظار المراجعة' },
    { key: 'approved', label: 'مقبول' },
    { key: 'rejected', label: 'مرفوض' },
    { key: 'all', label: 'الكل' },
  ];

  readonly statusText = STATUS_TEXT;
  readonly statusClass = STATUS_CLASS;
  readonly initialOf = initialOf;

  /** Why the bulk auto-approval stays off (visible next to the button). */
  readonly bulkDisabledReason = 'الاعتماد قرار إداري فردي ويتطلب سببًا مكتوبًا لكل طلب';

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    this.load();
  }

  ngOnDestroy() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    const term = this.searchTerm().trim();
    this.api.list({ status: this.activeFilter(), search: term || undefined, page: this.page(), limit: this.limit }).subscribe({
      next: (res) => {
        this.loading.set(false);
        const d = res?.data;
        this.items.set(d?.items ?? []);
        if (d?.counts) this.counts.set(d.counts);
        this.totalPages.set(d?.pagination?.totalPages ?? 1);
        this.total.set(d?.pagination?.total ?? 0);
      },
      error: (err) => {
        this.loading.set(false);
        this.items.set([]);
        this.error.set(err?.error?.message || 'تعذر تحميل طلبات اعتماد التخصصات');
      },
    });
  }

  countFor(key: FilterKey): number {
    return this.counts()[key];
  }

  /** Requests already decided (accepted + rejected): a real count, not an average. */
  decidedTotal(): number {
    return this.counts().approved + this.counts().rejected;
  }

  setFilter(key: FilterKey) {
    this.activeFilter.set(key);
    this.page.set(1);
    this.load();
  }

  onSearch(value: string) {
    this.searchTerm.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.load(); }, 350);
  }

  goToPage(p: number) {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.load();
  }

  isPending(r: SpecialtyReviewItem): boolean {
    return r.status === 'UNDER_AI_REVIEW';
  }

  openDecision(item: SpecialtyReviewItem, decision: SpecialtyDecision) {
    if (!this.isPending(item)) return;
    this.decisionError.set('');
    this.decisionTarget.set({ item, decision });
  }

  closeDecision() {
    if (this.deciding()) return;
    this.decisionTarget.set(null);
    this.decisionError.set('');
  }

  decisionSummary(): string {
    const t = this.decisionTarget();
    return t ? `${t.item.provider.name || '—'} · ${t.item.specialty?.nameAr || '—'}` : '';
  }

  confirmDecision(reason: string) {
    const t = this.decisionTarget();
    if (!t || this.deciding()) return;
    this.deciding.set(true);
    this.decisionError.set('');
    this.api.decide(t.item.id, t.decision, reason).subscribe({
      next: () => {
        this.deciding.set(false);
        this.decisionTarget.set(null);
        this.notify.success(t.decision === 'APPROVED' ? 'تم قبول التخصص وإشعار مقدم الخدمة' : 'تم رفض التخصص وإشعار مقدم الخدمة بالسبب');
        this.load();
      },
      error: (err) => {
        this.deciding.set(false);
        this.decisionError.set(err?.error?.message || 'تعذر تنفيذ القرار');
        // 409 = already decided elsewhere: refresh so the stale row leaves the queue.
        if (err?.status === 409) this.load();
      },
    });
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  }
}
