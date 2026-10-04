import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { UiNotificationService } from './ui-notification.service';

describe('UiNotificationService', () => {
	let svc: UiNotificationService;
	beforeEach(() => {
		vi.useFakeTimers();
		TestBed.configureTestingModule({});
		svc = TestBed.inject(UiNotificationService);
	});
	afterEach(() => { svc.clearAll(); vi.useRealTimers(); });

	it('shows a success toast and removes it after its duration', () => {
		svc.success('تم الحفظ');
		expect(svc.toasts().map(t => [t.kind, t.message])).toEqual([['success', 'تم الحفظ']]);
		vi.advanceTimersByTime(3499);
		expect(svc.toasts().length).toBe(1);
		vi.advanceTimersByTime(2);
		expect(svc.toasts().length).toBe(0);
	});

	it('errors stay longer than successes; duration 0 stays until dismissed', () => {
		svc.error('فشل');
		const sticky = svc.error('مهم', { duration: 0 });
		vi.advanceTimersByTime(7001);
		expect(svc.toasts().map(t => t.message)).toEqual(['مهم']);
		svc.dismiss(sticky);
		expect(svc.toasts()).toEqual([]);
	});

	it('the same message refreshes instead of stacking, and the stack is capped at 4', () => {
		svc.info('a'); svc.info('a');
		expect(svc.toasts().length).toBe(1);
		['b', 'c', 'd', 'e', 'f'].forEach(m => svc.info(m));
		expect(svc.toasts().map(t => t.message)).toEqual(['c', 'd', 'e', 'f']);
	});

	it('the banner is single, sticky and replaceable', () => {
		const first = svc.showBanner('error', 'خطأ 1', { title: 'عنوان' });
		vi.advanceTimersByTime(60000);
		expect(svc.banner()?.message).toBe('خطأ 1');
		svc.showBanner('warning', 'خطأ 2');
		expect(svc.banner()?.message).toBe('خطأ 2');
		svc.dismissBanner(first); // stale id: ignored
		expect(svc.banner()?.message).toBe('خطأ 2');
		svc.dismissBanner();
		expect(svc.banner()).toBeNull();
	});

	it('httpError maps to Arabic, returns the mapped error, and picks toast/banner by option', () => {
		const e = new HttpErrorResponse({ status: 429, error: { message: 'Too many requests from this IP, please try again after 15 minutes' } });
		const mapped = svc.httpError(e);
		expect(mapped.kind).toBe('rate-limit');
		expect(svc.toasts()[0].message).toContain('15 دقيقة');
		expect(svc.banner()).toBeNull();

		svc.httpError(new HttpErrorResponse({ status: 0 }), { target: 'banner' });
		expect(svc.banner()?.message).toContain('الاتصال');
	});

	it('pending-review is a warning, not an error', () => {
		svc.httpError(new HttpErrorResponse({ status: 403, error: { message: 'طلبك قيد المراجعة' } }));
		expect(svc.toasts()[0].kind).toBe('warning');
	});
});
