import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { environment } from '../../../environments/environment';
import { DEFAULT_SUPPORT_EMAIL, PlatformInfoService } from './platform-info.service';

describe('PlatformInfoService: support address and legal versions come from the public settings, with today\'s literal as the fallback', () => {
	let http: HttpTestingController; let svc: PlatformInfoService;
	beforeEach(() => { TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }); http = TestBed.inject(HttpTestingController); svc = TestBed.inject(PlatformInfoService); });
	const answer = (data: Record<string, unknown>) => { svc.load(); http.expectOne(`${environment.url_api}/public/settings`).flush({ success: true, data }); };

	it('unset: byte-for-byte the previous hard-coded address, no legal version chip', () => {
		expect(DEFAULT_SUPPORT_EMAIL).toBe('support@waseet.ai');
		expect(svc.supportEmail()).toBe('support@waseet.ai');
		answer({ supportEmail: '', termsVersion: '', privacyVersion: '' });
		expect(svc.supportEmail()).toBe('support@waseet.ai'); expect(svc.termsVersion()).toBe(''); expect(svc.privacyVersion()).toBe('');
	});
	it('set: the configured address and versions are used', () => {
		answer({ supportEmail: ' help@x.co ', termsVersion: 'v2', privacyVersion: '3.1' });
		expect(svc.supportEmail()).toBe('help@x.co'); expect(svc.termsVersion()).toBe('v2'); expect(svc.privacyVersion()).toBe('3.1');
	});
});
