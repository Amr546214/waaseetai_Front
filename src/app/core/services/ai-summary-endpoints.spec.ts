import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ClientReportsService } from './client-reports.service';
import { MarketerOverviewService } from './marketer-overview.service';

const RES = { status: 'READY', source: 'GEMINI', score: null, confidence: null, summary: 's', recommendation: null, details: { observations: [], recommendations: [] }, generatedAt: null };

describe('AI summary endpoints', () => {
	beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));
	afterEach(() => TestBed.inject(HttpTestingController).verify());

	it('client reports: GET .../reports/ai-summary?range=', () => {
		const http = TestBed.inject(HttpTestingController);
		let out: any;
		TestBed.inject(ClientReportsService).getAiSummary('6m').subscribe(r => out = r);
		const req = http.expectOne(r => r.url.endsWith('/reports/ai-summary'));
		expect(req.request.method).toBe('GET');
		expect(req.request.params.get('range')).toBe('6m');
		req.flush({ success: true, data: RES });
		expect(out.data.status).toBe('READY');
	});
	it('marketer: GET .../ai-insights returns the AiResult object', () => {
		const http = TestBed.inject(HttpTestingController);
		let out: any;
		TestBed.inject(MarketerOverviewService).getAiInsights().subscribe(r => out = r);
		const req = http.expectOne(r => r.url.endsWith('/ai-insights'));
		expect(req.request.method).toBe('GET');
		req.flush({ success: true, data: RES });
		expect(out.data.summary).toBe('s');
	});
});
