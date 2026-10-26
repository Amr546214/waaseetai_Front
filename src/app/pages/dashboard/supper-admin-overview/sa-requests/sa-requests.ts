import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { WsDatePipe } from '../../../../shared/ws-date/ws-date.pipe';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AdminRequestRow,
  AdminListPagination,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_CLASSES,
  CONTRACT_STATUS_LABELS,
  SaRequestsService,
  apiErrorMessage,
  formatBudget,
} from './sa-requests.service';

type FilterKey = 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';

@Component({
  selector: 'app-sa-requests',
  standalone: true,
  imports: [WsDatePipe, CommonModule, RouterLink],
  templateUrl: './sa-requests.html',
  styleUrl: './sa-requests.css',
})
export class SaRequests implements OnInit, OnDestroy {
  private api = inject(SaRequestsService);

  readonly statusLabels = REQUEST_STATUS_LABELS;
  readonly statusClasses = REQUEST_STATUS_CLASSES;
  readonly contractLabels = CONTRACT_STATUS_LABELS;

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'ALL', label: 'الكل' },
    { key: 'OPEN', label: 'مفتوح' },
    { key: 'IN_PROGRESS', label: 'جارٍ' },
    { key: 'COMPLETED', label: 'مكتمل' },
    { key: 'CANCELLED', label: 'ملغى' },
    { key: 'DISPUTED', label: 'عليه نزاع' },
  ];

  items = signal<AdminRequestRow[]>([]);
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
    const out: Record<FilterKey, number> = {
      ALL: c['all'] ?? 0,
      OPEN: c['OPEN'] ?? 0,
      IN_PROGRESS: c['IN_PROGRESS'] ?? 0,
      COMPLETED: c['COMPLETED'] ?? 0,
      CANCELLED: c['CANCELLED'] ?? 0,
      DISPUTED: c['disputed'] ?? 0,
    };
    return out;
  });

  stats = computed(() => {
    const c = this.counts();
    return { total: c.ALL, open: c.OPEN, completed: c.COMPLETED, disputed: c.DISPUTED };
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
          this.error.set(apiErrorMessage(err, 'تعذّر تحميل الطلبات'));
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

  budget(r: AdminRequestRow): string {
    return formatBudget(r.budget);
  }
}
