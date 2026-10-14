import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SaSpecialties } from './sa-specialties';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';

const tree = [{ id: 'c1', nameAr: 'تصميم', isActive: true, specialties: [{ id: 's1', nameAr: 'شعارات', isActive: true, providersCount: 2, monthlyRequests: 3 }] }];

describe('SaSpecialties', () => {
	let fixture: any; let component: SaSpecialties; let http: any;
	beforeEach(async () => {
		http = {
			get: vi.fn((url: string) => of(url.includes('/stats') ? { success: true, data: { totalSpecialties: 1, totalCategories: 1, activeSpecialtiesCount: 1, activeProvidersCount: 2, monthlyAccreditationRequests: 99 } }
				: url.includes('/accreditation/specialties') ? { success: true, data: { items: [], counts: { pending: 7, approved: 0, rejected: 0, all: 7 }, pagination: {} } }
				: { success: true, data: tree })),
			post: vi.fn(() => of({})), put: vi.fn(() => of({})), patch: vi.fn(() => of({})), delete: vi.fn(() => of({})),
		};
		await TestBed.configureTestingModule({ imports: [SaSpecialties], providers: [provideRouter([]), { provide: HttpClient, useValue: http }] }).compileComponents();
		fixture = TestBed.createComponent(SaSpecialties); component = fixture.componentInstance; fixture.detectChanges();
		await new Promise(r => setTimeout(r, 350)); fixture.detectChanges();
	});
	afterEach(() => TestBed.resetTestingModule());

	it('the pending-review card shows the real queue count, not the legacy monthly figure', () => {
		expect(fixture.nativeElement.querySelector('[data-testid="pending-review-count"]').textContent.trim()).toBe('7');
		expect(fixture.nativeElement.textContent).not.toContain('99');
	});

	it('the catalog import asks for confirmation first and calls nothing until confirmed', () => {
		component.promptImportCatalog();
		expect(component.isConfirmModalOpen()).toBe(true);
		expect(component.confirmActionType()).toBe('import_catalog');
		expect(http.post).not.toHaveBeenCalled();
	});

	it('deleting needs the confirm modal and shows the backend refusal message', () => {
		http.delete.mockReturnValueOnce(throwError(() => ({ error: { message: 'لا يمكن حذف تخصص مرتبط بمقدمي خدمة نشطين.' } })));
		component.promptDeleteSpec(tree[0].specialties[0] as any);
		expect(http.delete).not.toHaveBeenCalled();
		component.executeConfirmAction();
		const ui = TestBed.inject(UiNotificationService);
		expect(ui.toasts().map(t => ({ kind: t.kind, message: t.message }))).toContainEqual({ kind: 'error', message: 'لا يمكن حذف تخصص مرتبط بمقدمي خدمة نشطين.' });
		expect(component.isConfirmModalOpen()).toBe(true);
	});

	it('search is sent as an encoded query param', () => {
		component.loadTree('تصميم & شعار');
		const last = http.get.mock.calls.filter((c: any[]) => String(c[0]).includes('/tree')).pop();
		expect(last[1].params.get('search')).toBe('تصميم & شعار');
	});
});
