import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../shared/forms/form-spec-utils';
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

	describe('form validation UX', () => {
		const q = (id: string) => fixture.nativeElement.ownerDocument.getElementById(id) as HTMLElement;
		const click = (sel: string) => (fixture.nativeElement.querySelector(sel) as HTMLElement).click();

		it('empty specialty form: name, slug and category each get a message, focus goes to the first, no request', async () => {
			component.openModal();
			component.newSpecCatId.set('');
			fixture.detectChanges();
			await fixture.whenStable(); fixture.detectChanges();
			http.post.mockClear();
			component.addSpec();
			await settleForm();
			expectFieldProblem(q('sp-spec-name'), 'اسم التخصص مطلوب');
			expectFieldProblem(q('sp-spec-slug'), 'الرابط');
			expect(fixture.nativeElement.querySelectorAll('[data-testid="field-error"]').length).toBe(3);
			expectFocused(q('sp-spec-name'));
			expect(http.post).not.toHaveBeenCalled();
		});

		it('a slug with Arabic or spaces is rejected under the slug field', async () => {
			component.openModal();
			component.newSpecName.set('تصميم'); component.newSpecSlug.set('تصميم شعار'); component.newSpecCatId.set('c1');
			fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
			component.addSpec();
			await settleForm();
			expectFieldProblem(q('sp-spec-slug'), 'إنجليزية');
			expectFocused(q('sp-spec-slug'));
		});

		it('category form: both fields are validated and the typed name is kept', async () => {
			component.openCategoryModal();
			component.newCategoryName.set('قسم جديد');
			fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
			component.addCategory();
			await settleForm();
			expectFieldProblem(q('sp-cat-slug'), 'مطلوب');
			expect(component.newCategoryName()).toBe('قسم جديد');
			expectFocused(q('sp-cat-slug'));
		});

		it('a field-named 400 goes under the field; a non-field 400, 409, 429 and 500 stay a generic banner in the dialog', async () => {
			component.openModal();
			component.newSpecName.set('تصميم'); component.newSpecSlug.set('logo'); component.newSpecCatId.set('c1');
			fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
			http.post.mockReturnValueOnce(throwError(() => httpFail(400, { errors: [{ field: 'slug', message: 'الرابط مستخدم مسبقًا' }] })));
			component.addSpec();
			await settleForm(); fixture.detectChanges();
			expectFieldProblem(q('sp-spec-slug'), 'مستخدم مسبقًا');
			expect(component.specError()).toBe('');
			for (const st of [400, 409, 429, 500, 0]) {
				http.post.mockReturnValueOnce(throwError(() => httpFail(st, { message: st === 400 ? 'المعرّف والاسم العربي مطلوبان' : 'x' })));
				component.addSpec();
				await settleForm(); fixture.detectChanges();
				expect(component.specError(), String(st)).toBeTruthy();
				expect(fixture.nativeElement.querySelector('[data-testid="spec-error"]').getAttribute('role')).toBe('alert');
			}
			expect(component.newSpecName()).toBe('تصميم');
		});

		it('double click on save sends one request', async () => {
			component.openModal();
			component.newSpecName.set('تصميم'); component.newSpecSlug.set('logo'); component.newSpecCatId.set('c1');
			fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
			http.post.mockClear();
			http.post.mockReturnValueOnce(new Subject());
			component.addSpec(); component.addSpec();
			expect(http.post).toHaveBeenCalledTimes(1);
		});

		it('delete refusal also shows inside the confirm dialog', () => {
			http.delete.mockReturnValueOnce(throwError(() => httpFail(409, { message: 'لا يمكن حذف قسم يحتوي تخصصات.' })));
			component.promptDeleteCategory(tree[0] as any);
			component.executeConfirmAction();
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('[data-testid="confirm-error"]').textContent).toContain('لا يمكن حذف');
			expectNoFieldProblem(fixture.nativeElement);
		});
	});
});
