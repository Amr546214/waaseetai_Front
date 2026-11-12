import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WsSelectComponent } from '../../../../shared/forms/select.component';
import { AdminOpsApiService, AdminStaffMember } from '../../../../core/services/admin-ops-api.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { mapHttpError } from '../../../../core/forms/http-error';
import { DisputeApiService } from '../../../../core/services/dispute-api.service';
import { Dispute, DisputeStatus, DisputePagination } from '../../../../core/models/dispute.model';

type StatusFilter = 'all' | 'followUp' | DisputeStatus;

const SEARCH_MIN = 4;
const MAX_RANGE_DAYS = 366;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The number shown on a card is `#3f6fa186…`: that form is accepted back. Returns null when it is not a usable search. */
export function normalizeDisputeSearch(raw: string | null | undefined): string | null {
  const q = (raw ?? '').trim().replace(/^#/, '').replace(/(…|\.\.\.)$/, '').trim().toLowerCase();
  return q.length >= SEARCH_MIN && q.length <= 36 && /^[0-9a-f-]+$/.test(q) ? q : null;
}

/** `YYYY-MM-DD` that is a real calendar day, else null (a bad URL value is ignored, never sent). */
export function validDay(raw: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw ?? '');
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? (raw as string) : null;
}

function rangeProblem(from: string, to: string): string {
  if (!from || !to) return '';
  if (from > to) return 'تاريخ البداية يجب ألا يكون بعد تاريخ النهاية';
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > MAX_RANGE_DAYS) return `الفترة الزمنية طويلة: الحد الأقصى ${MAX_RANGE_DAYS} يومًا`;
  return '';
}

@Component({
  selector: 'app-sa-disputes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, WsSelectComponent],
  templateUrl: './sa-disputes.html',
  styleUrl: './sa-disputes.css',
})
export class SaDisputes implements OnInit {
  private disputeApi = inject(DisputeApiService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly opsApi = inject(AdminOpsApiService);
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

  /** What the person is typing (not applied yet) vs. what the queue is actually filtered by (Enter / the search button). */
  readonly searchDraft = signal('');
  readonly appliedQuery = signal('');
  readonly searchHint = signal('');
  readonly assignee = signal('');
  readonly createdFrom = signal('');
  readonly createdTo = signal('');
  readonly filterError = signal('');
  readonly staff = signal<AdminStaffMember[]>([]);
  /** `الكل` / `المعيّن لي` / `غير معيّن` always; specific staff only when the staff list is available to this account (it needs the team permission). */
  readonly assigneeOptions = computed(() => [
    { value: '', label: 'الكل' }, { value: 'me', label: 'المعيّن لي' }, { value: 'unassigned', label: 'غير معيّن' },
    ...this.staff().map(s => ({ value: s.id, label: s.name })),
  ]);
  readonly hasSearchFilters = computed(() => !!(this.appliedQuery() || this.assignee() || this.createdFrom() || this.createdTo()));

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
    const search = normalizeDisputeSearch(q?.get('q'));
    if (search) { this.appliedQuery.set(search); this.searchDraft.set(search); }
    const from = validDay(q?.get('from')), to = validDay(q?.get('to'));
    if (!rangeProblem(from ?? '', to ?? '')) { this.createdFrom.set(from ?? ''); this.createdTo.set(to ?? ''); }
    const who = (q?.get('assignee') ?? '').toLowerCase();
    if (who === 'me' || who === 'unassigned') this.assignee.set(who);
    if (UUID_RE.test(who)) {
      // A specific staff member is only valid while this account can see the staff list; otherwise the value is dropped (the server would refuse it).
      this.opsApi.listStaff().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res) => { const list = res.success && Array.isArray(res.data) ? res.data : []; this.staff.set(list); if (list.some(s => s.id === who)) this.assignee.set(who); this.fetchDisputes(); },
        error: () => { this.staff.set([]); this.fetchDisputes(); },
      });
      return;
    }
    this.opsApi.listStaff().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => this.staff.set(res.success && Array.isArray(res.data) ? res.data : []),
      error: () => this.staff.set([]),
    });
    this.fetchDisputes();
  }

  private syncUrl() {
    const f = this.activeFilter();
    void this.router.navigate([], { replaceUrl: true, queryParams: {
      filter: f === 'all' ? null : f, followUp: null, q: this.appliedQuery() || null, assignee: this.assignee() || null,
      from: this.createdFrom() || null, to: this.createdTo() || null, page: this.currentPage() === 1 ? null : this.currentPage(),
    } });
  }

  fetchDisputes() {
    const problem = rangeProblem(this.createdFrom(), this.createdTo());
    this.filterError.set(problem);
    if (problem) return; // nothing is sent for an impossible period; the last list stays as it was
    this.syncUrl();
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    const filter = this.activeFilter();
    this.listRequest = this.disputeApi.getAdminDisputes({
      status: filter === 'all' || filter === 'followUp' ? undefined : filter,
      ...(filter === 'followUp' ? { followUp: true } : {}),
      ...(this.appliedQuery() ? { q: this.appliedQuery() } : {}),
      ...(this.assignee() ? { assignee: this.assignee() } : {}),
      ...(this.createdFrom() ? { createdFrom: this.createdFrom() } : {}),
      ...(this.createdTo() ? { createdTo: this.createdTo() } : {}),
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

  /** Enter / the search button. An empty box clears the search; a too short or malformed one is explained and nothing is sent. */
  applySearch() {
    const raw = this.searchDraft().trim();
    if (!raw) { this.searchHint.set(''); this.appliedQuery.set(''); }
    else {
      const q = normalizeDisputeSearch(raw);
      if (!q) { this.searchHint.set(`اكتب ${SEARCH_MIN} أحرف على الأقل من رقم النزاع أو مرجع الطلب أو المشروع (أرقام وحروف a-f)`); return; }
      this.searchHint.set(''); this.appliedQuery.set(q); this.searchDraft.set(q);
    }
    this.currentPage.set(1);
    this.fetchDisputes();
  }

  setAssignee(value: string) {
    this.assignee.set(value ?? '');
    this.currentPage.set(1);
    this.fetchDisputes();
  }

  setPeriod(which: 'from' | 'to', value: string) {
    (which === 'from' ? this.createdFrom : this.createdTo).set(validDay(value) ?? '');
    this.currentPage.set(1);
    this.fetchDisputes();
  }

  resetFilters() {
    this.activeFilter.set('all'); this.appliedQuery.set(''); this.searchDraft.set(''); this.searchHint.set('');
    this.assignee.set(''); this.createdFrom.set(''); this.createdTo.set('');
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
