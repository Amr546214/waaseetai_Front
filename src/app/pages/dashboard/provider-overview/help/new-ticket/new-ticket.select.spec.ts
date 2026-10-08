import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NewTicketComponent } from './new-ticket';
import { AuthStore } from '../../../../../core/store/auth.store';
import { TicketApiService } from '../../../../../core/services/ticket-api.service';

describe('provider new ticket: site ws-select instead of native selects', () => {
	let create: ReturnType<typeof vi.fn>;
	async function mount(accountType = 'PROVIDER_INDIVIDUAL') {
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

	it('no native select; opening the category list shows the real categories; the pick changes the value and the payload', async () => {
		const { f, el, c } = await mount();
		expect(el.querySelector('select')).toBeNull();
		(el.querySelector('ws-select#tk-cat button') as HTMLButtonElement).click(); f.detectChanges();
		const labels = Array.from(el.querySelectorAll('[data-testid=ws-select-option]')).map(o => o.textContent?.trim());
		expect(labels).toEqual(c.activeCategories);
		(el.querySelectorAll('[data-testid=ws-select-option]')[1] as HTMLElement).click(); f.detectChanges(); await f.whenStable();
		expect(c.category()).toBe(c.activeCategories[1]);
		c.subject.set('مشكلة في السحب'); c.description.set('وصف تفصيلي كافٍ لمشكلة السحب في المحفظة');
		c.submit();
		expect(create).toHaveBeenCalledTimes(1);
		expect(create.mock.calls[0][0]).toBe('provider');
		expect(create.mock.calls[0][1]).toEqual(expect.objectContaining({ category: c.activeCategories[1], priority: 'عادية' }));
	});

	it('validation is unchanged: no category -> blocked with the same message', async () => {
		const { c } = await mount();
		c.subject.set('مشكلة في السحب'); c.description.set('وصف تفصيلي كافٍ لمشكلة السحب في المحفظة');
		c.submit();
		expect(c.errors()['cat']).toBe('اختر التصنيف');
		expect(create).not.toHaveBeenCalled();
	});

	it('company mode: category, project and member are ws-select (priority is not shown for companies)', async () => {
		const { el } = await mount('PROVIDER_COMPANY');
		expect(el.querySelector('select')).toBeNull();
		expect(el.querySelectorAll('ws-select').length).toBe(3);
	});
});
