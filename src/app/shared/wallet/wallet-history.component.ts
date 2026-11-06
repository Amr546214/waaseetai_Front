import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WalletHistoryItem, WalletRole, WalletUnifyService } from '../../core/services/wallet-unify.service';
import { MISSING_DETAILS_TEXT, WalletCard, WalletPagination, currencySymbol, netMeaningLabel } from '../../core/models/wallet-unify.model';
import { WalletCardItem, WalletExtraCardsComponent } from './wallet-cards.component';
import { handleLoadError } from '../../core/utils/rate-limit.util';

const PAGE_SIZE = 20;

interface RoleConfig {
	title: string;
	sub: string;
	back: string;
	backLabel: string;
	detailBase: string;
	filters: Array<{ id: string; label: string }>;
}

const ROLE_CONFIG: Record<'client' | 'marketer', RoleConfig> = {
	client: {
		title: 'سجل المعاملات', sub: 'كل معاملات محفظتك، من الأحدث، مع المبلغ قبل الخصم والصافي',
		back: '/client-overview/finance/wallet', backLabel: '← المحفظة', detailBase: '/client-overview/finance/wallet',
		filters: [{ id: 'all', label: 'الكل' }, { id: 'DEPOSIT', label: 'إيداعات' }, { id: 'ESCROW_LOCK', label: 'ضمان' }, { id: 'ORDER_PAYMENT', label: 'مدفوعات' }, { id: 'REFUND', label: 'مستردات' }],
	},
	marketer: {
		title: 'سجل العمولات والسحوبات', sub: 'عمولاتك وطلبات سحبك من الأحدث، بقيمها المسجّلة وقت كل عملية',
		back: '/marketer-overview/commissions', backLabel: '← العمولات', detailBase: '/marketer-overview/commissions/history',
		filters: [{ id: 'all', label: 'الكل' }, { id: 'COMMISSION', label: 'العمولات' }, { id: 'WITHDRAWAL', label: 'السحوبات' }],
	},
};

/** Standalone full-history page (client and marketer): paged, owner-only data, each line with before-deduction / deductions / net and a link to its details. */
@Component({
	selector: 'app-wallet-history',
	standalone: true,
	imports: [DecimalPipe, RouterLink, WalletExtraCardsComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<section class="wh-page" dir="rtl" data-testid="wallet-history-page">
			<a [routerLink]="cfg().back" class="wh-back">{{ cfg().backLabel }}</a>
			<div class="wh-head"><h1 class="wh-title">{{ cfg().title }}</h1><div class="wh-sub">{{ cfg().sub }}</div></div>

			@if (cards().length) { <app-wallet-extra-cards [items]="cards()" /> }

			<div class="wh-filters" role="group" aria-label="نوع المعاملة">
				@for (f of cfg().filters; track f.id) {
					<button type="button" class="wh-chip" [class.active]="type() === f.id" (click)="setType(f.id)">{{ f.label }}</button>
				}
			</div>

			@if (loading()) { <div class="wh-state" role="status" aria-label="جاري التحميل">جاري تحميل السجل...</div> }
			@else if (error()) {
				<div class="wh-state wh-error" role="alert" data-testid="history-error">{{ error() }} <button type="button" class="wh-retry" (click)="load()">إعادة المحاولة</button></div>
			} @else {
				<div class="wh-wrap">
					<div class="wh-scroll">
						<table class="wh-tbl" data-testid="history-table">
							<thead><tr><th>المعاملة</th><th>التاريخ</th><th>قبل الخصم</th><th>الخصومات</th><th>الصافي</th><th>الحالة</th></tr></thead>
							<tbody>
								@for (it of items(); track it.id) {
									<tr data-testid="history-row">
										<td><a class="wh-open" [routerLink]="[cfg().detailBase, it.id]"><b>{{ it.breakdown?.operationLabel || it.title || it.description || 'معاملة مالية' }}</b></a>@if (it.description && it.description !== (it.breakdown?.operationLabel || it.title)) { <div class="wh-d">{{ it.description }}</div> }@if (it['employeeName']) { <div class="wh-d" data-testid="history-employee">الموظف: {{ it['employeeName'] }}</div> }</td>
										<td data-label="التاريخ">{{ dateText(it.createdAt) }}</td>
										@if (it.breakdown?.detailsRecorded) {
											<td data-label="قبل الخصم">{{ it.breakdown!.gross != null ? ((it.breakdown!.gross | number:'1.2-2') + ' ' + cur(it.breakdown!.currency)) : '—' }}</td>
											<td data-label="الخصومات">{{ dedText(it) }}</td>
											<td class="wh-net" data-label="الصافي"><b>{{ it.breakdown!.net != null ? ((it.breakdown!.net | number:'1.2-2') + ' ' + cur(it.breakdown!.currency)) : '—' }}</b><div class="wh-d">{{ meaning(it) }}</div></td>
										} @else {
											<td colspan="2" class="wh-missing" data-label="الخصومات" data-testid="history-missing">{{ missing }}</td>
											<td class="wh-net" data-label="الصافي"><b>{{ shown(it) | number:'1.2-2' }} {{ cur(it.currency) }}</b><div class="wh-d">المبلغ المسجّل</div></td>
										}
										<td data-label="الحالة"><span class="wh-st">{{ statusText(it.status) }}</span></td>
									</tr>
								} @empty {
									<tr><td colspan="6" class="wh-empty" data-testid="history-empty">لا توجد معاملات مالية بعد</td></tr>
								}
							</tbody>
						</table>
					</div>
				</div>
				@if (pagination(); as p) {
					@if (p.totalPages > 1) {
						<div class="wh-pager" data-testid="history-pager">
							<button type="button" class="wh-chip" [disabled]="p.page <= 1" (click)="go(p.page - 1)">السابق</button>
							<span>صفحة {{ p.page }} من {{ p.totalPages }} · {{ p.total }} معاملة</span>
							<button type="button" class="wh-chip" [disabled]="p.page >= p.totalPages" (click)="go(p.page + 1)">التالي</button>
						</div>
					}
				}
			}
		</section>
	`,
	styles: [`
		:host{display:block;width:100%;font-family:var(--font-family,'Tajawal'),system-ui,sans-serif;color:var(--txt)}
		*,*::before,*::after{box-sizing:border-box}
		.wh-back{display:inline-flex;margin-bottom:10px;font-size:var(--font-size-label);font-weight:700;color:var(--txt-3);text-decoration:none}
		.wh-back:hover{color:var(--teal-txt)}
		.wh-head{margin-bottom:16px}
		.wh-title{margin:0;font-size:20px;font-weight:900;color:var(--txt)}
		.wh-sub{font-size:var(--font-size-small);color:var(--txt-3);margin-top:3px}
		.wh-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
		.wh-chip{font-family:inherit;border:1px solid var(--border);background:transparent;color:var(--txt-2);border-radius:9px;padding:6px 14px;font-size:var(--font-size-small);font-weight:700;cursor:pointer}
		.wh-chip.active{background:rgba(43,212,199,.14);color:var(--teal-txt);border-color:rgba(43,212,199,.35)}
		.wh-chip:disabled{opacity:.45;cursor:default}
		.wh-wrap{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:14px}
		.wh-scroll{overflow-x:auto}
		.wh-tbl{width:100%;border-collapse:collapse;min-width:760px}
		.wh-tbl th{font-size:var(--font-size-small);color:var(--txt-3);text-align:right;padding:11px 14px;font-weight:700;border-bottom:1px solid var(--border);white-space:nowrap}
		.wh-tbl td{font-size:var(--font-size-label);color:var(--txt-2);padding:13px 14px;border-bottom:1px solid var(--border);vertical-align:top}
		.wh-tbl tbody tr:last-child td{border-bottom:none}
		.wh-open{color:var(--txt);text-decoration:none}
		.wh-open:hover b{color:var(--teal-txt)}
		.wh-d{font-size:var(--font-size-small);color:var(--txt-3);margin-top:2px}
		.wh-net b{color:var(--green)}
		.wh-missing{color:var(--kahr);font-weight:700;text-align:center}
		.wh-st{font-size:var(--font-size-caption);font-weight:800;padding:3px 9px;border-radius:6px;white-space:nowrap;background:rgba(43,127,255,.12);color:var(--blue-txt)}
		.wh-empty{text-align:center;padding:30px 12px !important;color:var(--txt-3) !important}
		.wh-state{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:28px;text-align:center;color:var(--txt-2)}
		.wh-error{color:var(--red)}
		.wh-retry{font-family:inherit;margin-inline-start:10px;padding:6px 14px;border-radius:9px;border:none;cursor:pointer;font-weight:800;background:linear-gradient(135deg,#2BD4C7,#2B7FFF);color:#070D24}
		@media(max-width:700px){
			.wh-tbl{min-width:0;display:block}.wh-tbl thead{display:none}.wh-tbl tbody{display:block}
			.wh-tbl tr{display:block;padding:12px 14px;border-bottom:1px solid var(--border)}
			.wh-tbl tbody tr:last-child{border-bottom:none}
			.wh-tbl td{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:none;text-align:left}
			.wh-tbl td[data-label]::before{content:attr(data-label);color:var(--txt-3);font-size:var(--font-size-small);flex-shrink:0}
			.wh-tbl td:first-child{display:block;text-align:right;padding-bottom:8px}
			.wh-tbl td.wh-missing{text-align:left}
			.wh-empty{display:block !important}
		}
		.wh-pager{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;font-size:var(--font-size-small);color:var(--txt-3)}
	`],
})
export class WalletHistoryComponent implements OnInit {
	role = input.required<Exclude<WalletRole, 'provider'>>();
	private api = inject(WalletUnifyService);

	cfg = computed(() => ROLE_CONFIG[this.role()]);
	type = signal('all');
	loading = signal(true);
	error = signal('');
	items = signal<WalletHistoryItem[]>([]);
	pagination = signal<WalletPagination | null>(null);
	summaryCards = signal<Record<string, WalletCard> | null>(null);
	missing = MISSING_DETAILS_TEXT;
	cur = currencySymbol;
	/** the server's displayAmount (absolute, direction aside) when present, else the absolute stored amount */
	shown = (it: WalletHistoryItem) => Math.abs(typeof it['displayAmount'] === 'number' ? (it['displayAmount'] as number) : it.amount);

	cards = computed<WalletCardItem[]>(() => {
		const c = this.summaryCards();
		if (!c) return [];
		const out: WalletCardItem[] = [{ key: 'gross', title: 'المبلغ قبل الخصومات', card: c['grossBeforeDeductions'], tone: 'teal' }];
		if (this.role() === 'client') out.push({ key: 'held', title: 'محجوز بالضمان', card: c['heldInEscrow'], tone: 'amber' }, { key: 'cashback', title: 'كاش باك الولاء', card: c['cashback'], tone: 'teal' });
		else out.push({ key: 'pending', title: 'سحوبات قيد المعالجة', card: c['pendingWithdrawals'], tone: 'blue' }, { key: 'held', title: 'محجوز بالضمان', card: c['heldInEscrow'], tone: 'amber' });
		return out;
	});

	ngOnInit() { this.load(1); }

	setType(t: string) { this.type.set(t); this.load(1); }
	go(page: number) { this.load(page); }
	reload() { this.load(this.pagination()?.page ?? 1); }

	load(page = 1) {
		this.loading.set(true); this.error.set('');
		this.api.history(this.role(), page, PAGE_SIZE, this.type()).subscribe({
			next: res => {
				const d = res?.data;
				if (res?.success && d) {
					this.items.set(d.items ?? []); this.pagination.set(d.pagination ?? null);
					this.summaryCards.set((d.summary as any)?.cards ?? null);
				} else this.error.set('تعذر تحميل السجل');
				this.loading.set(false);
			},
			error: (err) => handleLoadError(err, {
				hasData: () => this.items().length > 0,
				onKeep: () => this.loading.set(false),
				onRateLimit: () => { this.error.set('تعذر تحميل السجل الآن، أعد المحاولة بعد قليل'); this.loading.set(false); },
				onOtherError: () => { this.error.set(err?.status === 403 ? 'هذه الصفحة غير متاحة لحسابك' : 'تعذر تحميل السجل'); this.loading.set(false); },
			}),
		});
	}

	dateText(v: string): string {
		return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(v));
	}
	dedText(it: WalletHistoryItem): string {
		const b = it.breakdown!;
		if (!b.deductions.length) return 'لا يوجد';
		return b.deductions.map(d => `${d.label}: ${d.amount.toFixed(2)} ${currencySymbol(b.currency)}`).join('، ');
	}
	meaning(it: WalletHistoryItem): string { return netMeaningLabel(it.breakdown?.netMeaning); }
	statusText(s: string | undefined): string {
		const m: Record<string, string> = { COMPLETED: 'مكتمل', HELD: 'محجوز', FAILED: 'فشلت', PENDING: 'قيد المعالجة', APPROVED: 'معتمد', PAID: 'مدفوع', PROCESSING: 'قيد التنفيذ', REJECTED: 'مرفوض', CANCELLED: 'ملغي', CANCELED: 'ملغي', REVERSED: 'معكوس' };
		return s ? (m[s] ?? s) : '—';
	}
}
