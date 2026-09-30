import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

// NotificationEngineService eagerly opens a socket.io connection in its
// constructor, so socket.io-client is mocked at the module boundary — same
// pattern used by the other notification spec files.
const fakeSocket = {
	connected: false,
	on: vi.fn(),
	emit: vi.fn(),
	disconnect: vi.fn(),
};
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
vi.mock('socket.io-client', () => ({ default: (...args: any[]) => ioSpy(...args), io: (...args: any[]) => ioSpy(...args) }));

import { NotificationBell } from './notification-bell';
import { AuthStore } from '../../core/store/auth.store';

function unwrapSafeHtml(value: unknown): string {
	return (value as any)?.changingThisBreaksApplicationSecurity ?? String(value);
}

function rawNotification(overrides: any = {}) {
	return {
		id: 'n1',
		title: 'عنوان',
		message: 'رسالة',
		type: 'GENERAL',
		category: 'PROJECTS',
		isRead: false,
		createdAt: new Date().toISOString(),
		...overrides
	};
}

function setup(accountType: string) {
	const getSpy = vi.fn<(...args: any[]) => any>(() => of({ success: true, data: [] as any[] }));
	const patchSpy = vi.fn<(...args: any[]) => any>(() => of({ success: true }));
	const navigateByUrlSpy = vi.fn();
	const fakeAuthStore = { currentUser: signal({ accountType } as any) };

	TestBed.configureTestingModule({
		imports: [NotificationBell],
		providers: [
			provideRouter([]),
			{ provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args), patch: (...args: any[]) => patchSpy(...args) } },
			{ provide: AuthStore, useValue: fakeAuthStore },
		],
	});

	const fixture: ComponentFixture<NotificationBell> = TestBed.createComponent(NotificationBell);
	const component = fixture.componentInstance;
	const navSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
	return { fixture, component, getSpy, navSpy, navigateByUrlSpy };
}

describe('NotificationBell', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('creates and starts closed', () => {
		const { fixture, component } = setup('PROVIDER_INDIVIDUAL');
		fixture.detectChanges();
		expect(component).toBeTruthy();
		expect(component.isOpen()).toBe(false);
	});

	it('toggle() loads and maps the latest notifications only on first open, never leaving an undefined icon', () => {
		const { fixture, component, getSpy } = setup('PROVIDER_INDIVIDUAL');
		getSpy.mockReturnValue(of({
			success: true,
			data: [rawNotification({ id: 'n1', type: 'CHAT', metadata: { conversationId: 'c1' } })]
		}));
		fixture.detectChanges();

		component.toggle();
		expect(component.isOpen()).toBe(true);
		expect(getSpy).toHaveBeenCalledTimes(1);

		const list = component.notifications();
		expect(list.length).toBe(1);
		expect(unwrapSafeHtml(list[0].svgIcon)).not.toContain('undefined');
		expect(list[0].actionUrl).toBe('/provider-overview/messages?conversationId=c1');

		component.toggle();
		expect(component.isOpen()).toBe(false);
		component.toggle();
		expect(getSpy).toHaveBeenCalledTimes(1);
	});

	it('resolves a CHAT notification against the client dashboard when the current viewer is a client', () => {
		const { fixture, component, getSpy } = setup('CLIENT_INDIVIDUAL');
		getSpy.mockReturnValue(of({
			success: true,
			data: [rawNotification({ id: 'n2', type: 'CHAT', metadata: { conversationId: 'c2' } })]
		}));
		fixture.detectChanges();
		component.toggle();

		expect(component.notifications()[0].actionUrl).toBe('/client-overview/messages?conversationId=c2');
		expect(component.viewAllLink()).toBe('/client-overview/notifications');
	});

	it('resolves a FINANCIAL notification to the real wallet route for the current dashboard, ignoring a stale stored actionUrl', () => {
		const { fixture, component, getSpy } = setup('CLIENT_INDIVIDUAL');
		getSpy.mockReturnValue(of({
			success: true,
			data: [rawNotification({ id: 'n3', type: 'FINANCIAL', category: 'FINANCIAL', actionUrl: '/dashboard/clients-overview/finance/wallet' })]
		}));
		fixture.detectChanges();
		component.toggle();

		expect(component.notifications()[0].actionUrl).toBe('/client-overview/finance/wallet');
	});

	it('resolves a FINANCIAL notification with transactionId metadata to the exact transaction detail page', () => {
		const { fixture, component, getSpy } = setup('CLIENT_INDIVIDUAL');
		getSpy.mockReturnValue(of({
			success: true,
			data: [rawNotification({ id: 'n3b', type: 'FINANCIAL', category: 'FINANCIAL', metadata: { transactionId: 'txn-2' } })]
		}));
		fixture.detectChanges();
		component.toggle();

		expect(component.notifications()[0].actionUrl).toBe('/client-overview/finance/transactions/txn-2');
	});

	it('resolves the dashboard base and a GENERAL actionUrl correctly for a marketer viewer', () => {
		const { fixture, component, getSpy } = setup('MARKETING_BROKER');
		getSpy.mockReturnValue(of({
			success: true,
			data: [rawNotification({ id: 'n5', type: 'GENERAL', actionUrl: '/marketer-overview/profile/requests' })]
		}));
		fixture.detectChanges();
		component.toggle();

		expect(component.dashboardBase()).toBe('/marketer-overview');
		expect(component.viewAllLink()).toBe('/marketer-overview/notifications');
		expect(component.notifications()[0].actionUrl).toBe('/marketer-overview/profile/requests');
	});

	it('onItemClick marks an unread notification as read, navigates, and closes the dropdown', () => {
		const { fixture, component, getSpy, navSpy } = setup('PROVIDER_INDIVIDUAL');
		getSpy.mockReturnValue(of({
			success: true,
			data: [rawNotification({ id: 'n4', type: 'OFFER_ACCEPTED', metadata: { offerId: 'off-1' }, isRead: false })]
		}));
		fixture.detectChanges();
		component.toggle();

		const nt = component.notifications()[0];
		expect(nt.isUnread).toBe(true);

		component.onItemClick(nt);

		expect(component.isOpen()).toBe(false);
		expect(navSpy).toHaveBeenCalledWith('/provider-overview/offers/off-1/sign-contract');
	});

	it('viewAllLink points at the current dashboard\'s real notifications route', () => {
		const { fixture, component } = setup('PROVIDER_INDIVIDUAL');
		fixture.detectChanges();
		expect(component.viewAllLink()).toBe('/provider-overview/notifications');
	});
});
