import { timezoneOffset } from './provider-prefs.store';

describe('provider timezone → DatePipe offset', () => {
	it('gives a "+HHMM" offset for the zones the provider can pick', () => {
		expect(timezoneOffset('Asia/Riyadh')).toBe('+0300');
		expect(timezoneOffset('Asia/Dubai')).toBe('+0400');
		expect(timezoneOffset('GMT')).toBe('+0000');
	});
	it('an unknown zone gives undefined (the browser zone is kept)', () => {
		expect(timezoneOffset('Mars/Base')).toBeUndefined();
	});
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { providerTimeZone, ProviderPrefsStore } from './provider-prefs.store';
import { TestBed } from '@angular/core/testing';
import { ProfileApiService } from './profile-api.service';
import { formatDay } from '../../pages/dashboard/provider-overview/marketing/marketing-utils';

describe('provider timezone reaches hand-formatted dates', () => {
	it('setTimezone feeds providerTimeZone() and changes the formatted day', () => {
		TestBed.configureTestingModule({ providers: [{ provide: ProfileApiService, useValue: {} }] });
		const store = TestBed.inject(ProviderPrefsStore);
		const iso = '2026-10-10T22:30:00Z'; // already 11 Oct in Riyadh (+3), still 10 Oct in GMT
		store.setTimezone('GMT');
		expect(providerTimeZone()).toBe('GMT');
		const gmtDay = formatDay(iso);
		store.setTimezone('Asia/Riyadh');
		const riyadhDay = formatDay(iso);
		expect(gmtDay.startsWith('10 ')).toBe(true);
		expect(riyadhDay.startsWith('11 ')).toBe(true);
		store.setTimezone(null);
	});
	it('every hand-formatted date in the individual provider area passes the saved zone', () => {
		const root = join(__dirname, '../../pages/dashboard/provider-overview');
		for (const f of ['messages/messages.ts', 'projects/active/progress/progress.ts', 'settings/account/account.ts', 'finance/withdraw/withdraw.ts', 'disputes/disputes.mapper.ts', 'profile/logs/logs.ts', 'profile/data/data.ts', 'finance/invoices/invoices.ts', 'help/tickets/tickets.ts', 'help/ticket-detail/ticket-detail.ts', 'marketing/marketing-utils.ts', 'marketing/approvals/approvals.ts']) {
			expect(readFileSync(join(root, f), 'utf8'), f).toContain('providerTimeZone()');
		}
	});
});
