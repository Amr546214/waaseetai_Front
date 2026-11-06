import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WalletCard, coversLabel, currencySymbol } from '../../core/models/wallet-unify.model';

export interface WalletCardItem {
	key: string;
	title: string;
	card: WalletCard | null | undefined;
	tone?: 'teal' | 'amber' | 'blue' | 'plain';
	/** shown under a figure that is available (e.g. what the number is computed over is added automatically) */
	sub?: string;
}

/**
 * The second row of wallet cards (amount before deductions, held in escrow, pending withdrawals, cashback ...), in the visual system of the client wallet
 * (.wal-side). A figure the backend could not compute, or a feature that is not enabled, shows its state in words instead of a 0.
 */
@Component({
	selector: 'app-wallet-extra-cards',
	standalone: true,
	imports: [DecimalPipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="wx-grid" [style.grid-template-columns]="'repeat(' + cols() + ', 1fr)'" data-testid="wallet-extra-cards">
			@for (it of visible(); track it.key) {
				<div class="wx-card" [attr.data-testid]="'wallet-card-' + it.key" [attr.data-state]="it.card?.state ?? 'UNAVAILABLE'">
					<div class="wx-lbl" [class]="'tone-' + (it.tone ?? 'plain')">{{ it.title }}</div>
					@if (it.card?.state === 'AVAILABLE' && it.card?.value != null) {
						<div class="wx-val" [class]="'tone-' + (it.tone ?? 'plain')"><span class="wx-num" data-testid="card-value">{{ it.card!.value | number:'1.2-2' }}</span> <span class="wx-cur">{{ cur(it.card!.currency) }}</span></div>
						@if (it.sub) { <div class="wx-sub">{{ it.sub }}</div> }
						@if (it.key === 'gross' && it.card!.operationsCounted === 0 && it.card!.operationsWithoutDetails === 0) { <div class="wx-sub" data-testid="card-no-ops">لا توجد عمليات محسوبة بعد</div> }
						@if (covers(it.card!)) { <div class="wx-sub" data-testid="card-covers">محسوب على: {{ covers(it.card!) }}</div> }
						@if (!it.card!.complete && it.card!.operationsWithoutDetails > 0) { <div class="wx-sub wx-warn" data-testid="card-incomplete">غير شامل {{ it.card!.operationsWithoutDetails }} عملية بلا تفاصيل مسجّلة</div> }
						@else if (!it.card!.complete && it.card!.note) { <div class="wx-sub wx-warn" data-testid="card-incomplete">{{ it.card!.note }}</div> }
						@else if (it.card!.note) { <div class="wx-sub">{{ it.card!.note }}</div> }
						@if (it.card!.excludedOtherCurrency > 0) { <div class="wx-sub wx-warn">لم تُجمع عمليات بعملة أخرى ({{ it.card!.excludedOtherCurrency }})</div> }
					} @else {
						<div class="wx-val wx-state" data-testid="card-state">{{ stateText(it.card) }}</div>
						@if (it.card?.note) { <div class="wx-sub">{{ it.card!.note }}</div> }
					}
				</div>
			}
		</div>
	`,
	styles: [`
		:host{display:block;margin-bottom:16px}
		.wx-grid{display:grid;gap:14px}
		.wx-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:17px;min-width:0}
		.wx-lbl{font-size:var(--font-size-small);font-weight:600;margin-bottom:7px}
		.wx-val{font-size:22px;font-weight:900;color:var(--txt)}
		.wx-num{direction:ltr;unicode-bidi:isolate;display:inline-block}
		.wx-cur{font-size:var(--font-size-label);font-weight:700;color:var(--txt-2)}
		.wx-state{font-size:var(--font-size-body);font-weight:800;color:var(--txt-2)}
		.wx-sub{font-size:var(--font-size-small);color:var(--txt-3);margin-top:5px;line-height:1.6}
		.wx-warn{color:var(--kahr)}
		.tone-teal{color:var(--teal-txt)}.tone-amber{color:var(--kahr)}.tone-blue{color:var(--blue-txt)}.tone-plain{color:var(--txt-2)}
		@media(max-width:900px){.wx-grid{grid-template-columns:1fr !important}}
	`],
})
export class WalletExtraCardsComponent {
	items = input.required<WalletCardItem[]>();
	/** a card that does not apply to the role (NOT_APPLICABLE) is not drawn at all */
	visible = computed(() => this.items().filter(i => i.card?.state !== 'NOT_APPLICABLE'));
	cols = computed(() => Math.min(3, Math.max(1, this.visible().length)));
	cur = currencySymbol;
	covers = (c: WalletCard) => coversLabel(c.covers);
	stateText(c: WalletCard | null | undefined): string {
		if (!c) return 'غير متاح حالياً';
		if (c.state === 'NOT_ENABLED') return 'غير مفعّل حالياً';
		return 'غير متاح حالياً';
	}
}
