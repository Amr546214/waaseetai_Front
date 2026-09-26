import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { DisputeDetails } from './dispute-details';
import { DISPUTES_MOCK } from '../disputes.mock';

// Final residual AI cleanup batch: the dispute-details page previously
// rendered a full fabricated "AI adjudication" apparatus — a fake AI
// confidence score, AI-authored arguments for/against each party, AI-assigned
// fault percentages, a fictional "وسيط AI" dispute-analyst party, and
// AI-attributed history/evidence entries — even though dispute.service.ts on
// the backend is a plain manual create -> admin-review -> admin-resolve
// workflow with zero AI/Gemini involvement. These tests prove the fabricated
// fields are gone from both the shared mock data and the page's own logic.

describe('DisputeDetails', () => {
	let component: DisputeDetails;
	let fixture: ComponentFixture<DisputeDetails>;

	async function setup(id: string) {
		await TestBed.configureTestingModule({
			imports: [DisputeDetails],
			providers: [
				provideRouter([]),
				{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id }) } } }
			]
		}).compileComponents();

		fixture = TestBed.createComponent(DisputeDetails);
		component = fixture.componentInstance;
		component.ngOnInit();
	}

	it('should create and find a mock dispute by id', async () => {
		await setup('DSP-2026-014');
		expect(component).toBeTruthy();
		expect(component.dispute()?.id).toBe('DSP-2026-014');
	});

	it('no dispute in the shared mock data carries a fabricated AI confidence/verdict/meter field', () => {
		for (const d of DISPUTES_MOCK) {
			expect((d.detail as any)?.confidencePct).toBeUndefined();
			expect((d.detail as any)?.verdictFor).toBeUndefined();
			expect((d.detail as any)?.verdictAgainst).toBeUndefined();
			expect((d.detail as any)?.meters).toBeUndefined();
		}
	});

	it('no dispute in the shared mock data lists "وسيط AI" as a dispute party', () => {
		for (const d of DISPUTES_MOCK) {
			const partyNames = (d.detail?.parties || []).map((p) => p.name);
			expect(partyNames).not.toContain('وسيط AI');
		}
	});

	it('no history or evidence entry in the shared mock data is attributed to "ai"', () => {
		for (const d of DISPUTES_MOCK) {
			for (const h of d.detail?.history || []) {
				expect((h as any).iconType).not.toBe('ai');
			}
			for (const ev of d.detail?.evidence || []) {
				expect((ev as any).iconType).not.toBe('ai');
				expect((ev as any).source).not.toBe('ai');
			}
		}
	});

	it('historyIconPath no longer has an "ai" case', async () => {
		await setup('DSP-2026-014');
		expect(component.historyIconPath('ai')).toBe('open');
		expect(component.historyIconPath('doc')).toBe('doc');
	});
});
