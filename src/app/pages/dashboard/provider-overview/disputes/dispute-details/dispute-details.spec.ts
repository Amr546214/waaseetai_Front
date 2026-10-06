import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { DisputeDetails } from './dispute-details';
import { of, throwError } from 'rxjs';
import { DISPUTES_MOCK } from '../disputes.test-fixtures';
import { DisputeApiService } from '../../../../../core/services/dispute-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';

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

	const REAL = {
		id: 'real-uuid-1', status: 'UNDER_REVIEW', reason: 'تأخر في التسليم', description: 'وصف حقيقي', evidence: ['https://x.test/files/proof.pdf'],
		createdAt: '2026-09-01T10:00:00.000Z', resolvedAt: null, openedById: 'me', openedBy: { id: 'me', firstName: 'مقدم', lastName: 'خدمة' },
		againstUser: { id: 'c1', firstName: 'عميل', lastName: 'حقيقي' }, request: { id: 'r1', title: 'مشروع حقيقي' },
	};

	async function setup(id: string, api: any = { getProviderDispute: () => of({ success: true, data: REAL }) }) {
		await TestBed.configureTestingModule({
			imports: [DisputeDetails],
			providers: [
				provideRouter([]),
				{ provide: DisputeApiService, useValue: api },
				{ provide: AuthStore, useValue: { currentUser: () => ({ id: 'me' }) } },
				{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id }) } } }
			]
		}).compileComponents();

		fixture = TestBed.createComponent(DisputeDetails);
		component = fixture.componentInstance;
		component.ngOnInit();
	}

	it('reads a real dispute from the provider API and builds the detail only from its real fields', async () => {
		await setup('real-uuid-1');
		expect(component).toBeTruthy();
		const d = component.dispute()!;
		expect(d.id).toBe('real-uuid-1');
		expect(d.title).toBe('تأخر في التسليم');
		expect(d.project).toBe('مشروع حقيقي');
		expect(d.detail?.evidence.map(e => e.name)).toEqual(['proof.pdf']);
		expect(d.detail?.parties.map(p => p.name)).toContain('عميل حقيقي');
		expect(d.detail?.info.some(i => i.value === 'التفاصيل الكاملة غير متاحة')).toBe(true);
		expect(d.teamMember).toBeUndefined();
	});

	it('a 404 shows "not found", a server error shows a retryable error — never a mock dispute', async () => {
		await setup('DSP-2026-014', { getProviderDispute: () => throwError(() => ({ status: 404 })) });
		expect(component.notFound()).toBe(true);
		expect(component.dispute()).toBeNull();
		TestBed.resetTestingModule();
		await setup('x', { getProviderDispute: () => throwError(() => ({ status: 500 })) });
		expect(component.loadError()).toBe(true);
		expect(component.notFound()).toBe(false);
		expect(component.dispute()).toBeNull();
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
