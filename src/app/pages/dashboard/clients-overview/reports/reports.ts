import { Component, signal, computed, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ThemeService } from '../../../../core/services/theme.service';
import { AiResult, MetricSummaryDetails } from '../../../../core/models/ai-result.model';
import { AiResultCardComponent } from '../../../../shared/ai/ai-result-card.component';
import { ClientReportsService, ClientReportsData, ClientReportDateRange, ClientReportOrderItem, ClientReportTransaction } from '../../../../core/services/client-reports.service';

@Component({
	selector: 'app-reports',
	standalone: true,
	imports: [CommonModule, RouterModule, AiResultCardComponent],
	templateUrl: './reports.html',
	styleUrl: './reports.css'
})
export class Reports implements OnInit {
	public themeService = inject(ThemeService);
	private reportsService = inject(ClientReportsService);

	// Tabs: 'orders' | 'projects' | 'finance' | 'disputes'
	activeTab = signal<'orders' | 'projects' | 'finance' | 'disputes'>('orders');

	// Filters
	dateFilter = signal<'month' | '3m' | '6m' | 'year' | 'custom'>('month');
	searchQuery = signal<string>('');
	showDatePicker = signal<boolean>(false);

	// Sub-filters for tabs
	ordersStatusFilter = signal<string>('all');
	projectsStatusFilter = signal<string>('all');
	financeTypeFilter = signal<string>('all');
	financeStatusFilter = signal<string>('all');
	disputesStatusFilter = signal<string>('all');

	// Real backend state
	isLoading = signal<boolean>(true);
	hasError = signal<boolean>(false);
	data = signal<ClientReportsData | null>(null);

	// AI summary (separate from the report so a model problem never blocks the page)
	aiResult = signal<AiResult<MetricSummaryDetails> | null>(null);
	aiLoading = signal<boolean>(false);
	aiRequestFailed = signal<boolean>(false);
	private aiSeq = 0;

	ordersPage = signal<number>(1);
	private readonly pageSize = 4;

	constructor() {
		// Re-fetch whenever the date filter changes to a real, backend-supported
		// range. 'custom' has no real range picker behind it yet (the modal is a
		// placeholder), so it intentionally keeps whatever was last loaded
		// instead of sending a fabricated range to the API.
		effect(() => {
			const filter = this.dateFilter();
			if (filter === 'custom') { this.aiSeq++; this.aiResult.set(null); this.aiLoading.set(false); this.aiRequestFailed.set(false); return; }
			this.loadReports(filter);
			this.loadAi(filter);
		});
	}

	ngOnInit() {
		// initial load handled by the constructor effect (dateFilter starts at 'month')
	}

	private loadReports(range: ClientReportDateRange) {
		this.isLoading.set(true);
		this.hasError.set(false);
		this.ordersPage.set(1);
		this.reportsService.getReports(range).subscribe({
			next: (res) => {
				this.isLoading.set(false);
				if (res?.success && res.data) {
					this.data.set(res.data);
				} else {
					this.hasError.set(true);
				}
			},
			error: (err) => {
				console.error('[Reports] Failed to load real report data:', err);
				this.isLoading.set(false);
				this.hasError.set(true);
			}
		});
	}

	loadAi(range: ClientReportDateRange) {
		const seq = ++this.aiSeq;
		this.aiLoading.set(true);
		this.aiRequestFailed.set(false);
		this.aiResult.set(null);
		this.reportsService.getAiSummary(range).subscribe({
			next: (res) => {
				if (seq !== this.aiSeq) return; // stale response
				this.aiLoading.set(false);
				if (res?.success && res.data) this.aiResult.set(res.data);
				else this.aiRequestFailed.set(true);
			},
			error: () => {
				if (seq !== this.aiSeq) return;
				this.aiLoading.set(false);
				this.aiRequestFailed.set(true);
			},
		});
	}

	retryAi() {
		const filter = this.dateFilter();
		if (filter !== 'custom') this.loadAi(filter);
	}

	retry() {
		const filter = this.dateFilter();
		this.loadReports(filter === 'custom' ? 'month' : filter);
	}

	// ── Orders tab ──────────────────────────────────────────────────────────
	filteredOrders = computed<ClientReportOrderItem[]>(() => {
		const d = this.data();
		if (!d) return [];
		const filter = this.ordersStatusFilter();
		const q = this.searchQuery().trim().toLowerCase();
		let list = d.orders.items;
		if (filter !== 'all') {
			const bucket = { active: 'نشط', done: 'مكتمل', pending: 'منشور', cancelled: 'ملغي' }[filter];
			if (bucket) list = list.filter(o => o.bucket === bucket);
		}
		if (q) list = list.filter(o => o.title.toLowerCase().includes(q) || o.specialty.toLowerCase().includes(q));
		return list;
	});

	pagedOrders = computed<ClientReportOrderItem[]>(() => {
		const list = this.filteredOrders();
		const start = (this.ordersPage() - 1) * this.pageSize;
		return list.slice(start, start + this.pageSize);
	});

	/** A plain statistic (NOT AI): the specialty with the highest acceptance rate, from the report's own numbers; null when there is no data. */
	topAcceptance = computed(() => {
		const rows = this.data()?.orders.acceptanceBySpecialty ?? [];
		if (!rows.length) return null;
		return rows.reduce((best, r) => (r.rate > best.rate ? r : best), rows[0]);
	});

	ordersPageCount = computed(() => Math.max(1, Math.ceil(this.filteredOrders().length / this.pageSize)));

	setOrdersPage(page: number) {
		this.ordersPage.set(page);
	}

	// Every bar is scaled against the largest bucket so the tallest bar always
	// reaches 100% — a proportion, not a percentage of a shared total.
	statusBarWidth(count: number): number {
		const d = this.data();
		if (!d) return 0;
		const max = Math.max(1, ...Object.values(d.orders.statusDistribution));
		return Math.round((count / max) * 100);
	}

	opillClass(bucket: string): string {
		return { 'نشط': 'op-active', 'مكتمل': 'op-done', 'منشور': 'op-hold', 'ملغي': 'op-cancel' }[bucket] || 'op-hold';
	}

	// Project budgets / escrow have no stored currency and are USD-canonical.
	formatBudget(n: number): string {
		return n ? `${n.toLocaleString('en-US')} $` : '—';
	}

	orderRef(id: string): string {
		return `#${id.slice(0, 8).toUpperCase()}`;
	}

	formatRelativeDate(iso: string): string {
		const date = new Date(iso);
		const days = Math.floor((Date.now() - date.getTime()) / 86400000);
		if (days <= 0) return 'اليوم';
		if (days === 1) return 'أمس';
		if (days < 30) return `منذ ${days} ${days === 1 ? 'يوم' : 'أيام'}`;
		const months = Math.floor(days / 30);
		return months === 1 ? 'شهر' : `منذ ${months} أشهر`;
	}

	// ── Projects tab ────────────────────────────────────────────────────────
	projectOrders = computed<ClientReportOrderItem[]>(() => {
		const d = this.data();
		if (!d) return [];
		return d.orders.items.filter(o => o.bucket === 'نشط' || o.bucket === 'مكتمل');
	});

	filteredProjects = computed<ClientReportOrderItem[]>(() => {
		const filter = this.projectsStatusFilter();
		const q = this.searchQuery().trim().toLowerCase();
		let list = this.projectOrders();
		if (filter === 'active') list = list.filter(o => o.bucket === 'نشط');
		else if (filter === 'done') list = list.filter(o => o.bucket === 'مكتمل');
		if (q) list = list.filter(o => o.title.toLowerCase().includes(q) || o.specialty.toLowerCase().includes(q));
		return list;
	});

	// ── Finance tab ─────────────────────────────────────────────────────────
	filteredTransactions = computed<ClientReportTransaction[]>(() => {
		const d = this.data();
		if (!d) return [];
		const type = this.financeTypeFilter();
		const status = this.financeStatusFilter();
		const q = this.searchQuery().trim().toLowerCase();
		let list = d.finance.transactions;
		if (type !== 'all') list = list.filter(tx => tx.type === type);
		if (status !== 'all') list = list.filter(tx => tx.status === status);
		if (q) list = list.filter(tx => (tx.description || '').toLowerCase().includes(q) || tx.type.toLowerCase().includes(q));
		return list;
	});

	// Distinct transaction types actually present in the data — the filter row is
	// built from what the account really has, not a guessed list of enum values.
	transactionTypes = computed<string[]>(() => {
		const d = this.data();
		if (!d) return [];
		return Array.from(new Set(d.finance.transactions.map(tx => tx.type)));
	});

	txAmountClass(amount: number): string {
		return amount < 0 ? 'td-bold' : 'td-bold kv-val-green';
	}

	// Wallet transactions display their OWN stored currency (USD shown as '$') — never relabeled.
	formatAmount(n: number, currency?: string): string {
		const abs = Math.abs(n);
		const label = !currency || currency === 'USD' ? '$' : currency;
		return `${n < 0 ? '−' : ''}${abs.toLocaleString('en-US')} ${label}`;
	}

	txStatusClass(status: string): string {
		const s = String(status || '').toUpperCase();
		if (s === 'COMPLETED' || s === 'SUCCESS') return 'op-done';
		if (s === 'FAILED' || s === 'CANCELLED' || s === 'REJECTED') return 'op-cancel';
		if (s === 'PENDING' || s === 'PROCESSING') return 'op-hold';
		return 'op-active';
	}

	// ── Disputes tab ────────────────────────────────────────────────────────
	filteredDisputes = computed(() => {
		const d = this.data();
		if (!d) return [];
		const filter = this.disputesStatusFilter();
		const q = this.searchQuery().trim().toLowerCase();
		let list = d.disputes.items;
		if (filter === 'open') list = list.filter(x => ['OPEN', 'UNDER_REVIEW'].includes(String(x.status).toUpperCase()));
		else if (filter === 'resolved') list = list.filter(x => String(x.status).toUpperCase() === 'RESOLVED');
		else if (filter === 'rejected') list = list.filter(x => String(x.status).toUpperCase() === 'REJECTED');
		if (q) list = list.filter(x => (x.reason || '').toLowerCase().includes(q));
		return list;
	});

	disputeStatusLabel(status: string): string {
		return { OPEN: 'مفتوح', UNDER_REVIEW: 'قيد المراجعة', RESOLVED: 'محلول', REJECTED: 'مرفوض' }[String(status).toUpperCase()] || status;
	}

	disputeStatusClass(status: string): string {
		const s = String(status || '').toUpperCase();
		if (s === 'RESOLVED') return 'op-done';
		if (s === 'REJECTED') return 'op-cancel';
		if (s === 'UNDER_REVIEW') return 'op-hold';
		return 'op-active';
	}

	// ── Tab counts ──────────────────────────────────────────────────────────
	tabCount(tab: 'orders' | 'projects' | 'finance' | 'disputes'): number {
		const d = this.data();
		if (!d) return 0;
		if (tab === 'orders') return d.orders.counts.all;
		if (tab === 'projects') return d.projects.activeCount + d.projects.completedCount;
		if (tab === 'finance') return d.finance.transactions.length;
		return d.disputes.counts.all;
	}

	// ── Actions ─────────────────────────────────────────────────────────────
	switchTab(tab: 'orders' | 'projects' | 'finance' | 'disputes') {
		this.activeTab.set(tab);
	}

	setDate(range: 'month' | '3m' | '6m' | 'year') {
		this.dateFilter.set(range);
	}

	openDatePicker() {
		this.showDatePicker.set(true);
	}

	closeDatePicker() {
		this.showDatePicker.set(false);
	}

	dpApply() {
		this.dateFilter.set('custom');
		this.closeDatePicker();
	}

	resetAllFilters() {
		this.dateFilter.set('month');
		this.searchQuery.set('');
		this.ordersStatusFilter.set('all');
		this.projectsStatusFilter.set('all');
		this.financeTypeFilter.set('all');
		this.financeStatusFilter.set('all');
		this.disputesStatusFilter.set('all');
	}

	activeFiltersCount = computed(() => {
		let count = 0;
		if (this.dateFilter() !== 'month') count++;
		if (this.searchQuery() !== '') count++;
		if (this.activeTab() === 'orders' && this.ordersStatusFilter() !== 'all') count++;
		if (this.activeTab() === 'projects' && this.projectsStatusFilter() !== 'all') count++;
		if (this.activeTab() === 'finance') {
			if (this.financeTypeFilter() !== 'all') count++;
			if (this.financeStatusFilter() !== 'all') count++;
		}
		if (this.activeTab() === 'disputes' && this.disputesStatusFilter() !== 'all') count++;
		return count;
	});

	exportRpt(type: string) {
		alert('جاري التصدير بصيغة: ' + type);
	}

}
