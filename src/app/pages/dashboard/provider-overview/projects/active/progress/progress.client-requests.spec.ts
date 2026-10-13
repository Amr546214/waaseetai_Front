import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Progress } from './progress';

// The provider answers a change request the CLIENT raised: a real call, only for pending client requests, decision recorded only.
const DATA = { projectId: 'project-9', conversationId: 'conv-9', title: 'مشروع', stages: [], edits: [], messages: [], files: [], deliveries: [] };
const AM = (o: Record<string, unknown> = {}) => ({ id: 'c1', projectId: 'project-9', projectTitle: 'مشروع', type: 'BUDGET', title: 'تخفيض', description: 'سبب', budgetDelta: -100, durationDeltaDays: null, status: 'PENDING_OTHER_PARTY', requestedByRole: 'CLIENT', createdAt: '2026-10-01T00:00:00Z', respondedAt: null, conversationId: null, ...o });

describe('provider progress: answering a client change request', () => {
	async function setup(list: any[], postError?: any) {
		const post = vi.fn(() => (postError ? throwError(() => postError) : of({ success: true, data: {} })));
		const get = vi.fn((url: string) => String(url).includes('/amendments') ? of({ success: true, data: list }) : of({ success: true, data: DATA }));
		await TestBed.configureTestingModule({ imports: [Progress], providers: [provideRouter([]), { provide: HttpClient, useValue: { get, post } },
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'contract-1' }) } } }] }).compileComponents();
		const f = TestBed.createComponent(Progress); f.detectChanges();
		const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		const el = f.nativeElement as HTMLElement;
		return { f, c: f.componentInstance, el, get, post, nav, qa: (id: string) => Array.from(el.querySelectorAll(`[data-testid="${id}"]`)) as HTMLElement[] };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('a pending CLIENT request shows who raised it, «بانتظار ردك», approve/reject buttons and the record-only note', async () => {
		const s = await setup([AM()]);
		s.c.openAmendments(); s.f.detectChanges();
		expect(s.qa('amend-from-client')).toHaveLength(1);
		expect(s.qa('amend-status')[0].textContent).toContain('بانتظار ردك');
		expect(s.qa('amend-respond-approve')).toHaveLength(1); expect(s.qa('amend-respond-reject')).toHaveLength(1);
		expect(s.el.textContent).toContain('قرارك يُسجَّل فقط، ولا يتغير السعر أو المدة أو الضمان تلقائيًا');
		expect(s.c.hasPendingAmendment()).toBe(false); // that flag is about MY own requests only
	});

	it('approve / reject call POST /provider/amendments/:id/respond and reload the list; the chat is never opened', async () => {
		const s = await setup([AM()]);
		s.c.openAmendments(); s.f.detectChanges();
		(s.qa('amend-respond-approve')[0] as HTMLButtonElement).click(); s.f.detectChanges();
		expect(s.post).toHaveBeenCalledTimes(1);
		const [url, body] = s.post.mock.calls[0] as unknown as [string, any];
		expect(url).toContain('/provider/amendments/c1/respond'); expect(body).toEqual({ decision: 'approve' });
		expect(s.get.mock.calls.filter(x => String(x[0]).includes('/amendments'))).toHaveLength(2);
		expect(s.nav).not.toHaveBeenCalled();
		s.c.respondAmendment(AM() as any, 'reject');
		expect((s.post.mock.calls[1] as unknown as [string, any])[1]).toEqual({ decision: 'reject' });
	});

	it('already answered client requests and the provider\'s own requests have NO answer buttons, and the labels follow who raised them', async () => {
		const s = await setup([AM({ id: 'c2', status: 'APPROVED' }), AM({ id: 'p1', requestedByRole: 'PROVIDER', status: 'PENDING_OTHER_PARTY' })]);
		s.c.openAmendments(); s.f.detectChanges();
		expect(s.qa('amend-respond-approve')).toHaveLength(0);
		const statuses = s.qa('amend-status').map(e => e.textContent!.trim());
		expect(statuses).toEqual(['وافقت عليه', 'بانتظار رد العميل']);
		s.c.respondAmendment(AM({ id: 'p1', requestedByRole: 'PROVIDER' }) as any, 'approve');
		expect(s.post).not.toHaveBeenCalled();
	});

	it('a failed answer shows the server message', async () => {
		const s = await setup([AM()], { error: { message: 'تم الرد على طلب التعديل هذا مسبقًا' } });
		s.c.openAmendments(); s.f.detectChanges();
		(s.qa('amend-respond-reject')[0] as HTMLButtonElement).click(); s.f.detectChanges();
		expect(s.qa('amend-respond-error')[0].textContent).toContain('مسبقًا');
	});
});
