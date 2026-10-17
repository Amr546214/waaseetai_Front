import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { SaMarketingAssets } from './sa-marketing-assets';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../shared/forms/form-spec-utils';
import { environment } from '../../../../../environments/environment';

const A = { id: 'a1', title: 'شعار', description: null, kind: 'IMAGE', fileUrl: 'https://res.cloudinary.com/t/logo.png', fileName: 'logo.png', mimeType: 'image/png', fileBytes: 10, linkUrl: null, text: null, audience: 'MARKETER', active: true, sortOrder: 0, createdAt: '', updatedAt: '' };
const base = `${environment.url_api}/admin/marketing-assets`;

describe('SaMarketingAssets', () => {
	let confirmResult = true;
	function setup() {
		TestBed.configureTestingModule({ imports: [SaMarketingAssets], providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ConfirmModalService, useValue: { confirm: vi.fn(async () => confirmResult) } }] });
		const http = TestBed.inject(HttpTestingController);
		const f = TestBed.createComponent(SaMarketingAssets);
		f.detectChanges();
		http.expectOne((r) => r.url === base).flush({ success: true, data: { items: [A], pagination: { page: 1, limit: 50, total: 1, pages: 1 } } });
		f.detectChanges();
		return { f, c: f.componentInstance, http, el: f.nativeElement as HTMLElement };
	}
	afterEach(() => { TestBed.resetTestingModule(); confirmResult = true; });

	it('lists assets with a working download link', () => {
		const { el } = setup();
		const link = el.querySelector('a.ma-link') as HTMLAnchorElement;
		expect(link.href).toContain('logo.png');
		expect(link.hasAttribute('download')).toBe(true);
	});

	it('disable asks for confirmation, patches active=false, and cancel changes nothing', async () => {
		const { c, http } = setup();
		confirmResult = false;
		await c.toggle(c.items()[0]);
		http.expectNone(`${base}/a1`);
		confirmResult = true;
		await c.toggle(c.items()[0]);
		const req = http.expectOne(`${base}/a1`);
		expect(req.request.method).toBe('PATCH');
		expect(req.request.body).toEqual({ active: false });
		req.flush({ success: true, data: { ...A, active: false } });
		expect(c.items()[0].active).toBe(false);
	});

	it('upload validates locally (message under the file field), then posts multipart with the file', async () => {
		const { f, c, http, el } = setup();
		c.openForm(); f.detectChanges();
		c.title = 'مادة'; c.kind = 'IMAGE';
		await c.submit();
		await settleForm();
		expectFieldProblem(el.ownerDocument.getElementById('ma-file'), 'ارفع ملفاً');
		c.file = new File(['x'], 'a.png', { type: 'image/png' });
		await c.submit();
		const req = http.expectOne((r) => r.method === 'POST' && r.url === base);
		const fd = req.request.body as FormData;
		expect(fd.get('kind')).toBe('IMAGE');
		expect((fd.get('file') as File).name).toBe('a.png');
		req.flush({ success: true, data: A });
		http.expectOne((r) => r.method === 'GET' && r.url === base).flush({ success: true, data: { items: [A], pagination: { page: 1, limit: 50, total: 1, pages: 1 } } });
		expect(c.showForm()).toBe(false);
	});

	it('a server error on upload is shown to the admin as a generic banner, not a field error', async () => {
		const { c, http, el } = setup();
		c.openForm(); c.title = 'مادة'; c.kind = 'TEXT'; c.text = 'نص';
		await c.submit();
		http.expectOne((r) => r.method === 'POST').flush({ message: 'مركز المواد التسويقية غير جاهز بعد' }, { status: 503, statusText: 'x' });
		await settleForm();
		expect(c.formError()).toBeTruthy();
		expectNoFieldProblem(el);
	});

	it('a 400 naming the title goes under the title field, focus moves there, inputs are kept, and a second click sends one request', async () => {
		const { f, c, http, el } = setup();
		c.openForm(); f.detectChanges();
		c.title = 'مادة'; c.kind = 'TEXT'; c.text = 'نص طويل';
		const p1 = c.submit(); const p2 = c.submit();
		await Promise.all([p1, p2]);
		const reqs = http.match((r) => r.method === 'POST' && r.url === base);
		expect(reqs.length).toBe(1);
		reqs[0].flush({ errors: [{ field: 'title', message: 'هذا العنوان مستخدم مسبقاً' }] }, { status: 400, statusText: 'x' });
		await settleForm();
		f.detectChanges();
		const title = el.ownerDocument.getElementById('ma-title');
		expectFieldProblem(title, 'مستخدم مسبقاً');
		expectFocused(title);
		expect(c.text).toBe('نص طويل');
		expect(c.formError()).toBe('');
	});

	it('sort order starts empty (no ready-made number) and a bad link is rejected at the link field', async () => {
		const { f, c, el } = setup();
		c.openForm(); f.detectChanges();
		expect(c.sortOrder).toBeNull();
		expect((el.ownerDocument.getElementById('ma-sort') as HTMLInputElement).value).toBe('');
		c.title = 'رابط'; c.kind = 'LINK'; c.linkUrl = 'abc';
		f.changeDetectorRef.markForCheck();
		await f.whenStable();
		f.detectChanges();
		await c.submit();
		await settleForm();
		expectFieldProblem(el.ownerDocument.getElementById('ma-link'), 'http');
	});
});
