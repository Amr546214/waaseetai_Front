import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MISSING_DETAILS_TEXT, WalletBreakdown, WalletDeduction, currencySymbol, netMeaningLabel } from '../../core/models/wallet-unify.model';

export interface WalletBreakdownRow {
	id: string;
	title: string;
	date?: string;
	/** router link of the operation's details page (kept as a direct link) */
	link?: any[];
	breakdown?: WalletBreakdown | null;
	/** the stored row amount, shown only when the breakdown has no details */
	storedAmount?: number | null;
	storedCurrency?: string | null;
}

/**
 * «تفصيل المبالغ والخصومات»: per operation the amount before deduction, each fee/commission with its reason (and the level + rate RECORDED at the time
 * when the level is really the reason) and the net. Reads only the stored breakdown; an operation without recorded details says so.
 */
@Component({
	selector: 'app-wallet-breakdown',
	standalone: true,
	imports: [DecimalPipe, RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="wb-list" data-testid="wallet-breakdown">
			@for (r of rows(); track r.id) {
				<article class="wb-row" [attr.data-testid]="'breakdown-row'" [attr.data-recorded]="r.breakdown?.detailsRecorded ? 'yes' : 'no'">
					<header class="wb-head">
						<div>
							<div class="wb-title">{{ r.breakdown?.operationLabel || r.title }}</div>
							<div class="wb-meta">{{ r.title }}@if (r.date) { · {{ r.date }} }</div>
						</div>
						@if (r.link) { <a class="wb-link" [routerLink]="r.link">التفاصيل</a> }
					</header>
					@if (r.breakdown; as b) {
						@if (b.detailsRecorded) {
							<div class="wb-line"><span>{{ grossLabel(b) }}</span><b data-testid="bd-gross">{{ b.gross != null ? ((b.gross | number:'1.2-2') + ' ' + cur(b.currency)) : '—' }}</b></div>
							@for (d of b.deductions; track d.code) {
								<div class="wb-line wb-ded" data-testid="bd-deduction">
									<span>{{ d.label }}@if (rateText(d)) { <small> ({{ rateText(d) }})</small> }<small class="wb-reason">{{ d.reason }}</small></span>
									<b>- {{ d.amount | number:'1.2-2' }} {{ cur(b.currency) }}</b>
								</div>
							}
							@if (!b.deductions.length) { <div class="wb-line wb-none"><span>لا توجد خصومات على هذه العملية</span><b>—</b></div> }
							<div class="wb-line wb-net"><span>{{ netLabel(b) }}</span><b data-testid="bd-net">{{ b.net != null ? ((b.net | number:'1.2-2') + ' ' + cur(b.currency)) : '—' }}</b></div>
							@if (b.note) { <div class="wb-note">{{ b.note }}</div> }
						} @else {
							<div class="wb-missing" data-testid="bd-missing">{{ b.missingNote || missingText }}</div>
							@if (b.net != null) { <div class="wb-line"><span>المبلغ المسجّل</span><b>{{ b.net | number:'1.2-2' }} {{ cur(b.currency) }}</b></div> }
						}
					} @else {
						<div class="wb-missing" data-testid="bd-missing">{{ missingText }}</div>
						@if (r.storedAmount != null) { <div class="wb-line"><span>المبلغ المسجّل</span><b>{{ r.storedAmount | number:'1.2-2' }} {{ cur(r.storedCurrency) }}</b></div> }
					}
				</article>
			} @empty {
				<div class="wb-empty" data-testid="bd-empty">{{ emptyText() }}</div>
			}
		</div>
	`,
	styles: [`
		:host{display:block}
		.wb-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:12px}
		.wb-row{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;min-width:0}
		.wb-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px}
		.wb-title{font-weight:800;color:var(--txt);font-size:var(--font-size-label)}
		.wb-meta{font-size:var(--font-size-small);color:var(--txt-3);margin-top:2px;overflow-wrap:anywhere}
		.wb-link{font-size:var(--font-size-small);font-weight:700;color:var(--teal-txt);text-decoration:none;white-space:nowrap}
		.wb-line{display:flex;justify-content:space-between;gap:12px;padding:6px 0;font-size:var(--font-size-label);color:var(--txt-2);border-top:1px dashed var(--border)}
		.wb-line b{color:var(--txt);white-space:nowrap}
		.wb-ded b{color:var(--red)}
		.wb-ded small{color:var(--txt-3);font-size:var(--font-size-small);font-weight:400}
		.wb-ded small.wb-reason{display:block;margin-top:2px}
		.wb-none{color:var(--txt-3)}
		.wb-net{border-top:1px solid var(--border)}
		.wb-net b{color:var(--green)}
		.wb-note{font-size:var(--font-size-small);color:var(--txt-3);margin-top:6px}
		.wb-missing{font-size:var(--font-size-label);color:var(--kahr);font-weight:700;padding:4px 0 6px}
		.wb-empty{grid-column:1/-1;text-align:center;padding:28px 12px;color:var(--txt-3);background:var(--surface);border:1px solid var(--border);border-radius:14px}
	`],
})
export class WalletBreakdownComponent {
	rows = input.required<WalletBreakdownRow[]>();
	emptyText = input('لا توجد معاملات مالية بعد');
	missingText = MISSING_DETAILS_TEXT;
	cur = currencySymbol;

	grossLabel(b: WalletBreakdown): string {
		if (b.operation === 'DEPOSIT') return 'المبلغ المدفوع';
		if (b.operation === 'COMMISSION') return 'قبل الخصم (المبلغ المفرج)';
		return 'المبلغ قبل الخصم';
	}
	netLabel(b: WalletBreakdown): string { return netMeaningLabel(b.netMeaning); }
	/** the rate, and the level only when it was recorded at the time of the operation */
	rateText(d: WalletDeduction): string {
		const parts: string[] = [];
		if (d.ratePercent != null) parts.push(`${d.ratePercent}%`);
		if (d.level != null && d.levelRecorded) parts.push(`المستوى ${d.level} وقت العملية`);
		else if (d.code === 'PLATFORM_PROVIDER_COMMISSION') parts.push('المستوى وقت العملية غير مسجّل');
		return parts.join(' · ');
	}
}
