import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MarketerAssets } from './assets';
import { MarketerOverviewService } from '../../../../core/services/marketer-overview.service';

// المواد التسويقية: real referral links + the files an admin published. Nothing invented; no upload / edit controls.
describe('marketer assets', () => {
	let fixture: ComponentFixture<MarketerAssets>;
	const el = () => fixture.nativeElement as HTMLElement;

	async function mount(assets: any, links: any = { primarySlug: 'khalid', primaryLink: 'x', customLinks: [{ id: 'l1', channelName: 'تيك توك', utmSource: 'tiktok', createdAt: '' }], settings: {} }) {
		await TestBed.configureTestingModule({ imports: [MarketerAssets], providers: [provideRouter([]), { provide: MarketerOverviewService, useValue: {
			getAssets: () => assets instanceof Error ? throwError(() => assets) : of({ success: true, data: { items: assets } }),
			getRefLinks: () => of({ success: true, data: links })
		} }] }).compileComponents();
		fixture = TestBed.createComponent(MarketerAssets);
		fixture.detectChanges();
		fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges();
	}
	afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

	it('empty state: nothing published = an honest message, no invented banner, no upload or edit control', async () => {
		await mount([]);
		expect(el().querySelector('[data-testid="assets-empty"]')!.textContent).toContain('لم تنشر الإدارة');
		expect(el().querySelectorAll('[data-testid="asset-row"]').length).toBe(0);
		expect(el().querySelector('input[type="file"]')).toBeNull();
		expect(el().textContent).not.toMatch(/رفع|تعديل|حذف/);
	});

	it('published files: each row has its title, kind and a real download link that opens safely', async () => {
		await mount([{ id: 'a1', kind: 'BANNER', title: 'بنر 1200', description: 'للمنشورات', downloadUrl: 'https://cdn.example.com/b.png' }, { id: 'a2', kind: 'TEMPLATE', title: 'قالب رسالة', description: null, downloadUrl: 'https://cdn.example.com/t.pdf' }]);
		const links = Array.from(el().querySelectorAll<HTMLAnchorElement>('[data-testid="asset-download"]'));
		expect(links.map(a => a.getAttribute('href'))).toEqual(['https://cdn.example.com/b.png', 'https://cdn.example.com/t.pdf']);
		for (const a of links) { expect(a.getAttribute('rel')).toContain('noopener'); expect(a.hasAttribute('download')).toBe(true); }
		expect(el().textContent).toContain('بنر');
		expect(el().textContent).toContain('قالب');
	});

	it('own links: the primary referral link and each channel link are shown and copyable', async () => {
		await mount([]);
		const inputs = Array.from(el().querySelectorAll<HTMLInputElement>('input[readonly]')).map(i => i.value);
		expect(inputs.length).toBe(2);
		expect(inputs[0]).toContain('/ref/khalid');
		expect(inputs[1]).toContain('utm_source=tiktok');
	});

	it('a failed load is reported with a retry, not shown as "nothing published"', async () => {
		await mount(new Error('x'));
		expect(el().querySelector('[data-testid="assets-error"]')).not.toBeNull();
		expect(el().querySelector('[data-testid="assets-empty"]')).toBeNull();
	});
});
