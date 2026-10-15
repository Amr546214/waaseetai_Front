import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { parseRetryAfter, parseRetryAfterHeader, remainingSeconds } from './retry-after.util';
import { formatClock, formatWaitWords, rateLimitSentence, waitLabel } from './wait-format';

const NOW = Date.parse('2026-10-15T10:00:00Z');
const err = (headers: Record<string, string>, error: any = {}) => new HttpErrorResponse({ status: 429, headers: new HttpHeaders(headers), error });

describe('parseRetryAfter', () => {
	it('Retry-After as delta-seconds', () => {
		expect(parseRetryAfter(err({ 'Retry-After': '42' }), NOW)).toBe(NOW + 42_000);
		expect(parseRetryAfter('0', NOW)).toBe(NOW);
	});
	it('Retry-After as an HTTP-date; a past date gives an end in the past (remaining zero)', () => {
		const future = new Date(NOW + 90_000).toUTCString();
		expect(parseRetryAfter(err({ 'Retry-After': future }), NOW)).toBe(NOW + 90_000);
		const past = new Date(NOW - 60_000).toUTCString();
		const end = parseRetryAfter(err({ 'Retry-After': past }), NOW);
		expect(end).toBe(NOW - 60_000);
		expect(remainingSeconds(end, NOW)).toBe(0);
	});
	it('garbage / empty / missing give null (no seconds invented)', () => {
		for (const v of ['soon', '', '   ', '-5', '1.5', 'abc123', '12abc']) expect(parseRetryAfterHeader(v, NOW), v).toBeNull();
		expect(parseRetryAfter(err({}), NOW)).toBeNull();
		expect(parseRetryAfter(err({ 'Retry-After': 'soon' }, { message: 'طلبات كثيرة' }), NOW)).toBeNull();
		expect(parseRetryAfter(null, NOW)).toBeNull();
		expect(parseRetryAfter(undefined, NOW)).toBeNull();
		expect(parseRetryAfter(42 as any, NOW)).toBeNull();
	});
	it('body fields: ISO times first (retryAt, resendAvailableAt, availableAt), then retryAfterSeconds; top level, data, errors[]', () => {
		const iso = new Date(NOW + 30_000).toISOString();
		expect(parseRetryAfter(err({}, { retryAt: iso }), NOW)).toBe(NOW + 30_000);
		expect(parseRetryAfter({ data: { resendAvailableAt: iso } }, NOW)).toBe(NOW + 30_000);
		expect(parseRetryAfter(err({}, { availableAt: iso }), NOW)).toBe(NOW + 30_000);
		expect(parseRetryAfter(err({}, { retryAfterSeconds: 7 }), NOW)).toBe(NOW + 7_000);
		expect(parseRetryAfter(err({}, { errors: [{ code: 'x' }, { retryAfterSeconds: 12 }] }), NOW)).toBe(NOW + 12_000);
		expect(parseRetryAfter({ retryAfterSeconds: 'x' }, NOW)).toBeNull();
	});
	it('the header wins over the body', () => {
		expect(parseRetryAfter(err({ 'Retry-After': '5' }, { retryAfterSeconds: 99 }), NOW)).toBe(NOW + 5_000);
	});
	it('a Headers-like object and a plain response body work too', () => {
		expect(parseRetryAfter(new Headers({ 'Retry-After': '9' }), NOW)).toBe(NOW + 9_000);
		expect(parseRetryAfter({ success: false, emailSent: false, retryAfterSeconds: 15 }, NOW)).toBe(NOW + 15_000);
	});
});

describe('wait formatting', () => {
	it('clock form under and over an hour', () => {
		expect(formatClock(83)).toBe('1:23'); expect(formatClock(7)).toBe('0:07'); expect(formatClock(0)).toBe('0:00'); expect(formatClock(3665)).toBe('1:01:05');
		expect(waitLabel(83)).toBe('بعد 1:23');
	});
	it('words form', () => {
		expect(formatWaitWords(30)).toBe('30 ثانية'); expect(formatWaitWords(120)).toBe('دقيقتين'); expect(formatWaitWords(300)).toBe('5 دقائق'); expect(formatWaitWords(3600)).toBe('ساعة');
	});
	it('the 429 sentence names the wait when known and no number when unknown', () => {
		expect(rateLimitSentence(120)).toBe('طلبات كثيرة، يمكنك إعادة المحاولة بعد دقيقتين');
		expect(rateLimitSentence(null)).toBe('طلبات كثيرة، يمكنك إعادة المحاولة بعد قليل');
		expect(rateLimitSentence(null)).not.toMatch(/\d/);
		expect(rateLimitSentence(83, true)).toBe('طلبات كثيرة، يمكنك إعادة المحاولة بعد 1:23');
		expect(rateLimitSentence(0)).not.toMatch(/بعد/);
	});
});
