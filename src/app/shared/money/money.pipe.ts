import { Pipe, PipeTransform } from '@angular/core';
import { formatAmount, formatMoneyIn } from '../../core/utils/currency';

/** `{{ amount | money:record.currency }}` - an amount with ITS OWN currency (a missing currency reads as the legacy one). */
@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
	transform(value: number | null | undefined, currency?: string | null): string { return formatMoneyIn(value, currency); }
}

/** `{{ amount | wsAmount:record.currency }}` - the screen's current style ("1,234.5 $" for USD, its code for any other currency). Optional second argument: the number-pipe digits (default '1.0-2'). */
@Pipe({ name: 'wsAmount', standalone: true })
export class WsAmountPipe implements PipeTransform {
	transform(value: number | null | undefined, currency?: string | null, digits = '1.0-2'): string { return formatAmount(value, currency, digits); }
}
