import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient, HttpEventType, HttpResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Progress, deliveryFileProblem, isHttpsLink, DELIVERY_LIMITS } from './progress';

// Delivery files are REAL uploads now: a picked file is uploaded at once and only counts once the server stored it. File names alone are never
// sent; at least one artifact (stored file or https link) is required; 25MB x 5 files.
const PROJECT = { title: 'مشروع', stages: [], edits: [], messages: [], files: [], conversationId: null, deliveries: [] };
const STAGE = { id: 'st1', title: 'المرحلة 1', status: 'in_progress' };
const NOTE = 'تسليم المرحلة الأولى كاملة';
const stored = (name: string) => ({ name, url: `https://res.cloudinary.com/x/image/upload/v1/waseetai/deliveries/p/st1/${name}`, type: 'image/png', size: 1000 });
const file = (name: string, size = 1000) => { const f = new File([new Uint8Array(8)], name, { type: 'image/png' }); Object.defineProperty(f, 'size', { value: size }); return f; };
const pick = (c: Progress, files: File[]) => c.onDeliveryFilesSelected({ target: { files, value: 'x' } } as unknown as Event);

describe('provider progress: real delivery file upload', () => {
	async function setup(onUpload: (name: string) => any = (n) => of(new HttpResponse({ body: { success: true, data: { files: [stored(n)] } } }))) {
		const post = vi.fn((url: string, body: any) => {
			if (url.endsWith('/deliveries/files')) return onUpload((body as FormData).get('files') instanceof File ? ((body as FormData).get('files') as File).name : '');
			return of({ success: true, data: { id: 'd1' } });
		});
		await TestBed.configureTestingModule({ imports: [Progress], providers: [provideRouter([]),
			{ provide: HttpClient, useValue: { get: vi.fn(() => of({ success: true, data: PROJECT })), post } },
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'proj-1' }) } } }] }).compileComponents();
		const f = TestBed.createComponent(Progress); f.detectChanges();
		const c = f.componentInstance; c.openDelivery(STAGE); f.detectChanges();
		return { f, c, post, el: f.nativeElement as HTMLElement, uploads: () => post.mock.calls.filter(x => String(x[0]).endsWith('/deliveries/files')), submits: () => post.mock.calls.filter(x => String(x[0]).endsWith('/stages/st1/deliveries')) };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('client-side rules mirror the server: 25MB, allowed types, no empty files; https links only', () => {
		expect(DELIVERY_LIMITS).toEqual({ maxFileBytes: 25 * 1024 * 1024, maxFiles: 5, maxLinks: 5 });
		expect(deliveryFileProblem({ name: 'a.png', size: 1000 })).toBeNull();
		expect(deliveryFileProblem({ name: 'a.zip', size: 25 * 1024 * 1024 })).toBeNull();
		expect(deliveryFileProblem({ name: 'a.zip', size: 25 * 1024 * 1024 + 1 })).toMatch(/25MB/);
		expect(deliveryFileProblem({ name: 'design.psd', size: 10 })).toMatch(/ZIP/);
		expect(deliveryFileProblem({ name: 'run.exe', size: 10 })).toMatch(/غير مدعوم/);
		expect(deliveryFileProblem({ name: 'a.png', size: 0 })).toMatch(/فارغ/);
		expect(isHttpsLink('https://www.figma.com/file/abc')).toBe(true);
		for (const bad of ['http://x.com/a', 'logo.png', 'javascript:alert(1)', 'https://user:p@x.com', 'https://localhost/x', '']) expect(isHttpsLink(bad)).toBe(false);
	});

	it('picking a file really uploads it (multipart to /deliveries/files); only after the server answers does it count as an artifact', async () => {
		const subj = new Subject<any>();
		const s = await setup(() => subj.asObservable());
		pick(s.c, [file('logo.png')]);
		expect(s.uploads()).toHaveLength(1);
		expect(String(s.uploads()[0][0])).toContain('/provider/projects/proj-1/stages/st1/deliveries/files');
		expect((s.uploads()[0][1] as FormData).get('files')).toBeInstanceOf(File);
		expect(s.c.deliveryUploads()[0].status).toBe('uploading');
		expect(s.c.deliveryArtifacts().files).toHaveLength(0); // not an artifact yet
		s.c.deliveryNote = NOTE;
		expect(s.c.deliveryBlocker()).toBe('انتظر اكتمال رفع الملفات');
		subj.next(new HttpResponse({ body: { success: true, data: { files: [stored('logo.png')] } } })); subj.complete();
		expect(s.c.deliveryUploads()[0].status).toBe('done');
		expect(s.c.deliveryArtifacts().files).toEqual([stored('logo.png')]);
		expect(s.c.deliveryReady()).toBe(true);
	});

	it('a failed upload shows the server message and never counts as an artifact', async () => {
		const s = await setup(() => throwError(() => ({ status: 415, error: { message: 'نوع الملف غير مسموح به' } })));
		pick(s.c, [file('logo.png')]); s.c.deliveryNote = NOTE;
		expect(s.c.deliveryUploads()[0]).toMatchObject({ status: 'error', error: 'نوع الملف غير مسموح به' });
		expect(s.c.deliveryArtifacts().files).toHaveLength(0);
		expect(s.c.deliveryBlocker()).toMatch(/ملفاً واحداً على الأقل/);
	});

	it('refuses invalid files before any request: too big, unsupported type, and the 6th file', async () => {
		const s = await setup();
		pick(s.c, [file('big.zip', 26 * 1024 * 1024), file('tool.exe')]);
		expect(s.uploads()).toHaveLength(0);
		expect(s.c.deliveryFileError()).toMatch(/25MB/);
		pick(s.c, ['1', '2', '3', '4', '5', '6'].map(n => file(`f${n}.png`)));
		expect(s.uploads()).toHaveLength(5);
		expect(s.c.deliveryFileError()).toMatch(/الحد الأقصى 5/);
	});

	it('no artifact => cannot continue and cannot submit; a note alone, or file names alone, are not enough', async () => {
		const s = await setup();
		s.c.deliveryNote = NOTE;
		expect(s.c.deliveryBlocker()).toMatch(/ملفاً واحداً على الأقل/);
		s.c.deliveryLinks = 'logo-final.png\nbrand.zip'; // names, not links
		expect(s.c.deliveryBlocker()).toMatch(/https/);
		s.c.submitDelivery();
		expect(s.submits()).toHaveLength(0);
		expect(s.c.error()).toMatch(/https/);
		s.c.startAiCheck();
		expect(s.c.deliveryStep()).toBe(1); // cannot move to the review step
	});

	it('an https delivery link alone is a valid artifact; http / junk lines block', async () => {
		const s = await setup();
		s.c.deliveryNote = NOTE;
		s.c.deliveryLinks = 'http://example.com/a.zip';
		expect(s.c.deliveryBlocker()).toMatch(/https/);
		s.c.deliveryLinks = 'https://www.figma.com/file/abc\nhttps://www.figma.com/file/abc';
		expect(s.c.deliveryReady()).toBe(true);
		expect(s.c.deliveryArtifacts().links).toEqual(['https://www.figma.com/file/abc']);
		s.c.deliveryLinks = Array.from({ length: 6 }, (_v, i) => `https://example.com/${i}`).join('\n');
		expect(s.c.deliveryBlocker()).toMatch(/الحد الأقصى 5/);
	});

	it('submit sends the stored file descriptors (url/name/type/size) and https links — never bare names', async () => {
		const s = await setup();
		pick(s.c, [file('logo.png')]); s.c.deliveryNote = NOTE; s.c.deliveryLinks = 'https://www.figma.com/file/abc';
		s.c.submitDelivery();
		expect(s.submits()).toHaveLength(1);
		const payload = s.submits()[0][1] as { note: string; files: any[] };
		expect(payload.note).toBe(NOTE);
		expect(payload.files).toEqual([stored('logo.png'), 'https://www.figma.com/file/abc']);
		expect(payload.files.every(f => typeof f === 'string' ? f.startsWith('https://') : !!f.url)).toBe(true);
	});

	it('removing a file mid-upload cancels it and it never becomes an artifact', async () => {
		const subj = new Subject<any>();
		const s = await setup(() => subj.asObservable());
		pick(s.c, [file('logo.png')]);
		const id = s.c.deliveryUploads()[0].id;
		s.c.removeDeliveryFile(new Event('click'), id);
		expect(s.c.deliveryUploads()).toHaveLength(0);
		expect(subj.observed).toBe(false); // unsubscribed
		expect(s.c.deliveryArtifacts().files).toHaveLength(0);
	});

	it('UI: the continue button is disabled with the reason shown until a real artifact + note exist; the misleading "500MB" text is gone', async () => {
		const s = await setup();
		const btn = () => s.el.querySelector('.up-submit-row .up-btn-pri') as HTMLButtonElement;
		s.f.detectChanges();
		expect(btn().disabled).toBe(true);
		expect(s.el.querySelector('[data-testid="delivery-blocker"]')!.textContent).toMatch(/ملفاً واحداً على الأقل/);
		const type = (name: string, value: string) => { const ta = s.el.querySelector(`textarea[name="${name}"]`) as HTMLTextAreaElement; ta.value = value; ta.dispatchEvent(new Event('input')); };
		type('note', NOTE); type('files', 'https://example.com/a'); s.f.detectChanges(); await s.f.whenStable(); s.f.detectChanges();
		expect(btn().disabled).toBe(false);
		expect(s.el.querySelector('[data-testid="delivery-blocker"]')).toBeNull();
		const html = readFileSync(join(__dirname, 'progress.html'), 'utf8');
		expect(html).not.toContain('500MB');
		expect(html).toContain('25MB');
		expect(readFileSync(join(__dirname, 'progress.ts'), 'utf8')).not.toMatch(/deliverySelectedFiles|next\.push\(\{ name: f\.name/);
	});
});
