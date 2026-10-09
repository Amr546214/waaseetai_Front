import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminAiService } from './admin-ai.service';
import { environment } from '../../../environments/environment';

describe('AdminAiService', () => {
	let svc: AdminAiService; let http: HttpTestingController;
	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
		svc = TestBed.inject(AdminAiService); http = TestBed.inject(HttpTestingController);
	});
	afterEach(() => http.verify());

	const cases = [['forecast-summary', 'getForecastSummary'], ['anomaly-summary', 'getAnomalySummary'], ['sentiment-summary', 'getSentimentSummary']] as const;
	for (const [path, fn] of cases) {
		it(`${fn} GETs /admin/ai/${path} and unwraps data`, () => {
			let out: any;
			(svc as any)[fn]().subscribe((r: any) => (out = r));
			const req = http.expectOne(`${environment.url_api}/admin/ai/${path}`);
			expect(req.request.method).toBe('GET');
			req.flush({ success: true, data: { status: 'READY', source: 'GEMINI' } });
			expect(out).toEqual({ result: { status: 'READY', source: 'GEMINI' }, failed: false });
		});
		it(`${fn} maps an HTTP error to a failed state (no throw)`, () => {
			let out: any; let err: any;
			(svc as any)[fn]().subscribe({ next: (r: any) => (out = r), error: (e: any) => (err = e) });
			http.expectOne(`${environment.url_api}/admin/ai/${path}`).flush({ message: 'x' }, { status: 500, statusText: 'err' });
			expect(err).toBeUndefined();
			expect(out).toEqual({ result: null, failed: true });
		});
	}
});
