import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Disputes } from './disputes';
import { mapDispute } from './disputes.mapper';
import { DisputeApiService } from '../../../../core/services/dispute-api.service';
import { AuthStore } from '../../../../core/store/auth.store';

// Provider disputes: no escalation (no backend), no mutual-cancellation KPIs (no backend), and "محادثة المشروع" opens ONLY the project's conversation
// (the messages page resolves it by projectId; the dispute itself has no message thread).
const API = (over: Record<string, unknown> = {}) => ({ id: 'd1', requestId: 'req-1', projectId: 'project-9', status: 'OPEN', reason: 'تأخر التسليم', description: 'وصف', createdAt: '2026-10-01T00:00:00Z', openedById: 'me', request: { id: 'req-1', title: 'تصميم هوية' }, ...over });

describe('provider disputes: project actions', () => {
	async function render(items: any[]) {
		await TestBed.configureTestingModule({ imports: [Disputes], providers: [provideRouter([]),
			{ provide: DisputeApiService, useValue: { getProviderDisputes: () => of({ success: true, data: { items, pagination: { page: 1, limit: 50, total: items.length, totalPages: 1 } } }) } },
			{ provide: AuthStore, useValue: { currentUser: () => ({ id: 'me', accountType: 'PROVIDER_INDIVIDUAL' }) } }] }).compileComponents();
		const f = TestBed.createComponent(Disputes); f.detectChanges(); await f.whenStable(); f.detectChanges();
		return { f, el: f.nativeElement as HTMLElement, nav: vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('the dispute carries its real project id (projectId, else requestId, else request.id)', () => {
		expect(mapDispute(API() as any, 'me').projectId).toBe('project-9');
		expect(mapDispute(API({ projectId: null }) as any, 'me').projectId).toBe('req-1');
		expect(mapDispute(API({ projectId: null, requestId: null }) as any, 'me').projectId).toBe('req-1'); // request.id
		expect(mapDispute(API({ projectId: null, requestId: null, request: null }) as any, 'me').projectId).toBeNull();
	});

	it('no "تصعيد" in any state (open, closed) and no showEscalate field anywhere', async () => {
		const { el } = await render([API(), API({ id: 'd2', status: 'RESOLVED' }), API({ id: 'd3', status: 'UNDER_REVIEW' })]);
		expect(el.textContent).not.toContain('تصعيد');
		const mapped = mapDispute(API() as any, 'me') as any;
		expect('showEscalate' in mapped).toBe(false);
		for (const f of ['disputes.html', 'disputes.model.ts', 'disputes.mapper.ts', 'disputes.ts']) expect(readFileSync(join(__dirname, f), 'utf8')).not.toContain('showEscalate');
	});

	it('no mutual-cancellation KPIs ("إلغاء بالتراضي" / "مُغلقة بالتراضي") — there is no backend for them', async () => {
		const { el } = await render([API(), API({ id: 'd2', status: 'RESOLVED' })]);
		expect(el.textContent).not.toContain('بالتراضي');
		expect(el.textContent).not.toContain('الإلغاء');
		expect(el.textContent).not.toContain('طلبات إلغاء');
		expect(el.textContent).toContain('نزاع نشط');
		expect(el.textContent).toContain('قيد المتابعة');
	});

	it('"محادثة المشروع" (not "عرض النقاش"): navigates with the dispute\'s project id as the message context, opening nothing else', async () => {
		const { el, nav } = await render([API()]);
		const btn = el.querySelector('[data-testid="dispute-project-chat"]') as HTMLButtonElement;
		expect(btn.textContent).toContain('محادثة المشروع');
		expect(el.textContent).not.toContain('عرض النقاش');
		expect(el.textContent).not.toContain('متابعة النقاش');
		btn.click();
		const [cmd, extras] = nav.mock.calls[0] as any[];
		expect(cmd).toEqual(['/provider-overview/messages']);
		expect(extras.state.messageContext).toEqual({ type: 'PROJECT', projectId: 'project-9', projectTitle: 'تصميم هوية' });
		expect(extras.queryParams).toBeUndefined(); // no conversation id guessed: the messages page resolves it by project
	});

	it('a dispute without any project id gets no chat button (nothing to open)', async () => {
		const { el } = await render([API({ projectId: null, requestId: null, request: null })]);
		expect(el.querySelector('[data-testid="dispute-project-chat"]')).toBeNull();
	});
});
