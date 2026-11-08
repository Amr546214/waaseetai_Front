import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { providerTimeZone } from '../../../../core/services/provider-prefs.store';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminTicketListData, AdminTicketListItem, TicketApiService, TicketStatus } from '../../../../core/services/ticket-api.service';

type FilterKey = 'all' | 'escalated' | TicketStatus;

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'مفتوحة',
  IN_PROGRESS: 'قيد المراجعة',
  AWAITING_CUSTOMER: 'بانتظار رد المستخدم',
  RESOLVED: 'محلولة',
  CLOSED: 'مغلقة',
};

// Reuses the existing badge palette: blue = needs staff, amber = waiting on the user, green = done.
export function ticketStatusClass(s: TicketStatus): string {
  if (s === 'AWAITING_CUSTOMER') return 'sup-st-pending';
  if (s === 'RESOLVED' || s === 'CLOSED') return 'sup-st-resolved';
  return 'sup-st-open';
}

@Component({
  selector: 'app-sa-support',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-support.html',
  styleUrl: './sa-support.css',
})
export class SaSupport implements OnInit {
  private api = inject(TicketApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private listRequest?: Subscription;
  readonly escalationCount = signal(0);

  activeFilter = signal<FilterKey>('all');
  searchTerm = signal('');
  loading = signal(true);
  error = signal(false);
  tickets = signal<AdminTicketListItem[]>([]);
  page = signal(1);
  pagination = signal<AdminTicketListData['pagination'] | null>(null);
  statusCounts = signal<Partial<Record<TicketStatus, number>>>({});

  readonly statusLabels = TICKET_STATUS_LABELS;
  readonly statusClass = ticketStatusClass;

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'escalated', label: 'مصعّدة' },
    { key: 'OPEN', label: 'مفتوحة' },
    { key: 'IN_PROGRESS', label: 'قيد المراجعة' },
    { key: 'AWAITING_CUSTOMER', label: 'بانتظار رد المستخدم' },
    { key: 'RESOLVED', label: 'محلولة' },
    { key: 'CLOSED', label: 'مغلقة' },
  ];

  total = computed(() => Object.values(this.statusCounts()).reduce((a, b) => a + (b ?? 0), 0));

  ngOnInit() {
    // The queue state lives in the URL, so coming back from a case (or a refresh) lands on the same filter, search and page.
    const q = this.route?.snapshot?.queryParamMap;
    const filter = q?.get('filter');
    if (this.filters.some(f => f.key === filter)) this.activeFilter.set(filter as FilterKey);
    this.searchTerm.set(q?.get('q')?.trim().slice(0, 100) ?? '');
    const page = Number(q?.get('page'));
    if (Number.isSafeInteger(page) && page > 0 && page <= 100_000) this.page.set(page);
    this.load();
  }

  private syncUrl() {
    const f = this.activeFilter();
    void this.router.navigate([], { replaceUrl: true, queryParams: {
      filter: f === 'all' ? null : f, q: this.searchTerm().trim() || null, page: this.page() === 1 ? null : this.page(),
    } });
  }

  load() {
    this.syncUrl();
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);
    const f = this.activeFilter();
    this.listRequest = this.api.adminListTickets({
      status: f === 'all' || f === 'escalated' ? undefined : f,
      ...(f === 'escalated' ? { escalated: true } : {}),
      q: this.searchTerm().trim() || undefined, page: this.page(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.tickets.set(res.data.items);
          this.statusCounts.set(res.data.counts);
          this.escalationCount.set(res.data.escalationCount ?? 0);
          this.pagination.set(res.data.pagination ?? null);
        } else {
          this.error.set(true);
        }
      },
      error: () => { this.loading.set(false); this.error.set(true); },
    });
  }

  countFor(key: FilterKey): number {
    return key === 'all' ? this.total() : key === 'escalated' ? this.escalationCount() : (this.statusCounts()[key] ?? 0);
  }

  setFilter(key: FilterKey) {
    this.activeFilter.set(key);
    this.page.set(1);
    this.load();
  }

  totalPages(): number {
    const p = this.pagination();
    return p ? (p.pages || 1) : 1;
  }

  goToPage(n: number) {
    if (n < 1 || n > this.totalPages() || n === this.page()) return;
    this.page.set(n);
    this.load();
  }

  search() {
    this.page.set(1);
    this.load();
  }

  userName(t: AdminTicketListItem): string {
    return t.user ? `${t.user.firstName} ${t.user.lastName}`.trim() : '—';
  }

  timeAgo(iso: string): string {
    return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: providerTimeZone() });
  }
}
