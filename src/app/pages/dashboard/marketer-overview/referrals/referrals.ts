import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarketerOverviewService, MarketerSummary, ReferredUser, ReferralStatus } from '../../../../core/services/marketer-overview.service';

@Component({
  selector: 'app-referrals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './referrals.html',
  styleUrl: './referrals.css',
})
export class Referrals implements OnInit {
  private service = inject(MarketerOverviewService);

  readonly ReferralStatus = ReferralStatus;

  summary = signal<MarketerSummary | null>(null);
  isLoading = signal(true);
  errorMessage = signal('');

  filterStatus = signal<'all' | ReferralStatus>('all');
  searchQuery = signal<string>('');
  selectedReferral = signal<ReferredUser | null>(null);

  // Real referred-users list — GET /api/marketer-overview/referrals?page=&limit=
  readonly limit = 10;
  currentPage = signal(1);
  total = signal(0);
  referrals = signal<ReferredUser[]>([]);

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));

  // Honest derived count: total() and summary()?.successfulReferrals are both
  // real whole-dataset aggregates (not page-scoped), so subtracting them
  // yields a truthful "not yet converted" count — no fabricated number.
  pendingCount = computed(() => this.total() - (this.summary()?.successfulReferrals ?? 0));

  // Client-side status/name filtering within the currently loaded page —
  // the endpoint only supports page/limit, not server-side search.
  filteredReferrals = computed(() => {
    const status = this.filterStatus();
    const query = this.searchQuery().trim().toLowerCase();

    return this.referrals().filter(ref => {
      const matchesStatus = status === 'all' || ref.status === status;
      const matchesQuery = !query || ref.referredUserDisplayName?.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    this.service.getSummary().subscribe({
      next: (res) => {
        if (res.success) {
          this.summary.set(res.data);
        }
      },
      error: () => {}
    });

    this.loadReferrals(this.currentPage());
  }

  loadReferrals(page: number) {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.service.getReferrals(page, this.limit).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success && res.data) {
          this.referrals.set(res.data.items ?? []);
          this.total.set(res.data.total ?? 0);
          this.currentPage.set(res.data.page ?? page);
        } else {
          this.referrals.set([]);
          this.total.set(0);
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.referrals.set([]);
        this.total.set(0);
        this.errorMessage.set('تعذر تحميل قائمة الإحالات، حاول مرة أخرى');
      }
    });
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) return;
    this.loadReferrals(page);
  }

  getPagesArray(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages(); i++) pages.push(i);
    return pages;
  }

  setFilter(status: 'all' | ReferralStatus) {
    this.filterStatus.set(status);
  }

  /** Arabic label for the backend's ReferralStatus enum, house style per withdraw.ts's getStatusLabel(). */
  getStatusLabel(status: ReferralStatus | string): string {
    const map: Record<string, string> = {
      PENDING: 'معلقة',
      QUALIFIED: 'مؤهلة',
      CONVERTED: 'محولة'
    };
    return map[status as string] || status || 'غير محدد';
  }

  getStatusClass(status: ReferralStatus | string): string {
    const map: Record<string, string> = {
      PENDING: 'txt-amber',
      QUALIFIED: 'txt-teal',
      CONVERTED: 'txt-green'
    };
    return map[status as string] || 'txt-muted';
  }

  getStatusBg(status: ReferralStatus | string): string {
    const map: Record<string, string> = {
      PENDING: 'rgba(255,180,0,.10)',
      QUALIFIED: 'rgba(43,212,199,.12)',
      CONVERTED: 'rgba(15,169,154,.12)'
    };
    return map[status as string] || 'rgba(255,255,255,.06)';
  }

  /** Never blank/undefined: null/undefined shows as "—", a real 0 shows as "0 ريال". */
  formatCommission(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) return '—';
    return `${amount} ريال`;
  }

  openRefModal(ref: ReferredUser) {
    this.selectedReferral.set(ref);
  }

  closeRefModal() {
    this.selectedReferral.set(null);
  }
}
