import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NewTicketComponent } from './new-ticket';
import { AuthStore } from '../../../../../core/store/auth.store';
import { TicketApiService } from '../../../../../core/services/ticket-api.service';

describe('client new ticket: the category/priority dropdowns are the site ws-select, not native selects', () => {
	let create: ReturnType<typeof vi.fn>;
	async function mount(accountType = 'CLIENT_INDIVIDUAL') {
		create = vi.fn(() => of({ success: true, data: { id: 't1' } }));
		TestBed.configureTestingModule({
			imports: [NewTicketComponent],
			providers: [provideRouter([]), { provide: AuthStore, useValue: { currentUser: () => ({ accountType }) } }, { provide: TicketApiService, useValue: { createTicket: create } }],
		});
		const f = TestBed.createComponent(NewTicketComponent);
		f.detectChanges(); await f.whenStable(); f.detectChanges();
		return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('there is no native <select> on the page (individual and company)', async () => {
		expect((await mount()).el.querySelector('select')).toBeNull();
		TestBed.resetTestingModule();
		const company = await mount('CLIENT_COMPANY');
		expect(company.el.querySelector('select')).toBeNull();
		expect(company.el.querySelectorAll('ws-select').length).toBe(4);
	});

	it('opening the category list shows the real categories inside our component', async () => {
		const { f, el, c } = await mount();
		(el.querySelector('#tk-cat [data-testid=ws-select-trigger], ws-select#tk-cat button') as HTMLButtonElement).click(); f.detectChanges();
		const labels = Array.from(el.querySelectorAll('[data-testid=ws-select-option]')).map(o => o.textContent?.trim());
		expect(labels).toEqual(c.individualCategories);
	});

	it('choosing a category changes the form value; the submitted payload carries that exact string', async () => {
		const { f, el, c } = await mount();
		(el.querySelector('ws-select#tk-cat button') as HTMLButtonElement).click(); f.detectChanges();
		(el.querySelectorAll('[data-testid=ws-select-option]')[2] as HTMLElement).click(); f.detectChanges(); await f.whenStable();
		expect(c.category()).toBe('النزاعات');
		c.subject.set('مشكلة في الدفع'); c.description.set('وصف تفصيلي كافٍ لمشكلة الدفع في الطلب');
		c.submit();
		expect(create).toHaveBeenCalledTimes(1);
		const [role, body] = create.mock.calls[0];
		expect(role).toBe('client');
		expect(body).toEqual(expect.objectContaining({ category: 'النزاعات', priority: 'عادية', subject: 'مشكلة في الدفع' }));
	});

	it('validation is unchanged: without a category the submit is blocked with the same message and nothing is sent', async () => {
		const { c } = await mount();
		c.subject.set('مشكلة في الدفع'); c.description.set('وصف تفصيلي كافٍ لمشكلة الدفع في الطلب');
		c.submit();
		expect(c.errors()['cat']).toBe('اختر التصنيف');
		expect(create).not.toHaveBeenCalled();
	});

	it('the priority list defaults to عادية and can be changed', async () => {
		const { f, el, c } = await mount();
		expect(el.querySelector('ws-select#tk-priority button')?.textContent).toContain('عادية');
		(el.querySelector('ws-select#tk-priority button') as HTMLButtonElement).click(); f.detectChanges();
		(el.querySelectorAll('[data-testid=ws-select-option]')[2] as HTMLElement).click(); f.detectChanges(); await f.whenStable();
		expect(c.priority()).toBe('عاجلة');
	});
});
