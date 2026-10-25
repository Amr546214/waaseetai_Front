import { Pipe, PipeTransform } from '@angular/core';
import { formatMoneyIn } from '../../core/utils/currency';

/** `{{ amount | money:record.currency }}` - an amount with ITS OWN currency (a missing currency reads as the legacy one). */
@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
	transform(value: number | null | undefined, currency?: string | null): string { return formatMoneyIn(value, currency); }
}
