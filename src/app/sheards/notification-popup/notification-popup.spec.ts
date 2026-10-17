import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { NotificationPopupComponent } from './notification-popup';
import { NotificationEngineService } from '../../core/services/notification-engine.service';
import { NotificationNavigator } from '../../core/services/notification-navigator.service';

describe('NotificationPopupComponent', () => {
	const open = vi.fn(async (_nt: any, hooks: any) => { hooks.onMarkedRead?.(); return 'navigated'; });
	const engine = {
		showToast: signal(true), latestNotification: signal<any>({ id: 'n1', title: 'عنوان', message: 'نص طويل', type: 'CHAT', actionUrl: '/client-overview/messages?conversationId=c1' }),
		mapToAppNotification: (r: any) => ({ ...r, iconBgClass: 'b', iconColorClass: 'c', svgIcon: '', actionUrl: r.actionUrl }),
		closeToast: vi.fn(() => engine.showToast.set(false)), onPopupMarkedRead: vi.fn(),
	};
	beforeEach(() => {
		engine.showToast.set(true); engine.closeToast.mockClear(); engine.onPopupMarkedRead.mockClear(); open.mockClear();
		TestBed.configureTestingModule({ imports: [NotificationPopupComponent], providers: [
			{ provide: NotificationEngineService, useValue: engine }, { provide: NotificationNavigator, useValue: { open } }] });
	});
	afterEach(() => TestBed.resetTestingModule());

	it('× only hides: no navigation, no read', () => {
		const f = TestBed.createComponent(NotificationPopupComponent); f.detectChanges();
		(f.nativeElement.querySelector('[data-testid=notification-popup-close]') as HTMLElement).click();
		expect(engine.closeToast).toHaveBeenCalled(); expect(open).not.toHaveBeenCalled(); expect(engine.onPopupMarkedRead).not.toHaveBeenCalled();
	});
	it('الانتقال goes through the navigator; the read is applied only by its success hook', () => {
		const f = TestBed.createComponent(NotificationPopupComponent); f.detectChanges();
		expect(f.nativeElement.textContent).toContain('الانتقال');
		(f.nativeElement.querySelector('[data-testid=notification-popup-go]') as HTMLElement).click();
		expect(open).toHaveBeenCalledTimes(1);
		expect(open.mock.calls[0][0]).toMatchObject({ id: 'n1', actionUrl: '/client-overview/messages?conversationId=c1' });
		expect(engine.onPopupMarkedRead).toHaveBeenCalledWith('n1');
	});
	it('without a destination there is no button', () => {
		engine.latestNotification.update(v => ({ ...v, actionUrl: undefined }));
		const f = TestBed.createComponent(NotificationPopupComponent); f.detectChanges();
		expect(f.nativeElement.querySelector('[data-testid=notification-popup-go]')).toBeNull();
		engine.latestNotification.update(v => ({ ...v, actionUrl: '/client-overview/messages?conversationId=c1' }));
	});
});
