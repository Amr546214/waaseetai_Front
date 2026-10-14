import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { SaMarketingAssets } from './sa-marketing-assets';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
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

	it('upload validates locally, then posts multipart with the file', () => {
		const { c, http } = setup();
		c.openForm();
		c.title = 'مادة'; c.kind = 'IMAGE';
		c.submit();
		expect(c.formError()).toContain('ارفع ملفاً');
		c.file = new File(['x'], 'a.png', { type: 'image/png' });
		c.submit();
		const req = http.expectOne((r) => r.method === 'POST' && r.url === base);
		const fd = req.request.body as FormData;
		expect(fd.get('kind')).toBe('IMAGE');
		expect((fd.get('file') as File).name).toBe('a.png');
		req.flush({ success: true, data: A });
		http.expectOne((r) => r.method === 'GET' && r.url === base).flush({ success: true, data: { items: [A], pagination: { page: 1, limit: 50, total: 1, pages: 1 } } });
		expect(c.showForm()).toBe(false);
	});

	it('a server error on upload is shown to the admin', () => {
		const { c, http } = setup();
		c.openForm(); c.title = 'مادة'; c.kind = 'TEXT'; c.text = 'نص';
		c.submit();
		http.expectOne((r) => r.method === 'POST').flush({ message: 'مركز المواد التسويقية غير جاهز بعد' }, { status: 503, statusText: 'x' });
		expect(c.formError()).toContain('غير جاهز');
	});
});
