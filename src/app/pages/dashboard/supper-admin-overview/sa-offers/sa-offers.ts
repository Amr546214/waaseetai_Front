import { WsAmountPipe } from '../../../../shared/money/money.pipe';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { WsDatePipe } from '../../../../shared/ws-date/ws-date.pipe';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminListPagination, OFFER_STATUS_LABELS, apiErrorMessage } from '../sa-requests/sa-requests.service';
import { AdminOfferRow, OFFER_STATUS_CLASSES, SaOffersService } from './sa-offers.service';

type FilterKey = 'ALL' | 'PENDING_SIGNATURE' | 'IN_AI_REVIEW' | 'SUBMITTED' | 'UNDER_NEGOTIATION' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

@Component({
  selector: 'app-sa-offers',
  standalone: true,
  imports: [WsAmountPipe, WsDatePipe, CommonModule, RouterLink],
  templateUrl: './sa-offers.html',
  styleUrl: './sa-offers.css',
})
export class SaOffers implements OnInit, OnDestroy {
  private api = inject(SaOffersService);

  readonly statusLabels = OFFER_STATUS_LABELS;
  readonly statusClasses = OFFER_STATUS_CLASSES;

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'ALL', label: 'الكل' },
    { key: 'PENDING_SIGNATURE', label: 'بانتظار التوقيع' },
    { key: 'IN_AI_REVIEW', label: 'قيد المراجعة الآلية' },
    { key: 'SUBMITTED', label: 'مقدّم' },
    { key: 'UNDER_NEGOTIATION', label: 'قيد التفاوض' },
    { key: 'ACCEPTED', label: 'مقبول' },
    { key: 'REJECTED', label: 'مرفوض' },
    { key: 'CANCELLED', label: 'مسحوب' },
  ];

  items = signal<AdminOfferRow[]>([]);
  rawCounts = signal<Record<string, number>>({});
  pagination = signal<AdminListPagination>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  loading = signal(true);
  error = signal('');

  activeFilter = signal<FilterKey>('ALL');
  searchTerm = signal('');
  page = signal(1);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  counts = computed(() => {
    const c = this.rawCounts();
    const out = {} as Record<FilterKey, number>;
    for (const f of this.filters) out[f.key] = f.key === 'ALL' ? c['all'] ?? 0 : c[f.key] ?? 0;
    return out;
  });

  stats = computed(() => {
    const c = this.counts();
    return { total: c.ALL, accepted: c.ACCEPTED, negotiating: c.UNDER_NEGOTIATION };
  });

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .list({ status: this.activeFilter(), search: this.searchTerm(), page: this.page(), limit: 20 })
      .subscribe({
        next: (res) => {
          this.items.set(res.data.items ?? []);
          this.rawCounts.set(res.data.counts ?? {});
          this.pagination.set(res.data.pagination);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(apiErrorMessage(err, 'تعذّر تحميل العروض'));
          this.loading.set(false);
        },
      });
  }

  setFilter(f: FilterKey) {
    this.activeFilter.set(f);
    this.page.set(1);
    this.load();
  }

  onSearch(value: string) {
    this.searchTerm.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 350);
  }

  goPage(p: number) {
    const total = this.pagination().totalPages;
    if (p < 1 || p > total || p === this.page()) return;
    this.page.set(p);
    this.load();
  }
}
