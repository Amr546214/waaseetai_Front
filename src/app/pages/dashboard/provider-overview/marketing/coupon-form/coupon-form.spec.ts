import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MarketingCouponForm } from './coupon-form';
import { AuthStore } from '../../../../../core/store/auth.store';
import { ProviderCouponService } from '../../../../../core/services/provider-coupon.service';
import { CompanyTeamService } from '../../../../../core/services/company-team.service';
import { NewProjectService } from '../../../../../core/services/new-project.service';
import { MarketingCenterService } from '../../../../../core/services/marketing-center.service';
import { ActivatedRoute } from '@angular/router';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../../shared/forms/form-spec-utils';

/** Coupon form (2-step wizard): invalid submit -> field message + focus + step opening, BE field errors, generic errors, one request, no ready-made numbers. */
const SAVED = { id: 'k1', code: 'SAVED', discountType: 'percentage', discountValue: 12, minimumAmount: 80, maxDiscount: null, maxUses: 40, usedCount: 0, maxUsesPerUser: 3, active: true, startAt: '2026-10-01T00:00:00.000Z', expiresAt: null, serviceIds: ['m1'], excludedServiceIds: [], internalNote: null, assignedToTeamMemberId: null, createdByTeamMemberId: null, approvalStatus: 'APPROVED', rejectionReason: null, createdAt: '', updatedAt: '' };

async function setup(opts: { id?: string } = {}) {
	const create = vi.fn<(...a: any[]) => any>();
	const update = vi.fn<(...a: any[]) => any>();
	TestBed.configureTestingModule({
		imports: [MarketingCouponForm],
		providers: [
			provideRouter([]),
			{ provide: AuthStore, useValue: { currentUser: signal({ accountType: 'PROVIDER_INDIVIDUAL' }) } },
			{ provide: ProviderCouponService, useValue: { create, update, get: () => of({ data: SAVED }) } },
			{ provide: CompanyTeamService, useValue: { list: () => of({ data: [] }) } },
			{ provide: NewProjectService, useValue: { getMyMarketModels: () => of({ data: { models: [{ id: 'm1', title: 'نموذج 1' }, { id: 'm2', title: 'نموذج 2' }] } }) } },
			{ provide: MarketingCenterService, useValue: { refreshPendingCount: () => undefined } },
			...(opts.id ? [{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => opts.id } } } }] : []),
		],
	});
	const fixture = TestBed.createComponent(MarketingCouponForm);
	fixture.detectChanges();
	await fixture.whenStable();
	fixture.detectChanges();
	const el = fixture.nativeElement as HTMLElement;
	const q = <T extends HTMLElement = HTMLElement>(sel: string) => el.querySelector<T>(sel);
	const flush = async () => { await settleForm(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); };
	return { fixture, c: fixture.componentInstance, el, q, flush, create, update };
}

const fillValid = (c: MarketingCouponForm) => c.patch({ code: 'SUMMER', discountValue: 10, maxUses: 5, maxUsesPerUser: 1, scopeMode: 'all' });

describe('coupon form: invalid submit', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('Next with an empty step 1: first invalid field is focused, red, aria-invalid, described by a role=alert message', async () => {
		const { q, flush } = await setup();
		q<HTMLButtonElement>('button.btn-pri')!.click();
		await flush();
		const code = q<HTMLInputElement>('#cp-code')!;
		expectFocused(code);
		expectFieldProblem(code, 'كود الكوبون مطلوب');
		expect(code.classList.contains('invalid')).toBe(true);
		expectFieldProblem(q('#cp-val'));
		expectFieldProblem(q('#cp-per'), /أدخل عدد المرات/);
	});

	it('saving from step 2 while step 1 is invalid opens step 1 and focuses its first invalid field', async () => {
		const { c, q, flush, create } = await setup();
		c.patch({ code: 'SUMMER', maxUsesPerUser: 1, maxUses: 5 }); // discountValue left empty
		c.step.set(2);
		await flush();
		[...q('.save-bar')!.querySelectorAll('button')].find(b => b.textContent?.includes('حفظ'))!.click();
		await flush();
		expect(c.step()).toBe(1);
		expectFocused(q('#cp-val'));
		expectFieldProblem(q('#cp-val'), 'أدخل قيمة خصم أكبر من صفر');
		expect(create).not.toHaveBeenCalled();
	});

	it('a step 2 problem (no models chosen) is shown on step 2, focused, with its message', async () => {
		const { c, q, flush } = await setup();
		c.patch({ code: 'SUMMER', discountValue: 10, maxUses: 5, maxUsesPerUser: 1, scopeMode: 'specific', serviceIds: [] });
		c.step.set(2);
		await flush();
		c.save();
		await flush();
		const scope = q('#cp-scope')!;
		expectFocused(scope);
		expectFieldProblem(scope, 'اختر نموذجاً واحداً على الأقل');
	});
});

describe('coupon form: server answers', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('a 422 with a field name lands on that field (step 1 re-opened) and keeps every other input', async () => {
		const { c, q, flush, create } = await setup();
		fillValid(c);
		c.step.set(2);
		await flush();
		create.mockReturnValue(throwError(() => httpFail(422, { errors: [{ field: 'discountValue', message: 'قيمة الخصم غير مسموحة لهذا النوع' }] })));
		c.save();
		await flush();
		expect(c.step()).toBe(1);
		expectFocused(q('#cp-val'));
		expectFieldProblem(q('#cp-val'), 'قيمة الخصم غير مسموحة لهذا النوع');
		expect(c.form().code).toBe('SUMMER');
		expect(q<HTMLInputElement>('#cp-code')!.value).toBe('SUMMER');
		expect(c.saving()).toBe(false);
	});

	it('a 429 stays a generic honest message: no field is marked', async () => {
		const { c, q, el, flush, create } = await setup();
		fillValid(c);
		create.mockReturnValue(throwError(() => httpFail(429, { message: 'Too many requests' })));
		c.step.set(2);
		await flush();
		c.save();
		await flush();
		expectNoFieldProblem(el);
		expect(el.querySelectorAll('[aria-invalid="true"]').length).toBe(0);
		expect(q('[data-testid="form-error"]')!.textContent!.trim().length).toBeGreaterThan(0);
		expect(c.step()).toBe(2);
	});

	it('network failure and 500 are also generic', async () => {
		for (const status of [0, 500, 403, 409]) {
			const { c, el, flush, create } = await setup();
			fillValid(c);
			create.mockReturnValue(throwError(() => httpFail(status, null)));
			c.step.set(2);
			await flush();
			c.save();
			await flush();
			expectNoFieldProblem(el);
			expect(c.formError()).toBeTruthy();
			TestBed.resetTestingModule();
		}
	});

	it('double click on save sends ONE request', async () => {
		const { c, q, flush, create } = await setup();
		fillValid(c);
		const pending = new Subject<any>();
		create.mockReturnValue(pending);
		c.step.set(2);
		await flush();
		const btn = [...q('.save-bar')!.querySelectorAll('button')].find(b => b.textContent?.includes('حفظ'))! as HTMLButtonElement;
		btn.click();
		btn.click();
		c.save();
		await flush();
		expect(create).toHaveBeenCalledTimes(1);
		expect(btn.disabled).toBe(true);
	});
});

describe('coupon form: no ready-made numbers (owner batch B section 6)', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('a new coupon starts with every numeric field empty and guidance text without an invented number', async () => {
		const { q } = await setup();
		for (const id of ['#cp-val', '#cp-min', '#cp-max', '#cp-per']) {
			const input = q<HTMLInputElement>(id)!;
			expect(input.value, id).toBe('');
			expect(input.getAttribute('placeholder'), id).toBeTruthy();
			expect(input.getAttribute('placeholder'), id).not.toMatch(/[0-9٠-٩]/);
		}
	});

	it('maxUsesPerUser is required: empty is rejected, it is not silently turned into 1', async () => {
		const { c, q, flush, create } = await setup();
		c.patch({ code: 'SUMMER', discountValue: 10, maxUses: 5, scopeMode: 'all' });
		c.save();
		await flush();
		expect(create).not.toHaveBeenCalled();
		expectFieldProblem(q('#cp-per'));
	});

	it('editing restores the real saved numbers', async () => {
		const { q } = await setup({ id: 'k1' });
		expect(q<HTMLInputElement>('#cp-val')!.value).toBe('12');
		expect(q<HTMLInputElement>('#cp-min')!.value).toBe('80');
		expect(q<HTMLInputElement>('#cp-max')!.value).toBe('40');
		expect(q<HTMLInputElement>('#cp-per')!.value).toBe('3');
	});
});
