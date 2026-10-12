import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Progress } from './progress';

// The progress route param may be a contract id; the conversation belongs to the PROJECT. The message context must carry the response's real projectId,
// and the conversation itself is passed explicitly (conversationId) so it is opened exactly.
const DATA = { projectId: 'project-9', conversationId: 'conv-9', title: 'مشروع', stages: [], edits: [], messages: [], files: [], deliveries: [] };

describe('provider project progress: message context', () => {
	afterEach(() => TestBed.resetTestingModule());
	async function setup(data: any) {
		await TestBed.configureTestingModule({ imports: [Progress], providers: [provideRouter([]),
			{ provide: HttpClient, useValue: { get: vi.fn(() => of({ success: true, data })), post: vi.fn() } },
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'contract-id-from-the-route' }) } } }] }).compileComponents();
		const f = TestBed.createComponent(Progress); f.detectChanges();
		return { c: f.componentInstance, nav: vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) };
	}
	it('uses the real projectId from the response (not the route param) and the explicit conversationId', async () => {
		const { c, nav } = await setup(DATA);
		c.openConversation();
		const [cmd, extras] = nav.mock.calls[0] as any[];
		expect(cmd).toEqual(['/provider-overview/messages']);
		expect(extras.queryParams).toEqual({ conversationId: 'conv-9' });
		expect(extras.state.messageContext.projectId).toBe('project-9');
		c.openConversation({ id: 's1', title: 'مرحلة', status: 'in_progress' });
		expect((nav.mock.calls[1] as any[])[1].state.messageContext).toMatchObject({ type: 'STAGE', projectId: 'project-9', stageId: 's1' });
	});
});
