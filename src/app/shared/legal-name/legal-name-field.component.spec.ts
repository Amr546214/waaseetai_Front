import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { LegalNameFieldComponent } from './legal-name-field.component';
import { LegalNameService, LegalNameView } from '../../core/services/legal-name.service';

describe('LegalNameFieldComponent', () => {
	let fixture: ComponentFixture<LegalNameFieldComponent>;
	let get: ReturnType<typeof vi.fn>, save: ReturnType<typeof vi.fn>;
	const view = (o: Partial<LegalNameView>): LegalNameView => ({ status: 'PROVIDED', legalName: 'عمرو محمود', changeNeedsReview: false, pendingRequest: null, ...o });
	const q = (id: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
	async function mount(v: LegalNameView) {
		get = vi.fn(() => of({ success: true, data: v })); save = vi.fn();
		await TestBed.configureTestingModule({ imports: [LegalNameFieldComponent], providers: [{ provide: LegalNameService, useValue: { get, save } }] }).compileComponents();
		fixture = TestBed.createComponent(LegalNameFieldComponent); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
	}
	const type = (value: string) => { const i = q('legal-name-field-input') as HTMLInputElement; i.value = value; i.dispatchEvent(new Event('input')); fixture.detectChanges(); };

	it('a legacy / Google account without it is asked for the legal name; the display name is not touched; a one-word name is refused with a reason', async () => {
		await mount(view({ status: 'MISSING', legalName: null }));
		expect(q('legal-name-missing')?.textContent).toContain('اسم المستخدم لا يتغيّر');
		type('عمرو');
		expect(q('legal-name-problem')?.textContent).toContain('جزأين');
		expect((q('legal-name-save') as HTMLButtonElement).disabled).toBe(true);
		expect(save).not.toHaveBeenCalled();
	});
	it('saving a valid legal name sends it cleaned and shows the saved state', async () => {
		await mount(view({ status: 'MISSING', legalName: null }));
		save.mockReturnValue(of({ success: true, data: { outcome: 'SAVED', view: view({}) } }));
		type('  عمرو   محمود ');
		(q('legal-name-save') as HTMLButtonElement).click(); fixture.detectChanges();
		expect(save).toHaveBeenCalledWith('عمرو محمود');
		expect(q('legal-name-value')?.textContent).toContain('عمرو محمود');
		expect(q('legal-name-note')?.textContent).toContain('تم حفظ');
	});
	it('a name tied to a verified / pending identity: the change is a request, the current name stays until the decision', async () => {
		await mount(view({ changeNeedsReview: true }));
		expect(q('legal-name-edit')?.textContent).toContain('طلب تعديل');
		(q('legal-name-edit') as HTMLButtonElement).click(); fixture.detectChanges();
		save.mockReturnValue(of({ success: true, data: { outcome: 'REQUEST_CREATED', view: view({ changeNeedsReview: true, pendingRequest: { id: 'r1', requestedValue: 'عمرو أحمد', createdAt: 'x' } }) } }));
		type('عمرو أحمد');
		expect(q('legal-name-save')?.textContent).toContain('إرسال طلب التعديل');
		(q('legal-name-save') as HTMLButtonElement).click(); fixture.detectChanges();
		expect(q('legal-name-pending')?.textContent).toContain('قيد المراجعة');
		expect(q('legal-name-edit')).toBeNull();
	});
	it('a legacy account that is already verified (no legal name) stays verified and may only ADD the name as a request', async () => {
		await mount(view({ status: 'MISSING', legalName: null, changeNeedsReview: true }));
		expect(q('legal-name-legacy-verified')?.textContent).toContain('موثَّق حاليًا');
		type('منى خالد حسن');
		expect(q('legal-name-save')?.textContent).toContain('إرسال طلب إضافة الاسم');
		save.mockReturnValue(of({ success: true, data: { outcome: 'REQUEST_CREATED', view: view({ status: 'MISSING', legalName: null, changeNeedsReview: true, pendingRequest: { id: 'r', requestedValue: 'منى خالد حسن', createdAt: 'x' } }) } }));
		(q('legal-name-save') as HTMLButtonElement).click(); fixture.detectChanges();
		expect(q('legal-name-pending')?.textContent).toContain('قيد المراجعة');
	});
});
