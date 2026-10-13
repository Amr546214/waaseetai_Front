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
