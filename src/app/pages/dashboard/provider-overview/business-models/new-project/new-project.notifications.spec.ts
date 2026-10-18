import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NewProject } from './new-project';
import { NewProjectService } from '../../../../../core/services/new-project.service';
import { ProviderApiService } from '../../../../../core/services/provider-api.service';
import { SkillsCatalogService } from '../../../../../core/services/skills-catalog.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { NotificationHostComponent } from '../../../../../shared/forms/notification-host.component';

// Validation feedback on the model upload page goes through the central UiNotificationService (rendered by <app-notification-host>), not a local toast.
describe('provider new business model: feedback flows through the central notification service', () => {
	function mount() {
		TestBed.configureTestingModule({
			imports: [NewProject, NotificationHostComponent],
			providers: [
				provideRouter([]),
				{ provide: NewProjectService, useValue: {
					initSocket: vi.fn(), onStreamStart: vi.fn(), onStreamChunk: vi.fn(), onStreamEnd: vi.fn(), disconnectSocket: vi.fn(),
					publishService: vi.fn(() => of({ success: true })), updateService: vi.fn(() => of({ success: true })),
				} },
				{ provide: ProviderApiService, useValue: {
					getPassedSpecialties: () => of({ success: true, categories: [], registered: [] }),
					getAccreditationSamples: () => of({ success: true, data: [] }),
				} },
				{ provide: SkillsCatalogService, useValue: { getCatalog: () => of({ success: true, data: { skills: [] } }), getProviderMine: () => of({ success: true, data: { skills: [], specialties: [] } }) } },
			],
		});
		const page = TestBed.createComponent(NewProject);
		const host = TestBed.createComponent(NotificationHostComponent);
		page.detectChanges(); host.detectChanges();
		return { page, host, service: TestBed.inject(UiNotificationService) };
	}
	afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });

	it('"improve with AI" with a too-short title shows the validator reason as a warning in the central host, with no toast markup in the page', () => {
		const { page, host, service } = mount();
		const c = page.componentInstance;
		c.projectName.set('ab');
		c.projectDesc.set('وصف مبدئي لنموذج عمل يحتاج إلى تحسين لأنه ما زال قصيراً وغير مكتمل التفاصيل بعد');
		page.detectChanges();
		const improve = Array.from((page.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('app-step1-details button')).find(b => (b.textContent || '').includes('تحسين'));
		expect(improve).toBeDefined();
		improve!.click();
		page.detectChanges(); host.detectChanges();
		const message = 'اسم المشروع قصير جداً (أقل من 4 أحرف)، يرجى كتابة عنوان واضح ومحدد';
		expect(service.toasts().map(t => [t.kind, t.message])).toEqual([['warning', message]]);
		expect((host.nativeElement as HTMLElement).querySelector('[data-testid=ui-toast]')?.textContent).toContain(message);
		expect((page.nativeElement as HTMLElement).textContent).not.toContain(message);
		expect((page.nativeElement as HTMLElement).querySelector('.toast-box')).toBeNull();
	});

	it('asking the AI for a description with no title and no other data asks for clarification in the central host (no request is sent)', () => {
		const { page, host, service } = mount();
		page.componentInstance.aiAssist();
		page.detectChanges(); host.detectChanges();
		const message = 'أضف عنوانًا أوضح للمشروع (كلمتان على الأقل) أو بعض التفاصيل مثل التخصص والمهارات ليتمكن الذكاء الاصطناعي من اقتراح وصف. لم يُرسل أي طلب.';
		expect(service.toasts().map(t => [t.kind, t.message])).toEqual([['warning', message]]);
		expect((host.nativeElement as HTMLElement).querySelector('[data-testid=ui-toast]')?.textContent).toContain(message);
	});
});
