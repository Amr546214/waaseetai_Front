import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { LegalNameFieldComponent } from './legal-name-field.component';
import { LegalNameService, LegalNameView } from '../../core/services/legal-name.service';

describe('LegalNameFieldComponent', () => {
	let fixture: ComponentFixture<LegalNameFieldComponent>;
	let get: ReturnType<typeof vi.fn>, save: ReturnType<typeof vi.fn>, cancelRequest: ReturnType<typeof vi.fn>;
	const view = (o: Partial<LegalNameView>): LegalNameView => ({ status: 'PROVIDED', legalName: 'عمرو محمود', changeNeedsReview: false, pendingRequest: null, ...o });
	const q = (id: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
	async function mount(v: LegalNameView) {
		get = vi.fn(() => of({ success: true, data: v })); save = vi.fn(); cancelRequest = vi.fn();
		await TestBed.configureTestingModule({ imports: [LegalNameFieldComponent], providers: [{ provide: LegalNameService, useValue: { get, save, cancelRequest } }] }).compileComponents();
		fixture = TestBed.createComponent(LegalNameFieldComponent); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
	}
	const type = (value: string) => { const i = q('legal-name-field-input') as HTMLInputElement; i.value = value; i.dispatchEvent(new Event('input')); fixture.detectChanges(); };

	it('a legacy / Google account without it is asked for the legal name; the display name is not touched; a one-word name is refused with a reason', async () => {
		await mount(view({ status: 'MISSING', legalName: null }));
		expect(q('legal-name-missing')).toBeNull(); // no yellow explanation above the box
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

	it('alwaysEdit (setup pages): the name is a prefilled box right here, no read-only value / edit link', async () => {
		get = vi.fn(() => of({ success: true, data: view({}) })); save = vi.fn();
		await TestBed.configureTestingModule({ imports: [LegalNameFieldComponent], providers: [{ provide: LegalNameService, useValue: { get, save } }] }).compileComponents();
		fixture = TestBed.createComponent(LegalNameFieldComponent); fixture.componentRef.setInput('alwaysEdit', true);
		fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
		expect((q('legal-name-field-input') as HTMLInputElement).value).toBe('عمرو محمود');
		expect(q('legal-name-edit')).toBeNull(); expect(q('legal-name-value')).toBeNull();
		expect(fixture.nativeElement.textContent).not.toContain('إلغاء');
	});

	it('alwaysEdit with a pending change request: the box is replaced by the pending note (no second request)', async () => {
		get = vi.fn(() => of({ success: true, data: view({ pendingRequest: { requestedValue: 'عمرو محمود علي' } as never }) })); save = vi.fn();
		await TestBed.configureTestingModule({ imports: [LegalNameFieldComponent], providers: [{ provide: LegalNameService, useValue: { get, save } }] }).compileComponents();
		fixture = TestBed.createComponent(LegalNameFieldComponent); fixture.componentRef.setInput('alwaysEdit', true);
		fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
		expect(q('legal-name-field-input')).toBeNull(); expect(q('legal-name-pending')).not.toBeNull();
	});

	describe('setup pages (autoSave): the name is a plain input among the form fields, no save button', () => {
		async function mountAuto(v: LegalNameView) {
			get = vi.fn(() => of({ success: true, data: v })); save = vi.fn();
			await TestBed.configureTestingModule({ imports: [LegalNameFieldComponent], providers: [{ provide: LegalNameService, useValue: { get, save } }] }).compileComponents();
			fixture = TestBed.createComponent(LegalNameFieldComponent); fixture.componentRef.setInput('alwaysEdit', true); fixture.componentRef.setInput('autoSave', true);
			fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
		}
		const blur = () => { (q('legal-name-field-input') as HTMLInputElement).dispatchEvent(new Event('blur')); fixture.detectChanges(); };

		it('the box is visible with the form input look and there is no save button; a valid name is saved when the box loses focus (once, cleaned)', async () => {
			await mountAuto(view({ status: 'MISSING', legalName: null }));
			const input = q('legal-name-field-input') as HTMLInputElement;
			expect(input.className).toContain('border-slate-200');
			expect(input.className).toContain('rounded-xl');
			expect(q('legal-name-save')).toBeNull();
			save.mockReturnValue(of({ success: true, data: { outcome: 'SAVED', view: view({}) } }));
			type('  عمرو   محمود '); blur(); blur();
			expect(save).toHaveBeenCalledTimes(1);
			expect(save).toHaveBeenCalledWith('عمرو محمود');
		});

		it('typing is saved by itself after a short pause (not on every key); an invalid or unchanged name is never sent', async () => {
			vi.useFakeTimers();
			try {
				await mountAuto(view({ status: 'MISSING', legalName: null }));
				save.mockReturnValue(of({ success: true, data: { outcome: 'SAVED', view: view({}) } }));
				type('عمرو'); vi.advanceTimersByTime(2000); expect(save).not.toHaveBeenCalled();       // one word: refused with a reason, nothing sent
				type('عمرو م'); type('عمرو محمود'); expect(save).not.toHaveBeenCalled(); vi.advanceTimersByTime(900);
				expect(save).toHaveBeenCalledTimes(1);
				fixture.detectChanges();
				type('عمرو محمود'); blur(); expect(save).toHaveBeenCalledTimes(1);                      // unchanged: no second call
			} finally { vi.useRealTimers(); }
		});

		it('a name tied to a verified / pending identity CAN be edited here (the owner asked for it): the box is writable and the change is sent as a review request with the «إرسال طلب التعديل» button — never saved silently', async () => {
			await mountAuto(view({ changeNeedsReview: true }));
			const input = q('legal-name-field-input') as HTMLInputElement;
			expect(input.readOnly).toBe(false);
			expect(q('legal-name-review-note')!.textContent).toContain('طلب للمراجعة');
			type('عمرو أحمد'); blur();
			expect(save).not.toHaveBeenCalled();                      // typing / leaving the box sends nothing by itself
			const btn = q('legal-name-save') as HTMLButtonElement;
			expect(btn.textContent).toContain('إرسال طلب التعديل');
			save.mockReturnValue(of({ success: true, data: { outcome: 'REQUEST_CREATED', view: view({ changeNeedsReview: true }) } }));
			btn.click();
			expect(save).toHaveBeenCalledTimes(1);
		});
	});

	const pendingView = () => view({ changeNeedsReview: true, pendingRequest: { id: 'req-1', requestedValue: 'عمرو محمود يحيى محمد', createdAt: '2026-11-22T10:00:00Z' } });

	it('a waiting request can be corrected or withdrawn (it is no longer a dead end): both actions show, the box opens prefilled with the requested name', async () => {
		await mount(pendingView());
		expect(q('legal-name-pending')?.textContent).toContain('عمرو محمود يحيى محمد');
		expect(q('legal-name-edit-request')).not.toBeNull(); expect(q('legal-name-withdraw')).not.toBeNull();
		q('legal-name-edit-request')!.click(); fixture.detectChanges();
		expect((q('legal-name-field-input') as HTMLInputElement).value).toBe('عمرو محمود يحيى محمد');
		expect(q('legal-name-pending-actions')).toBeNull();
	});

	it('editing the waiting request sends the corrected name (the server replaces the old request)', async () => {
		await mount(pendingView());
		q('legal-name-edit-request')!.click(); fixture.detectChanges();
		save.mockReturnValue(of({ success: true, data: { outcome: 'REQUEST_CREATED', view: view({ changeNeedsReview: true, pendingRequest: { id: 'req-2', requestedValue: 'عمرو محمود يحيى', createdAt: '2026-11-22T10:05:00Z' } }) } }));
		type('عمرو محمود يحيى'); (q('legal-name-save') as HTMLButtonElement).click(); fixture.detectChanges();
		expect(save).toHaveBeenCalledWith('عمرو محمود يحيى');
		expect(q('legal-name-pending')?.textContent).toContain('عمرو محمود يحيى');
	});

	it('withdrawing the request calls the server, shows the current name again and says so', async () => {
		await mount(pendingView());
		cancelRequest.mockReturnValue(of({ success: true, data: view({ changeNeedsReview: true, pendingRequest: null }) }));
		q('legal-name-withdraw')!.click(); fixture.detectChanges();
		expect(cancelRequest).toHaveBeenCalledTimes(1);
		expect(q('legal-name-pending')).toBeNull();
		expect(q('legal-name-value')?.textContent).toContain('عمرو محمود');
		expect(q('legal-name-note')?.textContent).toContain('تم سحب الطلب');
	});
});
