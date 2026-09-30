import { buildReferralUrl } from './referral-link.util';

describe('buildReferralUrl', () => {
	it('builds the full URL from the environment origin + slug (DEV environment.ts -> dev.waseetai.com)', () => {
		expect(buildReferralUrl('amrokasha7e11')).toBe('https://dev.waseetai.com/ref/amrokasha7e11');
	});

	it('returns an empty string for a missing slug — never /ref/undefined', () => {
		expect(buildReferralUrl(undefined)).toBe('');
		expect(buildReferralUrl(null)).toBe('');
	});

	it('returns an empty string for an empty-string slug', () => {
		expect(buildReferralUrl('')).toBe('');
	});
});
