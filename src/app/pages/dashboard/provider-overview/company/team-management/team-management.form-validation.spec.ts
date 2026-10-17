import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CompanyTeamManagementComponent } from './team-management.component';
import { CompanyTeamService } from '../../../../../core/services/company-team.service';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../../shared/forms/form-spec-utils';

describe('company team management: add-member form', () => {
	let create: ReturnType<typeof vi.fn>;
	async function mount(createImpl: () => any = () => of({ data: { id: 'm1', name: 'س', email: 'a@b.co', jobTitle: 'م', memberType: 'PROVIDER', status: 'PENDING' } })) {
		create = vi.fn(createImpl);
		TestBed.configureTestingModule({
			imports: [CompanyTeamManagementComponent],
			providers: [provideRouter([]), { provide: CompanyTeamService, useValue: { list: () => of({ data: [] }), create, update: vi.fn(), remove: vi.fn() } }],
		});
		(Element.prototype as any).scrollIntoView = vi.fn();
		const f = TestBed.createComponent(CompanyTeamManagementComponent);
		f.detectChanges(); await f.whenStable(); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		(el.querySelector('.invite-btn') as HTMLButtonElement).click(); f.detectChanges(); await f.whenStable(); f.detectChanges();
		const q = (id: string) => el.querySelector(`#${id}`) as HTMLInputElement;
		const type = (id: string, v: string) => { const i = q(id); i.value = v; i.dispatchEvent(new Event('input')); f.detectChanges(); };
		const save = () => el.querySelector('button[type=submit]') as HTMLButtonElement;
		return { f, c: f.componentInstance, el, q, type, save };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('empty save: each required field is red with its own role=alert message, the first (name) has focus, no request', async () => {
		const m = await mount();
		m.save().click(); await settleForm(); m.f.detectChanges();
		expect(create).not.toHaveBeenCalled();
		expectFocused(m.q('tm-name'));
		expectFieldProblem(m.q('tm-name'), 'الاسم مطلوب');
		expectFieldProblem(m.q('tm-email'), 'البريد الإلكتروني مطلوب');
		expectFieldProblem(m.q('tm-jobTitle'), 'المسمى الوظيفي مطلوب');
		expect(m.q('tm-phone').getAttribute('aria-invalid')).toBeNull();
	});

	it('a malformed email is marked at the email field and the typed values are kept', async () => {
		const m = await mount();
		m.type('tm-name', 'سارة'); m.type('tm-jobTitle', 'مصممة'); m.type('tm-email', 'not-an-email');
		m.save().click(); await settleForm(); m.f.detectChanges();
		expect(create).not.toHaveBeenCalled();
		expectFocused(m.q('tm-email'));
		expectFieldProblem(m.q('tm-email'), 'غير صالح');
		expect(m.q('tm-name').value).toBe('سارة');
		expect(m.q('tm-jobTitle').value).toBe('مصممة');
	});

	async function fill(m: Awaited<ReturnType<typeof mount>>) {
		m.type('tm-name', 'سارة'); m.type('tm-jobTitle', 'مصممة'); m.type('tm-email', 'sara@co.com');
	}

	it('backend 422 naming the email lands at the email field (focused)', async () => {
		const m = await mount(() => throwError(() => httpFail(422, { errors: [{ field: 'email', message: 'هذا البريد مضاف مسبقًا' }] })));
		await fill(m);
		m.save().click(); await settleForm(); m.f.detectChanges();
		expect(create).toHaveBeenCalledTimes(1);
		expectFieldProblem(m.q('tm-email'), 'هذا البريد مضاف مسبقًا');
		expectFocused(m.q('tm-email'));
		expect(m.c.saving()).toBe(false);
		expect(m.q('tm-name').value).toBe('سارة');
	});

	it('429 / network stay a generic message in the banner and mark no field', async () => {
		for (const status of [429, 0]) {
			const m = await mount(() => throwError(() => httpFail(status, { message: 'Too many requests, try again after 15 minutes' })));
			await fill(m);
			m.save().click(); await settleForm(); m.f.detectChanges();
			expect(m.c.formError()).toBeTruthy();
			expect(m.el.querySelector('[data-testid=tm-form-error]')).toBeTruthy();
			expectNoFieldProblem(m.el);
			TestBed.resetTestingModule();
		}
	});

	it('double click sends ONE request', async () => {
		const pending = new Subject<any>();
		const m = await mount(() => pending);
		await fill(m);
		m.save().click(); m.save().click(); void m.c.submitForm();
		await settleForm(); m.f.detectChanges();
		expect(create).toHaveBeenCalledTimes(1);
		expect(m.save().disabled).toBe(true);
		pending.next({ data: { id: 'x', name: 'س', email: 'e@e.co', jobTitle: 'j', memberType: 'PROVIDER', status: 'PENDING' } }); pending.complete();
	});
});
