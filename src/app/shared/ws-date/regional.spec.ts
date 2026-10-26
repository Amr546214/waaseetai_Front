import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { environment } from '../../../environments/environment';
import { platformDateOffset, platformRegional, platformTimeZone, setPlatformRegional, zoneOffsetString } from '../../core/utils/regional';
import { ProviderPrefsStore, providerTimeZone } from '../../core/services/provider-prefs.store';
import { PlatformInfoService } from '../../core/services/platform-info.service';
import { WsDatePipe, formatWsDate } from './ws-date.pipe';

const reset = () => { setPlatformRegional({}); TestBed.inject(ProviderPrefsStore).setTimezone(null); };
const T = '2026-10-25T22:30:00Z'; // 26 Oct 01:30 in Riyadh

describe('regional display settings: one answer for every formatter', () => {
	beforeEach(() => { TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }); reset(); });
	afterEach(() => reset());

	it('initial platform values keep today\'s behaviour: legacy page formats, Gregorian, the browser\'s own zone', () => {
		expect(platformRegional()).toEqual({ timezone: 'browser', dateFormat: 'legacy', calendar: 'gregorian', language: 'ar', currency: 'USD' });
		expect(platformTimeZone()).toBeUndefined(); expect(platformDateOffset()).toBeUndefined();
		expect(formatWsDate('2026-10-25T10:30:00Z', 'date', 'yyyy/MM/dd')).toMatch(/^2026\/10\/25$|^2026\/10\/2[46]$/); // the page's own format, in the machine's zone
		expect(formatWsDate('2026-10-25T10:30:00Z', 'datetime', 'yyyy-MM-dd HH:mm')).toMatch(/^2026-10-2[56] \d{2}:30$|^2026-10-2[56] \d{2}:\d{2}$/);
	});
	it('the platform zone shifts the shown time (Riyadh = +03:00, UTC = +00:00), the stored instant is untouched', () => {
		setPlatformRegional({ defaultTimezone: 'Asia/Riyadh' }); expect(platformDateOffset()).toBe('+0300'); expect(zoneOffsetString('UTC')).toBe('+0000');
		expect(formatWsDate(T, 'datetime', 'yyyy-MM-dd HH:mm')).toBe('2026-10-26 01:30'); expect(formatWsDate(T, 'date', 'yyyy-MM-dd')).toBe('2026-10-26');
		setPlatformRegional({ defaultTimezone: 'UTC' }); expect(formatWsDate(T, 'datetime', 'yyyy-MM-dd HH:mm')).toBe('2026-10-25 22:30'); expect(new Date(T).toISOString()).toBe('2026-10-25T22:30:00.000Z');
	});
	it('the user\'s own saved zone (provider / marketer preference) beats the platform zone', () => {
		setPlatformRegional({ defaultTimezone: 'Asia/Riyadh' }); TestBed.inject(ProviderPrefsStore).setTimezone('Africa/Cairo');
		expect(providerTimeZone()).toBe('Africa/Cairo'); expect(formatWsDate(T, 'datetime', 'yyyy-MM-dd HH:mm')).toMatch(/^2026-10-26 0[01]:30$/); // Cairo is +02:00/+03:00 depending on the date
		TestBed.inject(ProviderPrefsStore).setTimezone(null); expect(providerTimeZone()).toBe('Asia/Riyadh'); expect(TestBed.inject(ProviderPrefsStore).dateOffset).toBe('+0300');
	});
	it('platform date formats override the page format; time follows', () => {
		setPlatformRegional({ defaultTimezone: 'UTC', dateFormat: 'DD/MM/YYYY' }); expect(formatWsDate(T, 'date', 'yyyy-MM-dd')).toBe('25/10/2026'); expect(formatWsDate(T, 'datetime', 'yyyy/MM/dd HH:mm')).toBe('25/10/2026 22:30');
		setPlatformRegional({ defaultTimezone: 'UTC', dateFormat: 'YYYY-MM-DD' }); expect(formatWsDate(T, 'date', 'yyyy/MM/dd')).toBe('2026-10-25'); expect(formatWsDate(T, 'datetime')).toBe('2026-10-25 22:30');
	});
	it('Hijri (Umm al-Qura) is a real calendar conversion, still in the platform zone and the platform order', () => {
		setPlatformRegional({ defaultTimezone: 'UTC', calendarSystem: 'hijri', dateFormat: 'YYYY-MM-DD' }); const h = formatWsDate('2026-10-25T10:00:00Z', 'date');
		expect(h).toMatch(/^144\d-\d{2}-\d{2}$/); expect(h).not.toBe('2026-10-25');
		setPlatformRegional({ defaultTimezone: 'UTC', calendarSystem: 'hijri', dateFormat: 'DD/MM/YYYY' }); expect(formatWsDate('2026-10-25T10:00:00Z', 'date')).toMatch(/^\d{2}\/\d{2}\/144\d$/);
		expect(formatWsDate('2026-10-25T10:00:00Z', 'datetime')).toMatch(/^\d{2}\/\d{2}\/144\d \d{2}:\d{2}$/);
	});
	it('empty / invalid input shows nothing (never "Invalid Date"); the pipe is the same function and follows a setting change without a reload', () => {
		for (const v of [null, undefined, '', 'not a date']) expect(formatWsDate(v as never)).toBe('');
		const pipe = new WsDatePipe(); setPlatformRegional({ defaultTimezone: 'UTC', dateFormat: 'YYYY-MM-DD' }); expect(pipe.transform(T, 'date')).toBe('2026-10-25');
		setPlatformRegional({ defaultTimezone: 'Asia/Riyadh', dateFormat: 'YYYY-MM-DD' }); expect(pipe.transform(T, 'date')).toBe('2026-10-26'); expect(WsDatePipe.prototype.transform).toBeTypeOf('function');
	});
	it('the app start reads the public settings once, applies them, and a failed or slow read never blocks or breaks the app', async () => {
		const http = TestBed.inject(HttpTestingController); const info = TestBed.inject(PlatformInfoService);
		const p = info.loadOnce(); http.expectOne(`${environment.url_api}/public/settings`).flush({ success: true, data: { defaultTimezone: 'Asia/Riyadh', dateFormat: 'DD/MM/YYYY', calendarSystem: 'hijri', defaultLanguage: 'en', maintenanceBannerEnabled: true, maintenanceBannerText: 'x' } }); await p;
		expect(platformRegional()).toEqual({ timezone: 'Asia/Riyadh', dateFormat: 'DD/MM/YYYY', calendar: 'hijri', language: 'en', currency: 'USD' }); expect(info.banner().enabled).toBe(true);
		const p2 = info.loadOnce(); http.expectOne(`${environment.url_api}/public/settings`).flush('x', { status: 500, statusText: 'x' }); await p2; // resolved, nothing thrown; the previous values stay
		expect(platformRegional().timezone).toBe('Asia/Riyadh');
	});
});
