import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProviderHrComponent } from './provider-hr.component';
import { CompanyTeamService } from '../../../../core/services/company-team.service';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../shared/forms/form-spec-utils';

describe('provider HR: invite / edit member modal', () => {
	let create: ReturnType<typeof vi.fn>;
	let update: ReturnType<typeof vi.fn>;
	const member = { id: 'm1', name: 'خالد', email: 'k@co.com', phone: null, jobTitle: 'محاسب', memberType: 'EMPLOYEE', status: 'ACTIVE' };

	async function mount(createImpl: () => any = () => of({ data: { ...member, id: 'm2' } })) {
		create = vi.fn(createImpl);
		update = vi.fn(() => of({ data: member }));
		TestBed.configureTestingModule({
			imports: [ProviderHrComponent],
			providers: [provideRouter([]), { provide: CompanyTeamService, useValue: { list: () => of({ data: [member] }), create, update, remove: vi.fn() } }],
		});
		(Element.prototype as any).scrollIntoView = vi.fn();
		const f = TestBed.createComponent(ProviderHrComponent);
		const notify = TestBed.inject(UiNotificationService);
		const err = vi.spyOn(notify, 'error'); const warn = vi.spyOn(notify, 'warning');
		f.detectChanges(); await f.whenStable(); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		f.componentInstance.openCreate('EMPLOYEE'); f.detectChanges(); await f.whenStable(); f.detectChanges();
		const q = (id: string) => el.querySelector(`#${id}`) as HTMLInputElement;
		const type = (id: string, v: string) => { const i = q(id); i.value = v; i.dispatchEvent(new Event('input')); f.detectChanges(); };
		const save = () => el.querySelector('.modal-foot .btn-primary') as HTMLButtonElement;
		return { f, c: f.componentInstance, el, q, type, save, err, warn };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('empty save: messages at each required field, first one focused, modal stays open, and no toast-only warning', async () => {
		const m = await mount();
		m.save().click(); await settleForm(); m.f.detectChanges();
		expect(create).not.toHaveBeenCalled();
		expect(m.c.activeModal()).toBe('member-form');
		expectFocused(m.q('hr-name'));
		expectFieldProblem(m.q('hr-name'), 'الاسم الكامل مطلوب');
		expectFieldProblem(m.q('hr-job'), 'المسمى الوظيفي مطلوب');
		expectFieldProblem(m.q('hr-email'), 'البريد الإلكتروني مطلوب');
		expect(m.warn).not.toHaveBeenCalled();
	});

	it('bad email is marked and the other typed inputs are kept', async () => {
		const m = await mount();
		m.type('hr-name', 'منى'); m.type('hr-job', 'مديرة'); m.type('hr-email', 'mona@');
		m.save().click(); await settleForm(); m.f.detectChanges();
		expectFocused(m.q('hr-email'));
		expectFieldProblem(m.q('hr-email'), 'غير صالح');
		expect(m.q('hr-name').value).toBe('منى');
	});

	const fill = (m: Awaited<ReturnType<typeof mount>>) => { m.type('hr-name', 'منى'); m.type('hr-job', 'مديرة'); m.type('hr-email', 'mona@co.com'); };

	it('backend 400 naming the email lands at the email field; the modal stays open', async () => {
		const m = await mount(() => throwError(() => httpFail(400, { errors: [{ field: 'email', message: 'البريد مستخدم لدى عضو آخر' }] })));
		fill(m);
		m.save().click(); await settleForm(); m.f.detectChanges();
		expectFieldProblem(m.q('hr-email'), 'البريد مستخدم');
		expectFocused(m.q('hr-email'));
		expect(m.c.activeModal()).toBe('member-form');
		expect(m.err).not.toHaveBeenCalled();
	});

	it('429 and network errors stay one generic toast and mark no field', async () => {
		for (const status of [429, 0]) {
			const m = await mount(() => throwError(() => httpFail(status, null)));
			fill(m);
			m.save().click(); await settleForm(); m.f.detectChanges();
			expect(m.err).toHaveBeenCalledTimes(1);
			expectNoFieldProblem(m.el);
			TestBed.resetTestingModule();
		}
	});

	it('double click sends ONE request', async () => {
		const pending = new Subject<any>();
		const m = await mount(() => pending);
		fill(m);
		m.save().click(); m.save().click(); void m.c.saveForm();
		await settleForm(); m.f.detectChanges();
		expect(create).toHaveBeenCalledTimes(1);
		expect(m.save().disabled).toBe(true);
		pending.next({ data: member }); pending.complete();
	});
});
