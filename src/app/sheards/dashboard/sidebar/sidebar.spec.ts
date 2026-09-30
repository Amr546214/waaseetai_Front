import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { Component, signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

// NotificationEngineService (injected by NotificationBell, used in the
// integration block below) eagerly opens a socket.io connection in its
// constructor — mocked at the module boundary, same pattern used by every
// other notification-related spec file in this codebase.
const fakeSocket = { connected: false, on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
vi.mock('socket.io-client', () => ({ default: (...args: any[]) => ioSpy(...args), io: (...args: any[]) => ioSpy(...args) }));

import { Sidebar, NavItem } from './sidebar';
import { NotificationBell } from '../../notification-bell/notification-bell';
import { AuthStore } from '../../../core/store/auth.store';

// A catch-all route target so router.navigateByUrl() can recognize any test
// URL below without needing every real page component registered — the
// sidebar's own active-state logic only cares about the URL, never about
// what actually renders in the router outlet.
@Component({ selector: 'app-test-blank', template: '' })
class BlankTestComponent {}

function setup(accountType: string) {
	// profileSetupCompleted: true avoids the unrelated "incomplete profile"
	// nav-disabling branch in getProviderNavItems(), keeping these tests
	// focused purely on active-state logic.
	const getSpy = vi.fn<(...args: any[]) => any>(() => of({ success: true, data: { summary: { profileSetupCompleted: true } } }));
	const fakeAuthStore = { currentUser: signal({ accountType } as any), token: signal('fake-token') };

	TestBed.configureTestingModule({
		imports: [Sidebar],
		providers: [
			provideRouter([{ path: '**', component: BlankTestComponent }]),
			{ provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args) } },
			{ provide: AuthStore, useValue: fakeAuthStore },
		],
	});

	const fixture: ComponentFixture<Sidebar> = TestBed.createComponent(Sidebar);
	const component = fixture.componentInstance;
	const router = TestBed.inject(Router);
	return { fixture, component, router };
}

describe('Sidebar', () => {
	it('should create', () => {
		const { fixture, component } = setup('CLIENT_INDIVIDUAL');
		fixture.detectChanges();
		expect(component).toBeTruthy();
	});

	describe('isAccordionOpen / isPathWithinSection (query-param and detail-route safety)', () => {
		const projectsAccordion: NavItem = {
			type: 'accordion',
			id: 'projects',
			route: '/client-overview/projects',
			children: [
				{ type: 'link', route: '/client-overview/projects/active' },
				{ type: 'link', route: '/client-overview/projects/archived' },
			],
		};

		async function navigateTo(router: Router, url: string) {
			await router.navigateByUrl(url);
		}

		it('stays closed on an unrelated route', async () => {
			const { fixture, component, router } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();
			await navigateTo(router, '/client-overview/messages');
			fixture.detectChanges();
			expect(component.isAccordionOpen(projectsAccordion)).toBe(false);
		});

		it('opens for an exact listed child route', async () => {
			const { fixture, component, router } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();
			await navigateTo(router, '/client-overview/projects/active');
			fixture.detectChanges();
			expect(component.isAccordionOpen(projectsAccordion)).toBe(true);
		});

		it('opens for a detail route that is a SIBLING of the listed children, via the accordion\'s own section-root route', async () => {
			// /client-overview/projects/proj-1 is not nested under
			// .../projects/active or .../projects/archived — only the
			// accordion's own `route: '/client-overview/projects'` fallback
			// catches this.
			const { fixture, component, router } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();
			await navigateTo(router, '/client-overview/projects/proj-1');
			fixture.detectChanges();
			expect(component.isAccordionOpen(projectsAccordion)).toBe(true);
		});

		it('opens for a route nested deeper under a listed child (segment-aware, not naive substring)', async () => {
			const { fixture, component, router } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();
			await navigateTo(router, '/client-overview/projects/active/progress/proj-1');
			fixture.detectChanges();
			expect(component.isAccordionOpen(projectsAccordion)).toBe(true);
		});

		it('does NOT open for a route that merely shares a string prefix with the section root', async () => {
			// "/client-overview/project-modifications" starts with the same
			// characters as "/client-overview/projects" but is a completely
			// unrelated real route (no "/" boundary after "projects").
			const { fixture, component, router } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();
			await navigateTo(router, '/client-overview/project-modifications');
			fixture.detectChanges();
			expect(component.isAccordionOpen(projectsAccordion)).toBe(false);
		});

		it('query parameters on the current URL never affect accordion matching', async () => {
			const { fixture, component, router } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();
			await navigateTo(router, '/client-overview/projects/proj-1?tab=stages&foo=bar');
			fixture.detectChanges();
			expect(component.isAccordionOpen(projectsAccordion)).toBe(true);

			await navigateTo(router, '/client-overview/messages?conversationId=conv-1');
			fixture.detectChanges();
			expect(component.isAccordionOpen(projectsAccordion)).toBe(false);
		});

		it('a manually toggled accordion stays open regardless of the current route', async () => {
			const { fixture, component, router } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();
			await navigateTo(router, '/client-overview/messages');
			fixture.detectChanges();
			component.toggleAccordion('projects');
			expect(component.isAccordionOpen(projectsAccordion)).toBe(true);
		});
	});

	describe('isRouteActive (explicit, route-URL-derived active state for flat links and accordion children)', () => {
		async function navigateTo(router: Router, url: string) {
			await router.navigateByUrl(url);
		}

		it('activates the Messages item on its base URL and with a conversationId query param', async () => {
			const { fixture, component, router } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();
			const messages: NavItem = { type: 'link', route: '/client-overview/messages' };

			await navigateTo(router, '/client-overview/messages');
			fixture.detectChanges();
			expect(component.isRouteActive(messages)).toBe(true);

			await navigateTo(router, '/client-overview/messages?conversationId=conv-1');
			fixture.detectChanges();
			expect(component.isRouteActive(messages)).toBe(true);
		});

		it('activates the Notifications item on its base URL and with a query param', async () => {
			const { fixture, component, router } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();
			const notifications: NavItem = { type: 'link', route: '/client-overview/notifications' };

			await navigateTo(router, '/client-overview/notifications');
			fixture.detectChanges();
			expect(component.isRouteActive(notifications)).toBe(true);

			await navigateTo(router, '/client-overview/notifications?filter=unread');
			fixture.detectChanges();
			expect(component.isRouteActive(notifications)).toBe(true);
		});

		it('activates the Disputes item on its base URL and on a dispute detail route', async () => {
			const { fixture, component, router } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();
			const disputes: NavItem = { type: 'link', route: '/client-overview/disputes' };

			await navigateTo(router, '/client-overview/disputes');
			fixture.detectChanges();
			expect(component.isRouteActive(disputes)).toBe(true);

			await navigateTo(router, '/client-overview/disputes/123');
			fixture.detectChanges();
			expect(component.isRouteActive(disputes)).toBe(true);
		});

		it('does not activate on a route that merely shares a string prefix', async () => {
			const { fixture, component, router } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();
			const disputes: NavItem = { type: 'link', route: '/client-overview/disputes' };

			await navigateTo(router, '/client-overview/disputes-archive');
			fixture.detectChanges();
			expect(component.isRouteActive(disputes)).toBe(false);
		});

		it('an exact item (dashboard home) only activates on its precise route, never a nested one', async () => {
			const { fixture, component, router } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();
			const home: NavItem = { type: 'link', route: '/client-overview', exact: true };

			await navigateTo(router, '/client-overview');
			fixture.detectChanges();
			expect(component.isRouteActive(home)).toBe(true);

			await navigateTo(router, '/client-overview/messages');
			fixture.detectChanges();
			expect(component.isRouteActive(home)).toBe(false);
		});

		it('an item with no route is never active', () => {
			const { fixture, component } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();
			expect(component.isRouteActive({ type: 'accordion', id: 'x' })).toBe(false);
		});

		it('respects role separation: a client route never activates the equivalent provider item', async () => {
			const { fixture, component, router } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();
			const providerMessages: NavItem = { type: 'link', route: '/provider-overview/messages' };

			await navigateTo(router, '/client-overview/messages');
			fixture.detectChanges();
			expect(component.isRouteActive(providerMessages)).toBe(false);
		});

		it('reflects navigation driven purely by the Router, with no prior sidebar click', async () => {
			// Simulates arriving via a notification deep link / pasted URL /
			// refresh: navigate directly, without ever calling toggleAccordion
			// or clicking a rendered sidebar link first.
			const { fixture, component, router } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();
			const messages: NavItem = { type: 'link', route: '/client-overview/messages' };
			expect(component.isRouteActive(messages)).toBe(false);

			await navigateTo(router, '/client-overview/messages?conversationId=conv-2');
			fixture.detectChanges();
			expect(component.isRouteActive(messages)).toBe(true);
		});
	});

	describe('DOM: the real rendered sidebar actually applies the active class', () => {
		it('applies active-nav-item to the Messages <a> when arriving via a router-level deep link with a query param (client)', async () => {
			const { fixture, router } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();

			await router.navigateByUrl('/client-overview/messages?conversationId=conv-3');
			fixture.detectChanges();

			const anchors = Array.from(
				(fixture.nativeElement as HTMLElement).querySelectorAll('a[href]')
			) as HTMLAnchorElement[];
			const messagesAnchor = anchors.find(a => a.getAttribute('href') === '/client-overview/messages');

			expect(messagesAnchor).toBeTruthy();
			expect(messagesAnchor!.classList.contains('active-nav-item')).toBe(true);
		});

		it('applies active-nav-item to the Messages <a> for a provider viewer, and expands+highlights Finance on a transaction deep link', async () => {
			const { fixture, router } = setup('PROVIDER_INDIVIDUAL');
			fixture.detectChanges();

			await router.navigateByUrl('/provider-overview/messages?conversationId=conv-4');
			fixture.detectChanges();

			let anchors = Array.from(
				(fixture.nativeElement as HTMLElement).querySelectorAll('a[href]')
			) as HTMLAnchorElement[];
			const messagesAnchor = anchors.find(a => a.getAttribute('href') === '/provider-overview/messages');
			expect(messagesAnchor).toBeTruthy();
			expect(messagesAnchor!.classList.contains('active-nav-item')).toBe(true);

			// Finance's own children are 'finance/wallet' and 'finance/transactions'
			// (the list) — a transaction's own detail page is a real notification
			// deep-link target with no listed child of its own; only the
			// accordion's section-root fallback keeps it open+highlighted.
			await router.navigateByUrl('/provider-overview/finance/transactions/txn-9');
			fixture.detectChanges();

			const financeToggle = (fixture.nativeElement as HTMLElement).querySelector('[id="acc-finance"]');
			expect(financeToggle).toBeTruthy();
			expect(financeToggle!.getAttribute('aria-expanded')).toBe('true');

			anchors = Array.from(
				(fixture.nativeElement as HTMLElement).querySelectorAll('a[href]')
			) as HTMLAnchorElement[];
			const walletAnchor = anchors.find(a => a.getAttribute('href') === '/provider-overview/finance/wallet');
			// The transaction detail page isn't itself a listed child, so no
			// specific child link should be (falsely) highlighted — only the
			// parent section.
			expect(walletAnchor!.classList.contains('active-sub-item')).toBe(false);
		});
	});

	describe('currentPath (query/fragment stripping)', () => {
		it('strips a query string from the current URL', async () => {
			const { fixture, component, router } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();
			await router.navigateByUrl('/client-overview/messages?conversationId=conv-1');
			fixture.detectChanges();
			expect(component.currentPath()).toBe('/client-overview/messages');
		});

		it('leaves a plain URL with no query string untouched', async () => {
			const { fixture, component, router } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();
			await router.navigateByUrl('/client-overview/finance/wallet');
			fixture.detectChanges();
			expect(component.currentPath()).toBe('/client-overview/finance/wallet');
		});
	});
});

describe('End-to-end: clicking a real CHAT notification in the bell dropdown activates the Messages sidebar item', () => {
	// Renders BOTH NotificationBell and Sidebar from the SAME TestBed
	// configuration so they share the exact same Router singleton — this
	// drives navigation through the real onItemClick() handler (resolver +
	// navigateByUrl), not a hand-constructed URL, to catch any wiring gap
	// that a sidebar-only or bell-only test could miss.
	function setupIntegration(accountType: string) {
		const getSpy = vi.fn<(...args: any[]) => any>(() => of({ success: true, data: { summary: { profileSetupCompleted: true } } }));
		const fakeAuthStore = { currentUser: signal({ accountType } as any), token: signal('fake-token') };

		TestBed.configureTestingModule({
			imports: [Sidebar, NotificationBell],
			providers: [
				provideRouter([{ path: '**', component: BlankTestComponent }]),
				{ provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args), patch: () => of({ success: true }) } },
				{ provide: AuthStore, useValue: fakeAuthStore },
			],
		});

		const sidebarFixture: ComponentFixture<Sidebar> = TestBed.createComponent(Sidebar);
		const bellFixture: ComponentFixture<NotificationBell> = TestBed.createComponent(NotificationBell);
		const router = TestBed.inject(Router);
		return { sidebarFixture, bellFixture, sidebar: sidebarFixture.componentInstance, bell: bellFixture.componentInstance, router, getSpy };
	}

	function rawChatNotification(conversationId: string) {
		return {
			id: 'n1',
			title: 'رسالة جديدة',
			message: 'مرحباً',
			type: 'CHAT',
			metadata: { conversationId },
			isRead: false,
			createdAt: new Date().toISOString(),
		};
	}

	it('client: bell.onItemClick() on a CHAT notification navigates AND leaves Messages active in the real rendered sidebar', async () => {
		const { sidebarFixture, bellFixture, bell, router, getSpy } = setupIntegration('CLIENT_INDIVIDUAL');
		sidebarFixture.detectChanges();
		bellFixture.detectChanges();

		getSpy.mockReturnValue(of({ success: true, data: [rawChatNotification('conv-7')] }));
		bell.toggle();
		expect(bell.notifications().length).toBe(1);
		const nt = bell.notifications()[0];
		expect(nt.actionUrl).toBe('/client-overview/messages?conversationId=conv-7');

		bell.onItemClick(nt);
		await bellFixture.whenStable();
		await sidebarFixture.whenStable();
		sidebarFixture.detectChanges();

		expect(router.url).toBe('/client-overview/messages?conversationId=conv-7');

		const anchors = Array.from(
			(sidebarFixture.nativeElement as HTMLElement).querySelectorAll('a[href]')
		) as HTMLAnchorElement[];
		const messagesAnchor = anchors.find(a => a.getAttribute('href') === '/client-overview/messages');
		expect(messagesAnchor).toBeTruthy();
		expect(messagesAnchor!.classList.contains('active-nav-item')).toBe(true);
	});

	// Regression coverage for the confirmed 1px inconsistency: accordion
	// sub-items rendered at text-xs (12px) while every flat top-level item
	// and accordion parent rendered at text-[13px] — same sidebar, same
	// visual level, two different sizes. Rendering a route that opens an
	// accordion puts both kinds of items in the DOM at once.
	describe('typography consistency (flat items vs. accordion sub-items)', () => {
		it('never renders the old accordion-sub-item text-xs class anywhere in the sidebar', async () => {
			const { fixture, router } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();
			await router.navigateByUrl('/client-overview/projects/active');
			fixture.detectChanges();

			const el = fixture.nativeElement as HTMLElement;
			// Sanity check: an accordion is actually open and rendering children.
			expect(el.querySelector('a[href="/client-overview/projects/active"]')).toBeTruthy();

			const anyTextXs = Array.from(el.querySelectorAll('a, button'))
				.some(node => (node as HTMLElement).classList.contains('text-xs'));
			expect(anyTextXs).toBe(false);
		});

		it('an accordion sub-item link uses the same text-[13px] size as a flat top-level item', async () => {
			const { fixture, router } = setup('CLIENT_INDIVIDUAL');
			fixture.detectChanges();
			await router.navigateByUrl('/client-overview/projects/active');
			fixture.detectChanges();

			const el = fixture.nativeElement as HTMLElement;
			const subItem = el.querySelector('a[href="/client-overview/projects/active"]');
			const flatTopLevelItem = el.querySelector('a[href="/client-overview/messages"]');

			expect(subItem).toBeTruthy();
			expect(flatTopLevelItem).toBeTruthy();
			expect((subItem as HTMLElement).classList.contains('text-[13px]')).toBe(true);
			expect((flatTopLevelItem as HTMLElement).classList.contains('text-[13px]')).toBe(true);
		});
	});
});
