import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NewProject } from './new-project';
import { NewProjectService } from '../../../../../core/services/new-project.service';
import { ProviderApiService } from '../../../../../core/services/provider-api.service';
import { SkillsCatalogService } from '../../../../../core/services/skills-catalog.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { checkAiSuggestions, PROJECT_DESC_MAX } from './ai-description';

// G1: one AI button, results as separate cards (never in the field), limit enforced on the approvable result,
// failure/retry keeps the user's text, stale events ignored by request id.
describe('provider new project: description AI (single action, cards, limit, failure)', () => {
	const TITLE = 'تطوير متجر إلكتروني متكامل';
	const USER_TEXT = 'وصف مبدئي كتبته بنفسي عن متجر إلكتروني يحتاج إلى تحسين وإضافة تفاصيل أكثر';
	let cb: { start?: (d: any) => void; chunk?: (d: any) => void; end?: (d: any) => void };
	let svc: any;

	function mount() {
		cb = {};
		svc = {
			initSocket: vi.fn(),
			onStreamStart: vi.fn((f: any) => { cb.start = f; }), onStreamChunk: vi.fn((f: any) => { cb.chunk = f; }), onStreamEnd: vi.fn((f: any) => { cb.end = f; }),
			streamSuggestText: vi.fn(), streamEnhanceDescription: vi.fn(), cancelStream: vi.fn(), disconnectSocket: vi.fn(),
			publishService: vi.fn(() => of({ success: true })), updateService: vi.fn(() => of({ success: true })),
			suggestMilestones: vi.fn(() => of({ success: true, data: { milestones: [] } })),
		};
		TestBed.configureTestingModule({
			imports: [NewProject],
			providers: [
				provideRouter([]),
				{ provide: NewProjectService, useValue: svc },
				{ provide: ProviderApiService, useValue: { getPassedSpecialties: () => of({ success: true, categories: [], registered: [] }), getAccreditationSamples: () => of({ success: true, data: [] }) } },
				{ provide: SkillsCatalogService, useValue: { getCatalog: () => of({ success: true, data: { skills: [] } }), getProviderMine: () => of({ success: true, data: { skills: [], specialties: [] } }) } },
			],
		});
		const page = TestBed.createComponent(NewProject);
		page.detectChanges();
		return page;
	}
	const buttons = (page: any) => Array.from((page.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('app-step1-details button'));
	const aiButtons = (page: any) => buttons(page).filter(b => /اقتراح وصف|تحسين بالذكاء|جارٍ توليد|جارٍ تحسين/.test(b.textContent || ''));
	const rid = () => (svc.streamSuggestText.mock.calls.at(-1)?.[1] ?? svc.streamEnhanceDescription.mock.calls.at(-1)?.[2]) as string;
	afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });

	it('shows exactly ONE AI button; empty field -> "اقتراح وصف بالـ AI" (generate from title), text -> "تحسين بالذكاء الاصطناعي" (improve)', () => {
		const page = mount(); const c = page.componentInstance;
		c.projectName.set(TITLE); page.detectChanges();
		expect(aiButtons(page).length).toBe(1);
		expect(aiButtons(page)[0].textContent).toContain('اقتراح وصف بالـ AI');
		aiButtons(page)[0].click(); page.detectChanges();
		// Empty field -> the SAME enhance path, with a seed built from the title (never the suggest path Cloud Run aborts).
		expect(svc.streamSuggestText).not.toHaveBeenCalled();
		expect(svc.streamEnhanceDescription).toHaveBeenCalledTimes(1);
		const [t0, seed0, , seeded0] = svc.streamEnhanceDescription.mock.calls[0];
		expect(t0).toBe(TITLE);
		expect(seed0).toContain(`عنوان المشروع: ${TITLE}`);
		expect(seeded0).toBe(true);

		const page2 = (TestBed.resetTestingModule(), mount()); const c2 = page2.componentInstance;
		c2.projectName.set(TITLE); c2.projectDesc.set(USER_TEXT); page2.detectChanges();
		expect(aiButtons(page2).length).toBe(1);
		expect(aiButtons(page2)[0].textContent).toContain('تحسين بالذكاء الاصطناعي');
		aiButtons(page2)[0].click();
		expect(svc.streamEnhanceDescription).toHaveBeenCalledTimes(1);
		expect(svc.streamEnhanceDescription.mock.calls[0][1]).toBe(USER_TEXT);
		expect(svc.streamEnhanceDescription.mock.calls[0][3]).toBeUndefined();
		expect(svc.streamSuggestText).not.toHaveBeenCalled();
	});

	it('empty-field seed states only what the user provided + the no-invention rule; it is never written into the field, not even transiently', () => {
		const page = mount(); const c = page.componentInstance;
		c.projectName.set(TITLE);
		c.selectedSkills.set(['React', 'Node.js']); c.totalAmount.set(800);
		const seen: string[] = [];
		const ta = (page.nativeElement as HTMLElement).querySelector('#np-desc') as HTMLTextAreaElement;
		page.detectChanges();
		aiButtons(page)[0].click();
		seen.push(c.projectDesc(), ta?.value ?? '');
		const seed: string = svc.streamEnhanceDescription.mock.calls[0][1];
		expect(seed).toContain('البيانات المقدمة:');
		expect(seed).toContain('المهارات: React، Node.js');
		expect(seed).toContain('الميزانية الإجمالية: 800 دولار');
		expect(seed).not.toContain('المدة الإجمالية'); // not provided -> not stated
		expect(seed).not.toContain('التصنيف'); // no specialty chosen -> not stated
		expect(seed).toMatch(/لا تضف خبرات أو تقنيات أو أدوات أو مخرجات أو أسعارًا أو مواعيد أو التزامات غير مذكورة/);
		expect(seed).toMatch(/نقطة مفتوحة/);
		cb.chunk!({ chunk: 'نص متدفق', requestId: rid() }); page.detectChanges();
		seen.push(c.projectDesc(), ta?.value ?? '');
		expect(seen.every(v => v === '')).toBe(true);
	});

	it('insufficient context (title under 2 meaningful words, nothing else): clarification, NO request, no text', () => {
		const page = mount(); const c = page.componentInstance;
		const ui = TestBed.inject(UiNotificationService);
		c.projectName.set('متجر'); page.detectChanges();
		aiButtons(page)[0].click();
		expect(svc.streamEnhanceDescription).not.toHaveBeenCalled();
		expect(svc.streamSuggestText).not.toHaveBeenCalled();
		expect(c.isStreamingText()).toBe(false);
		expect(c.projectDesc()).toBe('');
		expect(ui.toasts().some(t => t.kind === 'warning' && t.message.includes('أضف عنوانًا أوضح'))).toBe(true);
		c.projectName.set(''); aiButtons(page)[0].click();
		expect(svc.streamEnhanceDescription).not.toHaveBeenCalled();
		// a thin title WITH other provided data is enough
		c.projectName.set('متجر'); c.selectedSkills.set(['React']); aiButtons(page)[0].click();
		expect(svc.streamEnhanceDescription).toHaveBeenCalledTimes(1);
	});

	it('cards generated from context show the honesty note and unmentioned-specifics warning; improved cards do not', () => {
		const page = mount(); const c = page.componentInstance;
		c.projectName.set(TITLE); page.detectChanges();
		aiButtons(page)[0].click();
		cb.end!({ mode: 'improve', message: 'x', requestId: rid(), candidates: [{ id: 'option-1', text: 'نطوّر متجراً خلال 30 يوماً.', unmentioned: ['30'] }] });
		page.detectChanges();
		const root = page.nativeElement as HTMLElement;
		expect(root.querySelector('[data-testid=ai-honesty-note]')?.textContent).toContain('مقترح مبني على العنوان وبيانات النموذج فقط');
		expect(root.querySelector('[data-testid=ai-unmentioned]')?.textContent).toContain('30');
		c.projectDesc.set(USER_TEXT); page.detectChanges();
		aiButtons(page)[0].click();
		cb.end!({ mode: 'improve', message: 'x', requestId: rid(), candidates: [{ id: 'option-1', text: 'صياغة محسنة.' }] });
		page.detectChanges();
		expect(root.querySelector('[data-testid=ai-honesty-note]')).toBeNull();
	});

	it('streaming text is shown in the suggestions area and NEVER written into the field; the button blocks a second concurrent request', () => {
		const page = mount(); const c = page.componentInstance;
		c.projectName.set(TITLE); c.projectDesc.set(USER_TEXT); page.detectChanges();
		aiButtons(page)[0].click(); page.detectChanges();
		const id = rid();
		cb.start!({ mode: 'improve', requestId: id });
		cb.chunk!({ chunk: 'نص يتدفق ', mode: 'improve', requestId: id });
		cb.chunk!({ chunk: 'الآن', mode: 'improve', requestId: id });
		page.detectChanges();
		expect(c.projectDesc()).toBe(USER_TEXT);
		expect((page.nativeElement as HTMLElement).querySelector('[data-testid=ai-live-text]')?.textContent).toContain('نص يتدفق الآن');
		expect(aiButtons(page)[0].disabled).toBe(true);
		c.aiAssist(); // a stray second call
		expect(svc.streamEnhanceDescription).toHaveBeenCalledTimes(1);
	});

	it('multiple alternatives render as separate cards with counters; applying ONE replaces the description with only that text', () => {
		const page = mount(); const c = page.componentInstance;
		c.projectName.set(TITLE); c.projectDesc.set(USER_TEXT); page.detectChanges();
		aiButtons(page)[0].click();
		const id = rid();
		cb.chunk!({ chunk: 'مقدمة: هنا ثلاث صياغات', requestId: id });
		cb.end!({ mode: 'improve', message: 'تم', requestId: id, limit: 1500, candidates: [
			{ id: 'option-1', text: 'الصياغة الأولى الكاملة.' }, { id: 'option-2', text: 'الصياغة الثانية الكاملة.' }, { id: 'option-3', text: 'الثالثة.' },
		] });
		page.detectChanges();
		const root = page.nativeElement as HTMLElement;
		const cards = root.querySelectorAll('[data-suggestion-id]');
		expect(cards.length).toBe(3);
		expect(root.querySelectorAll('[data-testid=ai-suggestion-count]')[0].textContent!.trim()).toBe(`${'الصياغة الأولى الكاملة.'.length} / 1500`);
		expect(c.projectDesc()).toBe(USER_TEXT); // nothing applied yet, no introduction in the field
		(cards[1].querySelector('[data-testid=ai-use-suggestion]') as HTMLButtonElement).click(); page.detectChanges();
		expect(c.projectDesc()).toBe('الصياغة الثانية الكاملة.');
		expect(c.projectDesc()).not.toContain('مقدمة');
		expect(c.aiAppliedId()).toBe('option-2');
	});

	it('limit: an over-limit candidate is never offered or approvable; with none valid it is an honest error and the field is untouched', () => {
		const page = mount(); const c = page.componentInstance;
		c.projectName.set(TITLE); c.projectDesc.set(USER_TEXT); page.detectChanges();
		aiButtons(page)[0].click();
		const id = rid();
		cb.end!({ mode: 'improve', message: 'تم', requestId: id, candidates: [{ id: 'option-1', text: 'أ'.repeat(PROJECT_DESC_MAX + 1) }] });
		page.detectChanges();
		expect(c.aiSuggestions().length).toBe(0);
		expect(c.aiStreamError()).toContain('تجاوز الاقتراح الحد المسموح');
		expect(c.projectDesc()).toBe(USER_TEXT);
		c.useAiSuggestion('option-1');
		expect(c.projectDesc()).toBe(USER_TEXT);
		expect(checkAiSuggestions([{ id: 'a', text: 'ب'.repeat(PROJECT_DESC_MAX) }, { id: 'b', text: 'ب'.repeat(PROJECT_DESC_MAX + 1) }], '').suggestions.map(s => s.id)).toEqual(['a']);
	});

	it('an older backend (no candidates): the whole streamed text is one candidate, still gated by the limit', () => {
		const page = mount(); const c = page.componentInstance;
		c.projectName.set(TITLE); page.detectChanges();
		aiButtons(page)[0].click();
		const id = rid();
		cb.chunk!({ chunk: 'وصف قصير كامل.', requestId: id });
		cb.end!({ mode: 'suggest', message: 'تم', requestId: id });
		expect(c.aiSuggestions().map(s => s.text)).toEqual(['وصف قصير كامل.']);
	});

	it('failure after text streamed: the user text stays exactly as is, live text is dropped, "النص الأصلي محفوظ" is true; retry starts one clean request', () => {
		const page = mount(); const c = page.componentInstance;
		c.projectName.set(TITLE); c.projectDesc.set(USER_TEXT); page.detectChanges();
		aiButtons(page)[0].click();
		const first = rid();
		cb.chunk!({ chunk: 'نص طويل كان يتدفق', requestId: first });
		cb.end!({ mode: 'improve', message: 'تعذر تحسين النص عبر الذكاء الاصطناعي حالياً', error: true, code: 'FAILED', requestId: first });
		page.detectChanges();
		const root = page.nativeElement as HTMLElement;
		expect(c.projectDesc()).toBe(USER_TEXT);
		expect(c.aiStreamPreview()).toBe('');
		expect(root.querySelector('[data-testid=ai-error]')).not.toBeNull();
		expect(root.querySelector('[data-testid=ai-original-preserved]')).not.toBeNull();
		// retry
		const retry = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-testid=ai-error] button'))[0];
		retry.click(); page.detectChanges();
		expect(svc.streamEnhanceDescription).toHaveBeenCalledTimes(2);
		const second = rid();
		expect(second).not.toBe(first);
		cb.chunk!({ chunk: 'جديد', requestId: second });
		expect(c.aiStreamPreview()).toBe('جديد'); // no duplicated text from the failed attempt
		expect(c.aiStreamError()).toBeNull();
	});

	it('"النص الأصلي محفوظ" is NOT shown when there was no original text', () => {
		const page = mount(); const c = page.componentInstance;
		c.projectName.set(TITLE); page.detectChanges();
		aiButtons(page)[0].click();
		cb.end!({ mode: 'suggest', message: 'تعذر توليد النص', error: true, code: 'FAILED', requestId: rid() });
		page.detectChanges();
		expect((page.nativeElement as HTMLElement).querySelector('[data-testid=ai-error]')).not.toBeNull();
		expect((page.nativeElement as HTMLElement).querySelector('[data-testid=ai-original-preserved]')).toBeNull();
		expect((page.nativeElement as HTMLElement).textContent).not.toContain('نصّك الأصلي محفوظ');
	});

	it('stale events (old request id, or no request in flight) are ignored', () => {
		const page = mount(); const c = page.componentInstance;
		c.projectName.set(TITLE); c.projectDesc.set(USER_TEXT); page.detectChanges();
		aiButtons(page)[0].click();
		const first = rid();
		cb.end!({ mode: 'improve', message: 'x', error: true, requestId: first }); // first request fails
		aiButtons(page)[0].click(); // second request
		const second = rid();
		cb.chunk!({ chunk: 'قديم', requestId: first });
		cb.end!({ mode: 'improve', message: 'x', requestId: first, candidates: [{ id: 'o', text: 'قديمة.' }] });
		expect(c.aiStreamPreview()).toBe('');
		expect(c.aiSuggestions()).toEqual([]);
		expect(c.isStreamingText()).toBe(true);
		cb.end!({ mode: 'improve', message: 'x', requestId: second, candidates: [{ id: 'o', text: 'حديثة.' }] });
		expect(c.aiSuggestions().map(s => s.text)).toEqual(['حديثة.']);
		cb.chunk!({ chunk: 'متأخر', requestId: second }); // nothing in flight any more
		expect(c.aiStreamPreview()).toBe('');
	});

	it('watchdog: a stream that goes silent is cancelled server-side and ends with an honest error, the field untouched', () => {
		vi.useFakeTimers();
		try {
			const page = mount(); const c = page.componentInstance;
			c.projectName.set(TITLE); c.projectDesc.set(USER_TEXT); page.detectChanges();
			aiButtons(page)[0].click();
			const id = rid();
			cb.chunk!({ chunk: 'بداية', requestId: id });
			vi.advanceTimersByTime(61_000);
			expect(svc.cancelStream).toHaveBeenCalledWith(id);
			expect(c.isStreamingText()).toBe(false);
			expect(c.aiStreamError()).toContain('توقف البث');
			expect(c.projectDesc()).toBe(USER_TEXT);
		} finally { vi.useRealTimers(); }
	});

	it('leaving the page cancels the running request', () => {
		const page = mount(); const c = page.componentInstance;
		c.projectName.set(TITLE); c.projectDesc.set(USER_TEXT); page.detectChanges();
		aiButtons(page)[0].click();
		const id = rid();
		page.destroy();
		expect(svc.cancelStream).toHaveBeenCalledWith(id);
	});

	it('style label is a card badge only: counter, limit and the applied text are label-free (server label and defensive FE parse)', () => {
		const page = mount(); const c = page.componentInstance;
		c.projectName.set(TITLE); c.projectDesc.set(USER_TEXT); page.detectChanges();
		aiButtons(page)[0].click();
		const id = rid();
		const body1 = 'نص الوصف الأول الكامل والواضح.', body2 = 'نص الوصف الثاني الاحترافي.';
		cb.end!({ mode: 'improve', message: 'x', requestId: id, candidates: [
			{ id: 'option-1', label: 'مباشر وواضح', text: body1 },
			{ id: 'option-2', text: `احترافي\n\n${body2}` }, // an unparsed label that slipped through
		] });
		page.detectChanges();
		const root = page.nativeElement as HTMLElement;
		expect(Array.from(root.querySelectorAll('[data-testid=ai-suggestion-label]')).map(e => e.textContent!.trim())).toEqual(['مباشر وواضح', 'احترافي']);
		expect(Array.from(root.querySelectorAll('[data-testid=ai-suggestion-text]')).map(e => e.textContent!.trim())).toEqual([body1, body2]);
		expect(root.querySelectorAll('[data-testid=ai-suggestion-count]')[1].textContent!.trim()).toBe(`${body2.length} / 1500`);
		(root.querySelectorAll('[data-testid=ai-use-suggestion]')[1] as HTMLButtonElement).click();
		expect(c.projectDesc()).toBe(body2);
	});

	it('no success toast when the cards appear (neutral message only); success wording only after a card is applied', () => {
		const page = mount(); const c = page.componentInstance;
		const ui = TestBed.inject(UiNotificationService);
		c.projectName.set(TITLE); c.projectDesc.set(USER_TEXT); page.detectChanges();
		aiButtons(page)[0].click();
		cb.end!({ mode: 'improve', message: '🚀 تم تحسين الوصف باحترافية فائقة', requestId: rid(), candidates: [{ id: 'option-1', text: 'اقتراح كامل.' }] });
		const msgs = ui.toasts().map(t => [t.kind, t.message]);
		expect(msgs.some(m => String(m[1]).includes('تم تحسين الوصف'))).toBe(false);
		expect(msgs.some(m => m[0] === 'success')).toBe(false);
		expect(c.projectDesc()).toBe(USER_TEXT);
		c.useAiSuggestion('option-1');
		expect(ui.toasts().some(t => t.kind === 'success')).toBe(true);
	});
});
