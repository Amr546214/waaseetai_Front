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
		['"إليك" and "أنصحك"', 'إليك صياغة محسنة، أنصحك بها: أحتاج إلى متجر إلكتروني لبيع الملابس.'],
		['markdown "***"', '***أحتاج إلى متجر إلكتروني لبيع الملابس*** يدعم الدفع وإدارة المخزون.'],
		['markdown headings and bullets', '## الوصف\n- متجر ملابس\n- دفع إلكتروني'],
	] as const) {
		it(`a reply with ${label} is shown as written and goes into the description once accepted; the title never changes`, () => {
			c.title.set(TITLE); c.description.set(DRAFT);
			c.triggerAiDescription();
			fire('ai:description_chunk', { chunk: reply }); fire('ai:description_complete', { fullText: reply });
			expect(c.showAiSuggest()).toBe(true);
			expect(c.aiStreamText()).toBe(reply);
			expect(c.description()).toBe(DRAFT); // still the client's until they accept the preview
			c.useAiSuggest();
			expect(c.description()).toBe(reply);
			expect(c.title()).toBe(TITLE);
		});
	}

	it('a reply longer than 2000 never takes the description past 2000', () => {
		c.title.set(TITLE); c.description.set(DRAFT);
		c.triggerAiDescription();
		const long = 'ا'.repeat(2600);
		fire('ai:description_chunk', { chunk: long }); fire('ai:description_complete', { fullText: long });
		expect(c.aiStreamText().length).toBe(2000);
		c.useAiSuggest();
		expect(c.description().length).toBe(2000);
	});

	it('an empty reply changes nothing and shows an error', () => {
		c.title.set(TITLE); c.description.set(DRAFT);
		c.triggerAiDescription();
		fire('ai:description_complete', { fullText: '   ' });
		expect(c.description()).toBe(DRAFT);
		expect(c.showAiSuggest()).toBe(false);
		expect(toast()).toContain('بقي وصفك كما كتبته');
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

		it('the "تحسين وصياغة AI" button is visible and looks/behaves normal; "اقترح لي" does not exist', () => {
			const el = render();
			const b = btn(el);
			expect(b).toBeTruthy();
			expect(b.textContent).toContain('تحسين وصياغة AI');
			expect(b.disabled).toBe(false);
			expect(b.className).not.toContain('opacity-50');
			expect(b.className).not.toContain('pointer-events-none');
			expect(el.textContent).not.toContain('اقترح لي');
		});

		for (const [label, title, description] of [
			['an empty form', '', ''],
			['a short description', TITLE, 'متجر ملابس'],
			['an incomplete title', 'مشروع', DRAFT],
		] as const) {
			it(`pressing it with ${label} shows the "write it first" message: no socket, no field change`, () => {
				c.title.set(title); c.description.set(description);
				const el = render();
				btn(el).click();
				expect(toast()).toBe('اكتب عنوان الطلب ووصفه أولًا، ثم استخدم تحسين الصياغة.');
				expect(ioMock).not.toHaveBeenCalled();
				expect(c.title()).toBe(title); expect(c.description()).toBe(description);
				expect(c.showAiSuggest()).toBe(false);
			});
		}

		it('the description is limited to 2000 characters: maxlength on the field, and typed/pasted text is clamped', () => {
			const el = render();
			const ta = el.querySelector('#f-desc') as HTMLTextAreaElement;
			expect(ta.getAttribute('maxlength')).toBe('2000');
			expect((el.querySelector('#f-title') as HTMLInputElement).getAttribute('maxlength')).toBe('80');
			ta.value = 'ا'.repeat(2500); ta.dispatchEvent(new Event('input'));
			expect(c.description().length).toBe(2000);
			c.setDescription('ب'.repeat(5000)); expect(c.description().length).toBe(2000);
			c.setTitle('ت'.repeat(200)); expect(c.title().length).toBe(80);
		});

		it('the counter shows current / 2000, e.g. 91 / 2000', () => {
			c.description.set('ا'.repeat(91));
			const el = render();
			expect(el.querySelector('#desc-count')?.textContent?.trim()).toBe('91 / 2000');
		});

		it('enabled with a sufficient title and description: the press calls the rewrite', () => {
			c.title.set(TITLE); c.description.set(DRAFT);
			const el = render();
			expect(btn(el).disabled).toBe(false);
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
