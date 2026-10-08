import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CreateRequest, resetCreateRequestPageLoadState } from './create-request';

// "تحسين وصياغة AI" rewrites what the client wrote: it never writes the title/description, never calls the AI without enough input,
// and never puts a bad reply (assistant chatter, markdown, invented numbers) into the form.
const sockets: any[] = [];
const ioMock = vi.hoisted(() => vi.fn());
vi.mock('socket.io-client', () => ({ io: ioMock }));

const TITLE = 'تطوير متجر إلكتروني متكامل';
const DRAFT = 'أحتاج متجرًا إلكترونيًا لبيع الملابس يدعم الدفع عبر الإنترنت وإدارة المخزون ولوحة تحكم للطلبات';
const REWRITE = 'أحتاج إلى متجر إلكتروني لبيع الملابس يدعم الدفع عبر الإنترنت وإدارة المخزون، مع لوحة تحكم لمتابعة الطلبات.';

describe('create-request: AI refine is rewriting only', () => {
	let c: CreateRequest;
	const socket = () => sockets[sockets.length - 1];
	const fire = (event: string, data?: any) => socket().handlers[event]?.(data);

	beforeEach(async () => {
		sockets.length = 0;
		ioMock.mockReset();
		ioMock.mockImplementation(() => {
			const s: any = { handlers: {} as Record<string, (d?: any) => void>, emit: vi.fn(), off: vi.fn(), on(e: string, h: any) { this.handlers[e] = h; }, disconnect: vi.fn() };
			sockets.push(s);
			return s;
		});
		sessionStorage.clear();
		resetCreateRequestPageLoadState();
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} });
		await TestBed.configureTestingModule({
			imports: [CreateRequest],
			providers: [provideRouter([]), { provide: HttpClient, useValue: { get: () => of({ success: false }), post: () => of({ success: false }) } }],
		}).compileComponents();
		const f = TestBed.createComponent(CreateRequest);
		await f.whenStable();
		fixtureRef = f;
		c = f.componentInstance;
	});
	afterEach(() => { TestBed.resetTestingModule(); vi.unstubAllGlobals(); });

	const toast = () => c.toast()?.msg ?? '';
	let fixtureRef: any;
	const render = () => { c.currentStep.set(3); fixtureRef.detectChanges(); return fixtureRef.nativeElement as HTMLElement; };

	it('empty title and description: no AI call, no socket, nothing written, clear message', () => {
		c.triggerAiDescription();
		expect(ioMock).not.toHaveBeenCalled();
		expect(c.title()).toBe(''); expect(c.description()).toBe('');
		expect(c.showAiSuggest()).toBe(false);
		expect(toast()).toBe('اكتب عنوان الطلب ووصفه أولًا، ثم استخدم تحسين الصياغة.');
	});

	it('a title without a description, or a very short description, does not call the AI', () => {
		c.title.set(TITLE); c.triggerAiDescription();
		c.description.set('متجر ملابس'); c.triggerAiDescription();
		c.description.set('كلمة كلمة كلمة كلمة كلمة كلمة'); c.triggerAiDescription();
		expect(ioMock).not.toHaveBeenCalled();
		expect(c.description()).toBe('كلمة كلمة كلمة كلمة كلمة كلمة');
		expect(c.title()).toBe(TITLE);
	});

	it('a description without a meaningful title does not call the AI', () => {
		c.description.set(DRAFT); c.triggerAiDescription();
		c.title.set('مشروع جديد'); c.triggerAiDescription();
		expect(ioMock).not.toHaveBeenCalled();
	});

	it('enough input: asks the AI to rewrite the client\'s own description and offers only the restated text', () => {
		c.title.set(TITLE); c.description.set(DRAFT);
		c.triggerAiDescription();
		expect(ioMock).toHaveBeenCalledTimes(1);
		const [event, payload] = socket().emit.mock.calls[0];
		expect(event).toBe('ai:generate_description');
		expect(payload.existingDescription).toBe(DRAFT);
		expect(payload.projectTitle).toBe(TITLE);
		expect(c.aiMode()).toBe('refine');
		fire('ai:description_chunk', { chunk: REWRITE }); fire('ai:description_complete', { fullText: REWRITE });
		expect(c.aiStreamText()).toBe(REWRITE);
		expect(c.description()).toBe(DRAFT); // nothing is replaced until the client accepts
		c.useAiSuggest();
		expect(c.description()).toBe(REWRITE);
		expect(c.title()).toBe(TITLE); // the title is never rewritten by AI
	});

	for (const [label, reply] of [
		['"يبدو أنك"', 'يبدو أنك قمت بنسخ نص يحتوي على خيارات سابقة. أحتاج متجرًا إلكترونيًا لبيع الملابس.'],
		['"إليك"', 'إليك صياغة محسنة: أحتاج إلى متجر إلكتروني لبيع الملابس يدعم الدفع وإدارة المخزون.'],
		['"***"', '***أحتاج إلى متجر إلكتروني لبيع الملابس*** يدعم الدفع عبر الإنترنت وإدارة المخزون.'],
		['an invented budget', 'أحتاج إلى متجر إلكتروني لبيع الملابس يدعم الدفع عبر الإنترنت وإدارة المخزون بميزانية 5000 دولار.'],
	] as const) {
		it(`a reply with ${label} is not put in the fields and the original text stays`, () => {
			c.title.set(TITLE); c.description.set(DRAFT);
			c.triggerAiDescription();
			fire('ai:description_chunk', { chunk: reply }); fire('ai:description_complete', { fullText: reply });
			expect(c.description()).toBe(DRAFT);
			expect(c.title()).toBe(TITLE);
			expect(c.aiStreamText()).toBe('');
			expect(c.showAiSuggest()).toBe(false);
			expect(toast()).toContain('بقي وصفك كما كتبته');
		});
	}

	it('a bad text can never be applied, even if it reached the preview', () => {
		c.title.set(TITLE); c.description.set(DRAFT);
		c.aiStreamText.set('يبدو أنك قمت بنسخ نص. أحتاج متجرًا إلكترونيًا لبيع الملابس.');
		c.useAiSuggest();
		expect(c.description()).toBe(DRAFT);
	});

	it('AI failure: the original text stays and the error is shown', () => {
		c.title.set(TITLE); c.description.set(DRAFT);
		c.triggerAiDescription();
		fire('ai:description_error', { message: 'تعذرت إعادة الصياغة من خدمة الذكاء الاصطناعي، وبقي وصفك كما كتبته. حاول مرة أخرى.' });
		expect(c.description()).toBe(DRAFT);
		expect(c.title()).toBe(TITLE);
		expect(c.showAiSuggest()).toBe(false);
		expect(toast()).toContain('بقي وصفك كما كتبته');
	});

	it('the button no longer offers a generate-from-scratch label', async () => {
		const { readFileSync } = await import('node:fs');
		const html = readFileSync('src/app/pages/dashboard/clients-overview/create-request/components/step3-details/step3-details.html', 'utf8');
		expect(html).not.toMatch(/<span>\s*اقتراح AI\s*<\/span>/);
		expect(html).toContain('تحسين وصياغة AI');
	});

	it('"اقترح لي" is gone: step 1 has no AI banner/button and nothing in create-request calls a generate-from-scratch endpoint', async () => {
		const { readFileSync, readdirSync, statSync } = await import('node:fs');
		const root = 'src/app/pages/dashboard/clients-overview/create-request';
		const files: string[] = [];
		const walk = (d: string) => readdirSync(d).forEach(f => { const q = `${d}/${f}`; statSync(q).isDirectory() ? walk(q) : (/\.(ts|html)$/.test(f) && !f.endsWith('.spec.ts') && files.push(q)); });
		walk(root);
		const all = files.map(f => readFileSync(f, 'utf8')).join('\n');
		const step1 = readFileSync(`${root}/components/step1-specialty/step1-specialty.html`, 'utf8');
		expect(step1).not.toContain('اقترح لي');
		expect(step1).not.toContain('اقتراح بالذكاء الاصطناعي');
		expect(step1).not.toContain('ai-sug-banner');
		for (const gone of ['applyAISuggestion', 'showAIBanner', 'aiSuggest', '/ai-suggest', 'project-description']) expect(all).not.toContain(gone);
		// the only AI call left is the rewrite socket event
		expect(all.match(/ai:generate_description/g)?.length).toBe(1);
		const api = readFileSync('src/app/core/services/project-api.service.ts', 'utf8');
		expect(api).not.toContain('ai-suggest');
	});

	describe('step 3 UI: counters and the refine button state', () => {
		const btn = (el: HTMLElement) => el.querySelector('[data-testid=ai-refine-btn]') as HTMLButtonElement;

		it('the counters read used / max (left-to-right isolated), for title, description and outputs', () => {
			c.title.set('تطوير متجر'); c.description.set('وصف قصير');
			const el = render();
			expect(el.querySelector('#title-count')?.textContent?.trim()).toBe('10 / 80');
			expect(el.querySelector('#desc-count')?.textContent?.trim()).toBe('8 / 2000');
			expect(el.querySelector('#title-count')?.getAttribute('dir')).toBe('ltr');
			expect(el.querySelector('#desc-count')?.getAttribute('dir')).toBe('ltr');
			expect(el.querySelector('#outputs-count')?.getAttribute('dir')).toBe('ltr');
		});

		it('the button is really disabled with an empty form, a short description, or an incomplete title', () => {
			let el = render();
			expect(btn(el).disabled).toBe(true);
			c.title.set(TITLE); c.description.set('متجر ملابس'); el = render();
			expect(btn(el).disabled).toBe(true);
			c.title.set('مشروع'); c.description.set(DRAFT); el = render();
			expect(btn(el).disabled).toBe(true);
		});

		it('disabled: the hint shows on hover (title) and a press shows the message, with no socket and no field change', () => {
			c.title.set(TITLE); c.description.set('متجر ملابس');
			const el = render();
			const wrap = el.querySelector('[data-testid=ai-refine-wrap]') as HTMLElement;
			expect(wrap.getAttribute('title')).toBe('اكتب عنوان الطلب ووصفه أولًا، ثم استخدم تحسين الصياغة.');
			wrap.click(); // a disabled button swallows the click; the wrapper receives it
			expect(toast()).toBe('اكتب عنوان الطلب ووصفه أولًا، ثم استخدم تحسين الصياغة.');
			expect(ioMock).not.toHaveBeenCalled();
			expect(c.description()).toBe('متجر ملابس'); expect(c.title()).toBe(TITLE);
		});

		it('enabled with a sufficient title and description: no hint, and the press calls the rewrite', () => {
			c.title.set(TITLE); c.description.set(DRAFT);
			const el = render();
			expect(btn(el).disabled).toBe(false);
			expect((el.querySelector('[data-testid=ai-refine-wrap]') as HTMLElement).getAttribute('title')).toBeNull();
			btn(el).click();
			expect(ioMock).toHaveBeenCalledTimes(1);
			expect(socket().emit.mock.calls[0][1].existingDescription).toBe(DRAFT);
		});

		it('the thresholds are the BE ones: 30 characters and 6 words', () => {
			c.title.set(TITLE);
			c.description.set('ثلاثون حرفا تماما هنا ولكن كلمات قليلة جدا'); // < 6 words check below
			expect(c.canRefineWithAi()).toBe(true); // 8 words, > 30 chars
			c.description.set('أ ب ج د هـ و ز'); expect(c.canRefineWithAi()).toBe(false); // 7 one-letter words, < 30 chars
			c.description.set('كلمة طويلة جدا جدا جدا جدا جدا جدا'); expect(c.canRefineWithAi()).toBe(true);
			c.description.set('كلماتطويلةجداجداجداجداجداجداجداجداجدا'); expect(c.canRefineWithAi()).toBe(false); // 1 word
		});
	});
});
