import { MoneyByComponent } from '../../../../shared/money/money-by.component';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminContractListData, AdminContractRow, AdminOpsApiService } from '../../../../core/services/admin-ops-api.service';
import {
  CONTRACT_STATUS_CLASSES,
  CONTRACT_STATUS_LABELS,
  ESCROW_STATUS_CLASSES,
  ESCROW_STATUS_LABELS,
  initials,
} from '../sa-projects/sa-projects.labels';

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-sa-contracts',
  standalone: true,
  imports: [MoneyByComponent, CommonModule, RouterLink],
  templateUrl: './sa-contracts.html',
  styleUrl: './sa-contracts.css',
})
export class SaContracts implements OnInit {
  private api = inject(AdminOpsApiService);
  private destroyRef = inject(DestroyRef);

  readonly statusLabels = CONTRACT_STATUS_LABELS;
  readonly statusClasses = CONTRACT_STATUS_CLASSES;
  readonly escrowLabels = ESCROW_STATUS_LABELS;
  readonly escrowClasses = ESCROW_STATUS_CLASSES;
  readonly initials = initials;

  /** Filter tabs map 1:1 to the backend ContractStatus enum; '' = all. */
  readonly filters: { key: string; label: string }[] = [
    { key: '', label: 'الكل' },
    ...Object.entries(CONTRACT_STATUS_LABELS).map(([key, label]) => ({ key, label })),
  ];

  data = signal<AdminContractListData | null>(null);
  loading = signal(true);
  error = signal(false);

  activeFilter = signal('');
  searchTerm = signal('');
  page = signal(1);

  rows = computed<AdminContractRow[]>(() => this.data()?.items ?? []);
  counts = computed(() => this.data()?.counts ?? {});
  total = computed(() =>
    Object.entries(this.counts()).filter(([k]) => k in CONTRACT_STATUS_LABELS).reduce((s, [, v]) => s + (v ?? 0), 0),
  );
  pages = computed(() => {
    const p = this.data()?.pagination;
    return p ? p.pages || p.totalPages || 1 : 1;
  });

  private req?: Subscription;
  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      this.req?.unsubscribe();
      clearTimeout(this.searchTimer);
    });
    this.load();
  }

  count(key: string): number {
    return key === '' ? this.total() : (this.counts()[key] ?? 0);
  }

  load(): void {
    this.req?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);
    this.req = this.api
      .listContracts({ status: this.activeFilter() || undefined, q: this.searchTerm().trim() || undefined, page: this.page(), limit: PAGE_LIMIT })
      .subscribe({
        next: (res) => {
          this.data.set(res.data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  setFilter(key: string): void {
    this.activeFilter.set(key);
    this.page.set(1);
    this.load();
  }

  onSearch(value: string): void {
    this.searchTerm.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, SEARCH_DEBOUNCE_MS);
  }

  goTo(page: number): void {
    if (page < 1 || page > this.pages()) return;
    this.page.set(page);
    this.load();
  }
}
