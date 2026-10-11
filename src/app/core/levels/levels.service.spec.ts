import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { LevelsService, LevelsPayload, LevelRow } from './levels.service';

const row = (level: number, name: string, percent: number): LevelRow => ({ level, name, percent, station: Math.ceil(level / 3), color: { dark: '#000000', light: '#FFFFFF' }, thresholds: { points: 0 } });
const payload: LevelsPayload = {
	version: 1, thresholdRule: 'GREATER_OR_EQUAL',
	roles: {
		PROVIDER: { label: 'مقدم الخدمة', percentKind: 'COMMISSION', levels: [row(1, 'مبتدئ', 12.75), row(15, 'مرجع', 8.15)] },
		CLIENT: { label: 'طالب الخدمة', percentKind: 'CASHBACK', levels: [row(1, 'زائر', 1), row(15, 'مؤسسي', 5)] },
		MARKETER: { label: 'الوسيط', percentKind: 'COMMISSION', levels: [row(1, 'مسوق', 1), row(8, 'موجه', 3), row(15, 'رابط مؤسسي', 4.5)] },
	},
	payments: { clientDeposit: { mada: 4.25 }, marketerWithdrawal: { bank_transfer: 8.25, paypal: 7.75, usdt: 4 } },
};

describe('LevelsService (reads the backend tables, invents nothing)', () => {
	let svc: LevelsService; let http: HttpTestingController;
	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
		svc = TestBed.inject(LevelsService); http = TestBed.inject(HttpTestingController);
	});
	afterEach(() => http.verify());

	it('before the table answers: no payload, no range, no level (a page shows nothing, not a typed number)', () => {
		expect(svc.payload()).toBeNull();
		expect(svc.range('MARKETER')()).toBeNull();
		expect(svc.level('MARKETER', 8)).toBeNull();
	});

	it('fetches once, whatever the number of pages that ask; then ranges and levels come from the payload', () => {
		svc.ensureLoaded(); svc.ensureLoaded(); svc.ensureLoaded();
		const req = http.expectOne(r => r.url.endsWith('/levels'));
		req.flush({ success: true, data: payload });
		expect(svc.range('PROVIDER')()).toEqual({ min: 8.15, max: 12.75 });
		expect(svc.range('CLIENT')()).toEqual({ min: 1, max: 5 });
		expect(svc.range('MARKETER')()).toEqual({ min: 1, max: 4.5 });
		expect(svc.level('MARKETER', 8)!.name).toBe('موجه');
		expect(svc.level('MARKETER', 9)).toBeNull();
		expect(svc.payload()!.payments.marketerWithdrawal).toEqual({ bank_transfer: 8.25, paypal: 7.75, usdt: 4 });
	});

	it('a failed request leaves everything empty and allows a later retry', () => {
		svc.ensureLoaded();
		http.expectOne(r => r.url.endsWith('/levels')).flush('x', { status: 500, statusText: 'err' });
		expect(svc.payload()).toBeNull();
		svc.ensureLoaded();
		http.expectOne(r => r.url.endsWith('/levels')).flush({ success: true, data: payload });
		expect(svc.payload()).not.toBeNull();
	});
});
