import { Pipe, PipeTransform } from '@angular/core';
import { formatDate } from '@angular/common';
import { platformRegional } from '../../core/utils/regional';
import { displayTimeZone, timezoneOffset } from '../../core/services/provider-prefs.store';

export type WsDateKind = 'date' | 'datetime';
const NUMERIC_LEGACY = /^(yyyy[-/]MM[-/]dd)( HH:mm)?$/;

/** The zone dates are shown in: the user's own saved zone, else the platform zone, else the browser's. */
export const effectiveTimeZone = (): string | undefined => displayTimeZone();

/**
 * Pure formatter behind the `wsDate` pipe (also usable from TypeScript). `legacy` is the page's own Angular format, kept exactly while the platform setting is "حسب الصفحة" and the calendar is
 * Gregorian; otherwise the platform date format / calendar decides. Time zone: effectiveTimeZone(). Latin digits everywhere (numbers in tables must stay comparable).
 */
export function formatWsDate(value: unknown, kind: WsDateKind = 'date', legacy?: string): string {
	if (value === null || value === undefined || value === '') return '';
	const d = value instanceof Date ? value : new Date(value as string | number);
	if (Number.isNaN(d.getTime())) return '';
	const r = platformRegional(); const zone = effectiveTimeZone();
	const withTime = kind === 'datetime';
	const pattern = (order: 'DMY' | 'YMD', sep: '/' | '-') => (order === 'DMY' ? `dd${sep}MM${sep}yyyy` : `yyyy${sep}MM${sep}dd`) + (withTime ? ' HH:mm' : '');
	if (r.calendar === 'hijri') {
		const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
		const p = (t: string) => parts.find(x => x.type === t)?.value ?? '';
		const order: 'DMY' | 'YMD' = r.dateFormat === 'DD/MM/YYYY' || (r.dateFormat === 'legacy' && !!legacy && !/^yyyy/.test(legacy)) ? 'DMY' : 'YMD';
		const sep: '/' | '-' = r.dateFormat === 'DD/MM/YYYY' || (r.dateFormat === 'legacy' && !!legacy?.includes('/')) ? '/' : '-';
		const day = order === 'DMY' ? `${p('day')}${sep}${p('month')}${sep}${p('year')}` : `${p('year')}${sep}${p('month')}${sep}${p('day')}`;
		return withTime ? `${day} ${p('hour')}:${p('minute')}` : day;
	}
	let format: string;
	if (r.dateFormat === 'DD/MM/YYYY') format = pattern('DMY', '/');
	else if (r.dateFormat === 'YYYY-MM-DD') format = pattern('YMD', '-');
	else format = legacy && NUMERIC_LEGACY.test(legacy) ? legacy : pattern('YMD', '-');
	return formatDate(d, format, 'en-US', zone ? timezoneOffset(zone, d) : undefined);
}

/** `{{ x | wsDate:'date':'yyyy-MM-dd' }}` / `'datetime'`. Impure on purpose: it follows the platform setting without a page reload. */
@Pipe({ name: 'wsDate', standalone: true, pure: false })
export class WsDatePipe implements PipeTransform {
	transform(value: unknown, kind: WsDateKind = 'date', legacyFormat?: string): string { return formatWsDate(value, kind, legacyFormat); }
}
