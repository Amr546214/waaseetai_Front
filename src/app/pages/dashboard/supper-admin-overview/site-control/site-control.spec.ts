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

	it('the routes live inside the guarded admin area, before the not-found catch-all, «الهوية» first/default plus the nine local pages with Arabic titles', () => {
		const idx = SUPPER_ADMIN_ROUTES.findIndex(r => r.path === 'site-control');
		const wild = SUPPER_ADMIN_ROUTES.findIndex(r => r.path === '**');
		expect(idx).toBeGreaterThan(-1);
		expect(idx).toBeLessThan(wild);
		const kids = SUPPER_ADMIN_ROUTES[idx].children!.filter(c => c.path);
		expect(kids.map(k => k.path)).toEqual(['identity', 'health', 'tokens', 'icons', 'accounts', 'templates', 'typography', 'style-guide', 'live-preview', 'export']);
		expect(kids.every(k => /[؀-ۿ]/.test(String((k.data as any)?.title)))).toBe(true);
		expect((SUPPER_ADMIN_ROUTES[idx].data as any).title).toBe('التحكم بالموقع');
		// Round 2: the section link opens the FIRST PAGE THE ACCOUNT MAY OPEN (landing guard), no longer a blind redirect to «الهوية» (see site-control-landing.guard.spec.ts)
		const landing = SUPPER_ADMIN_ROUTES[idx].children!.find(c => c.path === '');
		expect(landing?.redirectTo).toBeUndefined();
		expect(landing?.canActivate?.length).toBe(2);
	});

	it('access: «الهوية» needs site.view or site.manage (or the legacy permission, which also edits), the local pages keep site_control.manage, the section opens for any of them', () => {
		const idx = SUPPER_ADMIN_ROUTES.findIndex(r => r.path === 'site-control');
		const sec = SUPPER_ADMIN_ROUTES[idx];
		expect((sec.data as any).access).toEqual({ anyOf: ['site_control.manage', 'site.view', 'site.manage'] });
		const kid = (p: string) => sec.children!.find(c => c.path === p)!;
		// the legacy permission opens «الهوية» too (Round 5: it is the edit capability; the server decides canManage)
		expect((kid('identity').data as any).access).toEqual({ anyOf: ['site.view', 'site.manage', 'site_control.manage'] });
		for (const p of ['health', 'tokens', 'icons', 'accounts', 'templates', 'typography', 'style-guide', 'live-preview', 'export']) expect((kid(p).data as any).access).toEqual({ all: ['site_control.manage'] });
		expect((kid('identity').data as any).title).toBe('الهوية');
		expect(kid('identity').canActivate?.length).toBeGreaterThan(0);
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
		expect(f.nativeElement.querySelector('[data-testid="site-control-not-wired"]').textContent).toContain('غير مرتبط بالموقع: التعديل هنا محلي ولا يغيّر المنصة');
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

	it('on the real «الهوية» page the local-only notice is not shown (the page explains itself); on every other page it is', async () => {
		@Component({ template: '' }) class Blank {}
		TestBed.configureTestingModule({ imports: [SiteControlShell], providers: [provideRouter([{ path: 'x/site-control/identity', component: Blank }, { path: 'x/site-control/health', component: Blank }]), provideHttpClient(), provideHttpClientTesting()] });
		const router = TestBed.inject(Router);
		const f = TestBed.createComponent(SiteControlShell);
		await router.navigateByUrl('/x/site-control/identity'); f.detectChanges();
		expect(f.nativeElement.querySelector('[data-testid="site-control-notice"]')).toBeNull();
		await router.navigateByUrl('/x/site-control/health'); f.detectChanges();
		expect(f.nativeElement.querySelector('[data-testid="site-control-notice"]')).toBeTruthy();
		TestBed.inject(HttpTestingController).match(() => true);
		f.destroy();
	});
});
