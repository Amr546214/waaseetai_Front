import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatMoneyIn, otherCurrencyAmounts } from '../../core/utils/currency';

/**
 * Under a USD headline: the same figure in every OTHER currency, each on its own line. Renders nothing when only USD exists, so today's screens are unchanged.
 * Amounts of different currencies are never added; this component only lists them.
 */
@Component({
	selector: 'ws-money-by',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `@for (r of rows(); track r.currency) { <div class="ws-money-by" data-testid="money-by-currency"><span class="ws-money-by-lbl">{{ label() }}</span> {{ fmt(r.value, r.currency) }}</div> }`,
	styles: [`.ws-money-by { font-size: 12px; opacity: .85; margin-top: 2px; } .ws-money-by-lbl { opacity: .8; }`],
})
export class MoneyByComponent {
	readonly map = input<Record<string, number> | null | undefined>(null);
	readonly label = input<string>('بعملة أخرى:');
	readonly rows = computed(() => otherCurrencyAmounts(this.map()));
	readonly fmt = formatMoneyIn;
}
