import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { LegalNameFieldComponent } from './legal-name-field.component';
import { LegalNameService, LegalNameView } from '../../core/services/legal-name.service';

describe('LegalNameFieldComponent: direct explicit save', () => {
	let fixture: ComponentFixture<LegalNameFieldComponent>;
	let save: ReturnType<typeof vi.fn>;
	const view = (o: Partial<LegalNameView> = {}): LegalNameView => ({ status: 'PROVIDED', legalName: 'عمرو محمود', changeNeedsReview: false, pendingRequest: null, ...o });
	const pending = () => view({ changeNeedsReview: true, pendingRequest: { id: 'old', requestedValue: 'عمرو محمود يحيى محمد', createdAt: '2026-11-22' } });
	const q = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
	async function mount(v: LegalNameView, alwaysEdit = false) {
		save = vi.fn();
		await TestBed.configureTestingModule({ imports: [LegalNameFieldComponent], providers: [{ provide: LegalNameService, useValue: { get: () => of({ success: true, data: v }), save } }] }).compileComponents();
		fixture = TestBed.createComponent(LegalNameFieldComponent); fixture.componentRef.setInput('alwaysEdit', alwaysEdit);
		fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
	}
	const type = (value: string) => { const i = q('legal-name-field-input') as HTMLInputElement; i.value = value; i.dispatchEvent(new Event('input')); fixture.detectChanges(); };
	const clickSave = () => { q('legal-name-save')!.click(); fixture.detectChanges(); };
	const saved = (legalName: string) => of({ success: true, data: { outcome: 'SAVED', view: view({ legalName }) } });

	it('validates a missing name and saves a cleaned value directly', async () => {
		await mount(view({ status: 'MISSING', legalName: null })); type('عمرو');
		expect(q('legal-name-problem')?.textContent).toContain('جزأين'); expect((q('legal-name-save') as HTMLButtonElement).disabled).toBe(true);
		type(' عمرو   محمود '); save.mockReturnValue(saved('عمرو محمود')); clickSave();
		expect(save).toHaveBeenCalledWith('عمرو محمود'); expect(q('legal-name-value')?.textContent).toBe('عمرو محمود'); expect(q('legal-name-note')?.textContent).toContain('تم حفظ');
	});
	it('a verified or pending identity still shows تعديل and حفظ, never request/review buttons', async () => {
		await mount(view({ changeNeedsReview: true })); expect(q('legal-name-edit')?.textContent).toBe('تعديل');
		q('legal-name-edit')!.click(); fixture.detectChanges(); type('عمرو أحمد');
		expect(q('legal-name-save')?.textContent).toContain('حفظ الاسم الحقيقي'); save.mockReturnValue(saved('عمرو أحمد')); clickSave();
		expect(q('legal-name-value')?.textContent).toBe('عمرو أحمد'); expect(fixture.nativeElement.textContent).not.toContain('قيد المراجعة'); expect(q('legal-name-review-note')).toBeNull();
	});
	it('a legacy verified account adds its missing legal name directly', async () => {
		await mount(view({ status: 'MISSING', legalName: null, changeNeedsReview: true })); type('منى خالد حسن'); save.mockReturnValue(saved('منى خالد حسن')); clickSave();
		expect(q('legal-name-value')?.textContent).toBe('منى خالد حسن'); expect(q('legal-name-legacy-verified')).toBeNull();
	});
	it('the old pending value is recovered as an editable draft and saves immediately without a request', async () => {
		await mount(pending()); expect((q('legal-name-field-input') as HTMLInputElement).value).toBe('عمرو محمود يحيى محمد');
		for (const id of ['legal-name-pending','legal-name-edit-request','legal-name-withdraw']) expect(q(id)).toBeNull();
		save.mockReturnValue(saved('عمرو محمود يحيى محمد')); clickSave(); expect(save).toHaveBeenCalledWith('عمرو محمود يحيى محمد'); expect(q('legal-name-value')?.textContent).toBe('عمرو محمود يحيى محمد');
	});
	it('onboarding keeps a visible save button; typing or blurring never submits a name', async () => {
		await mount(view(), true); type('عمرو أحمد'); (q('legal-name-field-input') as HTMLInputElement).dispatchEvent(new Event('blur'));
		expect(save).not.toHaveBeenCalled(); expect(q('legal-name-save')).not.toBeNull();
		save.mockReturnValue(saved('عمرو أحمد')); clickSave(); expect((q('legal-name-field-input') as HTMLInputElement).value).toBe('عمرو أحمد');
	});
	it('while saving, blocks duplicate submissions and editing; only a server-confirmed save emits saved', async () => {
		await mount(view(), true); const response = new Subject<any>(); save.mockReturnValue(response); const emit = vi.spyOn(fixture.componentInstance.saved, 'emit');
		type('عمرو أحمد'); clickSave(); fixture.componentInstance.save();
		expect(save).toHaveBeenCalledTimes(1); expect((q('legal-name-field-input') as HTMLInputElement).disabled).toBe(true); expect(emit).not.toHaveBeenCalled();
		response.next({ success: true, data: { outcome: 'SAVED', view: view({ legalName: 'عمرو أحمد' }) } }); response.complete(); fixture.detectChanges();
		expect(emit).toHaveBeenCalledTimes(1); expect((q('legal-name-field-input') as HTMLInputElement).disabled).toBe(false);
	});
	it('an older backend request response is not presented as a successful direct save', async () => {
		await mount(view(), true); type('عمرو أحمد'); const emit = vi.spyOn(fixture.componentInstance.saved, 'emit');
		save.mockReturnValue(of({ success: true, data: { outcome: 'REQUEST_CREATED', view: pending() } })); clickSave();
		expect(q('legal-name-note')).toBeNull(); expect(q('legal-name-problem')?.textContent).toContain('لم يُحفظ'); expect(emit).not.toHaveBeenCalled();
		expect((q('legal-name-field-input') as HTMLInputElement).value).toBe('عمرو أحمد');
	});
	it('a save failure keeps the typed value and shows the server error', async () => {
		await mount(view(), true); type('عمرو أحمد'); save.mockReturnValue(throwError(() => ({ error: { message: 'تعذر الحفظ' } }))); clickSave();
		expect(q('legal-name-problem')?.textContent).toContain('تعذر الحفظ'); expect((q('legal-name-field-input') as HTMLInputElement).value).toBe('عمرو أحمد'); expect(q('legal-name-note')).toBeNull();
	});
});
