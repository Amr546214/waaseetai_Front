import { readFileSync } from 'node:fs';
import { Location } from '@angular/common';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ErrorPageComponent } from './error-page';
import { CLIENT_OVERVIEW_ROUTES } from '../../dashboard/clients-overview/client.routes';
import { PROVIDER_OVERVIEW_ROUTES } from '../../dashboard/provider-overview/provider.routes';
import { MARKETER_ROUTES } from '../../dashboard/marketer-overview/marketer.routes';
import { SUPPER_ADMIN_ROUTES } from '../../dashboard/supper-admin-overview/supper-admin.routes';
import { routes } from '../../../app.routes';

const back = vi.fn();

function render(routeData: Record<string, unknown>) {
	TestBed.configureTestingModule({
		imports: [ErrorPageComponent],
		providers: [
			provideRouter([]),
			{ provide: ActivatedRoute, useValue: { snapshot: { data: routeData } } },
			{ provide: Location, useValue: { back } },
		],
	});
	const fixture = TestBed.createComponent(ErrorPageComponent);
	fixture.componentRef.setInput('type', '404');
	fixture.detectChanges();
	return fixture;
}

describe('404 page — public vs inside the dashboard', () => {
	beforeEach(() => back.mockClear());

	it('public page: draws the full-page chrome (grid, particles, logo bar)', () => {
		const el = render({}).nativeElement as HTMLElement;
		expect(el.querySelector('.bg-grid')).toBeTruthy();
		expect(el.querySelector('.particles')).toBeTruthy();
		expect(el.querySelector('.logo-bar img')).toBeTruthy();
		expect(el.classList.contains('embedded')).toBe(false);
	});

	it('embedded (inside the dashboard layout): only the card — no grid, particles or logo', () => {
		const fixture = render({ embedded: true });
		const el = fixture.nativeElement as HTMLElement;
		expect(el.classList.contains('embedded')).toBe(true);
		for (const sel of ['.bg-grid', '.particles', '.logo-bar', '.logo-bar img']) expect(el.querySelector(sel), sel).toBeNull();
		expect(el.querySelector('.err-card .err-code')?.textContent).toContain('404');
	});

	for (const [label, data] of [['public', {}], ['embedded', { embedded: true }]] as const) {
		it(`${label}: the three buttons are present and work`, () => {
			const el = render(data).nativeElement as HTMLElement;
			const links = [...el.querySelectorAll('.err-btns a')] as HTMLAnchorElement[];
			expect(links.map((a) => a.textContent?.trim())).toEqual(['العودة للرئيسية', 'تصفح الخدمات', 'الرجوع للخلف']);
			expect(links[0].getAttribute('href')).toBe('/');
			expect(links[1].getAttribute('href')).toBe('/marketplace');
			links[2].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
			expect(back).toHaveBeenCalledTimes(1);
		});
	}

	it('css: the logo has an explicit size (the height attribute alone is overridden by the global img reset) and the embedded layout is defined', () => {
		const css = readFileSync('src/app/pages/system-errors/error-page/error-page.css', 'utf8');
		expect(css).toMatch(/\.logo-bar img\{[^}]*height:30px[^}]*width:auto[^}]*max-width:none/);
		expect(css).toContain(':host(.embedded)');
	});
});

describe('every dashboard role renders its own 404 inside the layout, without the assistant', () => {
	const last = (list: readonly { path?: string; data?: Record<string, unknown> }[]) => list[list.length - 1];

	for (const [role, list] of [['client', CLIENT_OVERVIEW_ROUTES], ['provider', PROVIDER_OVERVIEW_ROUTES], ['marketer', MARKETER_ROUTES], ['admin', SUPPER_ADMIN_ROUTES]] as const) {
		it(`${role}: the last child route is a ** not-found with embedded + hideAssistant`, () => {
			const wildcard = last(list);
			expect(wildcard.path).toBe('**');
			expect(wildcard.data?.['embedded']).toBe(true);
			expect(wildcard.data?.['hideAssistant']).toBe(true);
		});
	}

	it('the public ** stays full-page (not embedded) and hides the assistant', () => {
		const root = routes.find((r) => r.path === '**')!;
		expect(root.data?.['hideAssistant']).toBe(true);
		expect(root.data?.['embedded']).toBeUndefined();
	});
});
