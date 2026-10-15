import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { NotificationHostComponent } from '../../../../shared/forms/notification-host.component';
import { CreateRequest, resetCreateRequestPageLoadState } from './create-request';

// Feedback on this page goes through the central UiNotificationService (rendered by <app-notification-host>), not a local toast.
const ioMock = vi.hoisted(() => vi.fn());
(globalThis as any).__socketIoModule = () => ({ io: ioMock });

describe('create-request: feedback flows through the central notification service', () => {
	beforeEach(async () => {
		ioMock.mockReset();
		ioMock.mockImplementation(() => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }));
		sessionStorage.clear();
		resetCreateRequestPageLoadState();
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} });
		await TestBed.configureTestingModule({
			imports: [CreateRequest, NotificationHostComponent],
			providers: [provideRouter([]), { provide: HttpClient, useValue: { get: () => of({ success: false }), post: () => of({ success: false }) } }],
		}).compileComponents();
	});
	afterEach(() => { TestBed.resetTestingModule(); vi.unstubAllGlobals(); });

	it('pressing AI refine on an empty form shows a warning in the central host, and the page renders no toast of its own', async () => {
		const page = TestBed.createComponent(CreateRequest);
		await page.whenStable();
		page.componentInstance.currentStep.set(3);
		page.detectChanges();
		const host = TestBed.createComponent(NotificationHostComponent);
		host.detectChanges();

		(page.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid=ai-refine-btn]')!.click();
		page.detectChanges();
		host.detectChanges();

		const message = 'اكتب عنوان الطلب ووصفه أولًا، ثم استخدم تحسين الصياغة.';
		const service = TestBed.inject(UiNotificationService);
		expect(service.toasts().map(t => [t.kind, t.message])).toEqual([['warning', message]]);
		const rendered = (host.nativeElement as HTMLElement).querySelector('[data-testid=ui-toast]');
		expect(rendered?.textContent).toContain(message);
		expect((page.nativeElement as HTMLElement).textContent).not.toContain(message);
	});
});
