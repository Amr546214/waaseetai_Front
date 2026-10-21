import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { SUPPER_ADMIN_ROUTES } from '../supper-admin.routes';
import { SiteControlScope } from './core/site-control-scope.service';
import { DesignTokensService } from './core/design-tokens.service';
import { SiteControlShell } from './shell/site-control-shell';

describe('site control (التحكم بالموقع)', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('the routes live inside the guarded admin area, before the not-found catch-all, nine pages with Arabic titles', () => {
		const idx = SUPPER_ADMIN_ROUTES.findIndex(r => r.path === 'site-control');
		const wild = SUPPER_ADMIN_ROUTES.findIndex(r => r.path === '**');
		expect(idx).toBeGreaterThan(-1);
		expect(idx).toBeLessThan(wild);
		const kids = SUPPER_ADMIN_ROUTES[idx].children!.filter(c => c.path);
		expect(kids.map(k => k.path)).toEqual(['health', 'tokens', 'icons', 'accounts', 'templates', 'typography', 'style-guide', 'live-preview', 'export']);
		expect(kids.every(k => /[؀-ۿ]/.test(String((k.data as any)?.title)))).toBe(true);
		expect((SUPPER_ADMIN_ROUTES[idx].data as any).title).toBe('التحكم بالموقع');
	});

	it('the design tokens are written on the section host ONLY, never on the document (the platform keeps its own colours)', async () => {
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
		const http = TestBed.inject(HttpTestingController);
		const tokens = TestBed.inject(DesignTokensService);
		const scope = TestBed.inject(SiteControlScope);
		const host = document.createElement('div');
		scope.setHost(host);
		const group = (v: string) => ({ groups: [{ id: 'g', label: 'g', tokens: [{ var: '--pg', value: v, label: 'bg' }] }] });
		const p = tokens.loadAndApply();
		http.expectOne('/assets/site-control/tokens.json').flush(group('#111111'));
		http.expectOne('/assets/site-control/tokens-light.json').flush(group('#eeeeee'));
		await p;
		expect(host.style.getPropertyValue('--pg')).toBe('#111111');
		expect(document.documentElement.style.getPropertyValue('--pg')).toBe('');
		// without a host (section left) nothing reaches the document either
		scope.setHost(null);
		tokens.applyAll();
		expect(document.documentElement.style.getPropertyValue('--pg')).toBe('');
	});

	it('the shell shows the "local only" notice and sets / clears the scope host with its element', async () => {
		@Component({ template: '' }) class Blank {}
		TestBed.configureTestingModule({ imports: [SiteControlShell], providers: [provideRouter([{ path: '**', component: Blank }]), provideHttpClient(), provideHttpClientTesting()] });
		const http = TestBed.inject(HttpTestingController);
		const f = TestBed.createComponent(SiteControlShell);
		f.detectChanges();
		const root = f.nativeElement.querySelector('[data-testid="site-control-root"]') as HTMLElement;
		expect(f.nativeElement.querySelector('[data-testid="site-control-notice"]').textContent).toContain('على هذا المتصفح فقط');
		await f.whenStable();
		const reqs = http.match(r => r.url.startsWith('/assets/site-control/'));
		expect(reqs.length).toBe(2);
		reqs.forEach(r => r.flush({ groups: [{ id: 'g', label: 'g', tokens: [{ var: '--navy', value: '#222222', label: 'n' }] }] }));
		await new Promise(r => setTimeout(r, 20));
		expect(root.style.getPropertyValue('--navy')).toBe('#222222');
		expect(document.documentElement.style.getPropertyValue('--navy')).toBe('');
		f.destroy();
		void TestBed.inject(Router);
	});
});
