import { ACCREDITATION_STATUS_REPLACEMENT_ROUTE, normalizeLegacyNotificationUrl, projectMessagesUrl } from './notification-links';

describe('normalizeLegacyNotificationUrl (SAVED notifications with old links)', () => {
	const cases: Array<[string, string]> = [
		['/dashboard/clients-overview/finance/wallet', '/client-overview/finance/wallet'],
		['/dashboard/provider-overview/offers', '/provider-overview/offers'],
		['/provider-overview/accreditation-status', ACCREDITATION_STATUS_REPLACEMENT_ROUTE],
		['/provider-overview/business-models/accreditation', '/provider-overview/business-models/accreditation/list'],
		['/provider-overview/business-models/accreditation/?x=1', '/provider-overview/business-models/accreditation/list?x=1'],
		['/provider-overview/projects/abc/contract', '/provider-overview/offers'],
		['/provider-overview/projects/abc', '/provider-overview/projects/active/progress/abc'],
		['/provider-overview/projects/progress/abc?x=1', '/provider-overview/projects/active/progress/abc?x=1'],
		['/client-overview/projects/abc/progress', '/client-overview/projects/abc'],
	];
	for (const [from, to] of cases) it(`${from} -> ${to}`, () => expect(normalizeLegacyNotificationUrl(from)).toBe(to));

	it('current routes and reserved siblings are untouched', () => {
		for (const u of ['/provider-overview/projects/active', '/provider-overview/projects/archived', '/provider-overview/projects/active/progress/abc', '/client-overview/projects/abc/rating', '/client-overview/disputes?dispute=d1'])
			expect(normalizeLegacyNotificationUrl(u)).toBe(u);
	});
	it('empty is null; an external / protocol-relative URL is returned untouched (the safety check rejects it later)', () => {
		expect(normalizeLegacyNotificationUrl(null)).toBeNull();
		expect(normalizeLegacyNotificationUrl('https://evil.test/x')).toBe('https://evil.test/x');
		expect(normalizeLegacyNotificationUrl('//evil.test/x')).toBe('//evil.test/x');
	});
	it('the project messages tab URL shapes', () => {
		expect(projectMessagesUrl('client', 'c1')).toBe('/client-overview/projects/c1?tab=messages');
		expect(projectMessagesUrl('provider', 'c1')).toBe('/provider-overview/projects/active/progress/c1?tab=messages');
	});
});
