import { Pipe, PipeTransform } from '@angular/core';
import { currencyCode, currencyLabel, formatAmount, formatBase, formatMoneyIn } from '../../core/utils/currency';

/** `{{ amount | money:record.currency }}` - an amount with ITS OWN currency, 2 digits (a missing currency on an existing record reads as USD). */
@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
	transform(value: number | null | undefined, currency?: string | null): string { return formatMoneyIn(value, currency); }
}

/** `{{ amount | wsAmount:record.currency }}` - "1,234.5 USD" / "300.00 SAR": the RECORD's currency code. Optional second argument: the number-pipe digits (default '1.0-2'). */
@Pipe({ name: 'wsAmount', standalone: true })
export class WsAmountPipe implements PipeTransform {
	transform(value: number | null | undefined, currency?: string | null, digits = '1.0-2'): string { return formatAmount(value, currency, digits); }
}

/** `{{ amount | wsBase }}` - an amount in the platform BASE currency, for NEW entries (forms) and platform-wide figures that have no record. Impure: follows the setting without a reload. */
@Pipe({ name: 'wsBase', standalone: true, pure: false })
export class WsBasePipe implements PipeTransform {
	transform(value: number | null | undefined, digits = '1.0-2'): string { return formatBase(value, digits); }
}

/** `{{ '' | wsCurrency }}` -> "USD"/"SAR" of the platform; `{{ rec.currency | wsCurrency }}` -> that record's; `| wsCurrency:'name'` -> "دولار أمريكي". Impure for the platform case. */
@Pipe({ name: 'wsCurrency', standalone: true, pure: false })
export class WsCurrencyPipe implements PipeTransform {
	transform(currency?: unknown, mode: 'code' | 'name' = 'code'): string { const c = currency === '' ? undefined : currency; return mode === 'name' ? currencyLabel(c) : currencyCode(c); }
}
