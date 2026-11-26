import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { New } from './new';
import { ProviderApiService } from '../../../../../../core/services/provider-api.service';
import { ProviderAccessService } from '../../../../../../core/services/provider-access.service';
import { ProviderProfileService } from '../../../../../../core/services/provider-profile.service';

// The accreditation wizard reads every staged proof file with the AI as it is picked: PASS shows the note, a refused file leaves the list with its reason.
describe('accreditation wizard: AI reading of the proof files', () => {
	let verdict: any; const check = vi.fn();
	function mount() {
		check.mockImplementation(() => of({ success: true, data: verdict }));
		TestBed.configureTestingModule({
			imports: [New],
			providers: [
				provideRouter([]),
				{ provide: ProviderApiService, useValue: { getPassedSpecialties: () => of({ success: true, categories: [], registered: [] }), getAccountActionCompletion: vi.fn(() => of({ data: undefined })), deleteAccreditationProof: vi.fn(), submitAccreditationRequest: vi.fn() } },
				{ provide: ProviderProfileService, useValue: { checkPortfolioFile: check } },
				{ provide: ProviderAccessService, useValue: { invalidate: vi.fn(), load: () => of({ state: 'PENDING_REVIEW', canAccessDashboard: false }) } },
				{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
			],
		});
		const f = TestBed.createComponent(New); f.detectChanges(); return f.componentInstance as any;
	}
	afterEach(() => { TestBed.resetTestingModule(); check.mockReset(); });
	const pick = (name: string, type = 'application/pdf') => ({ target: { files: [new File(['hello'], name, { type })], value: '' } });
	const settle = () => new Promise(r => setTimeout(r, 40));

	it('a passing file shows its note and is kept; the check is sent as PROOF', async () => {
		verdict = { verdict: 'PASS', summaryAr: 'قرأ الذكاء الاصطناعي الملف وهو مناسب.' };
		const c = mount(); c.onFileSelected(pick('cv.pdf')); await settle();
		const id = c.attachments()[0].id;
		expect(c.fileChecks()[id]).toEqual({ status: 'valid', message: 'قرأ الذكاء الاصطناعي الملف وهو مناسب.' });
		expect(check.mock.calls[0][0]).toMatchObject({ kind: 'PROOF', fileName: 'cv.pdf', mimeType: 'application/pdf' });
	});

	it('a refused file leaves the list and its reason stays visible; an unavailable check keeps the file', async () => {
		verdict = { verdict: 'FAIL', summaryAr: 'ليس إثباتًا.' };
		const c = mount(); c.onFileSelected(pick('bad.pdf')); await settle();
		expect(c.attachments().length).toBe(0);
		expect(c.refusedFiles()[0].message).toContain('ارفع ملفًا آخر');
		verdict = { verdict: 'UNVERIFIED', summaryAr: 'تعذّر الفحص الآلي حاليًا.' };
		c.onFileSelected(pick('ok.pdf')); await settle();
		expect(c.attachments().length).toBe(1); expect(c.fileChecks()[c.attachments()[0].id].status).toBe('warning');
	});
});
