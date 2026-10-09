import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Progress } from './progress';

// Provider delivery AI review (POST /provider/projects/:id/stages/:stageId/ai-review): advisory only, honest loading/failed/insufficient/ready,
// never a fake result, and the old fake "analysis" theatre in the upload wizard is gone.
const PROJECT = { title: 'مشروع', stages: [], edits: [], messages: [], files: [], conversationId: null,
	deliveries: [{ id: 'd1', stageId: 'st1', status: 'pending', statusText: 'قيد المراجعة', stageTitle: 'مرحلة 1', stageNumber: 1, summary: 'تسليم', files: [], submittedAt: '2026-10-01T10:00:00Z' }] };
const READY = { insufficientData: false, summary: 'ملخص استشاري', alignedPoints: ['نقطة أ'], potentialGaps: ['ثغرة ب'], questionsForReviewer: ['سؤال ج'], contentNotice: 'لم يُقرأ محتوى الملفات' };

describe('provider progress: delivery AI review', () => {
	async function setup(post: () => any) {
		const postSpy = vi.fn(post);
		await TestBed.configureTestingModule({ imports: [Progress], providers: [provideRouter([]),
			{ provide: HttpClient, useValue: { get: vi.fn(() => of({ success: true, data: PROJECT })), post: postSpy } },
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'proj-1' }) } } }] }).compileComponents();
		const f = TestBed.createComponent(Progress); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		const q = (id: string) => el.querySelector(`[data-testid="${id}"]`);
		const click = () => { (q('request-delivery-ai-review') as HTMLButtonElement).click(); f.detectChanges(); };
		return { f, el, q, postSpy, click, c: f.componentInstance };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('nothing is called until the provider presses the button (no auto review, no fake result)', async () => {
		const s = await setup(() => of({ success: true, data: READY }));
		s.c.setTab('delivs'); s.f.detectChanges();
		expect(s.q('request-delivery-ai-review')).toBeTruthy();
		expect(s.postSpy).not.toHaveBeenCalled();
		expect(s.q('delivery-ai-ready')).toBeNull();
	});
	it('loading, then READY shows summary, alignedPoints, potentialGaps and questionsForReviewer, advisory only', async () => {
		const subj = new Subject<any>();
		const s = await setup(() => subj.asObservable());
		s.c.setTab('delivs'); s.f.detectChanges(); s.click();
		expect(s.q('delivery-ai-loading')!.textContent).toContain('جارٍ التحليل');
		subj.next({ success: true, data: READY }); subj.complete(); s.f.detectChanges();
		expect((s.postSpy.mock.calls[0] as any[])[0]).toContain('/provider/projects/proj-1/stages/st1/ai-review');
		expect(s.q('delivery-ai-summary')!.textContent).toContain('ملخص استشاري');
		expect(s.q('delivery-ai-aligned')!.textContent).toContain('نقطة أ');
		expect(s.q('delivery-ai-gaps')!.textContent).toContain('ثغرة ب');
		expect(s.q('delivery-ai-questions')!.textContent).toContain('سؤال ج');
		expect(s.el.textContent).not.toMatch(/\d\s*%|ثقة/);
	});
	it('failed (503 not configured / error): "تعذر تشغيل التحليل حاليًا" + retry, no result', async () => {
		const s = await setup(() => throwError(() => ({ status: 503 })));
		s.c.setTab('delivs'); s.f.detectChanges(); s.click();
		expect(s.q('delivery-ai-failed')!.textContent).toContain('تعذر تشغيل التحليل حاليًا');
		expect(s.q('delivery-ai-ready')).toBeNull();
		(s.q('delivery-ai-retry') as HTMLButtonElement).click();
		expect(s.postSpy).toHaveBeenCalledTimes(2);
	});
	it('insufficient data shows the server message, not a result', async () => {
		const s = await setup(() => of({ success: true, data: { insufficientData: true, message: 'لا توجد ملاحظة تسليم أو ملفات كافية للمراجعة' } }));
		s.c.setTab('delivs'); s.f.detectChanges(); s.click();
		expect(s.q('delivery-ai-empty')!.textContent).toContain('لا توجد ملاحظة تسليم');
		expect(s.q('delivery-ai-ready')).toBeNull();
	});
	it('health helpers keep a real 0 and show "missing" only for null', async () => {
		const s = await setup(() => of({ success: true, data: {} }));
		expect(s.c.aiEarlyDays({ aiInsights: { earlyDays: 0 } })).toBe('0');
		expect(s.c.aiEarlyDays({ aiInsights: { earlyDays: null } })).toBe('—');
		expect(s.c.aiConfidence({ aiInsights: { confidence: null } })).toBe('غير متاح');
	});
	it('upload wizard: no fake scan (no timer/progress, no hardcoded "الهوية" warning, no "10–30 ثانية")', () => {
		const dir = join(process.cwd(), 'src/app/pages/dashboard/provider-overview/projects/active/progress');
		const html = readFileSync(join(dir, 'progress.html'), 'utf8'), ts = readFileSync(join(dir, 'progress.ts'), 'utf8');
		expect(html).not.toContain('10–30');
		expect(html).not.toContain('قراءة الملفات المرفوعة');
		expect(html).not.toContain('up-scan-prog');
		expect(ts).not.toContain('Math.random');
		expect(ts).not.toContain('تطبيق الهوية');
	});
});
