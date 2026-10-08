import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProfileRequests } from './profile-requests';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';

describe('client profile requests: withdrawing a request', () => {
	let api: any;
	async function mount() {
		api = { getMyChangeRequests: vi.fn(() => of({ success: true, data: [{ id: 'r1', status: 'PENDING_HUMAN_REVIEW', fieldLabel: 'رقم الهوية / الإقامة', currentValue: '******0001', requestedValue: '******6789', createdAt: '2026-10-08T10:00:00Z' }] })), cancelMyChangeRequest: vi.fn(() => of({ success: true })) };
		await TestBed.configureTestingModule({ imports: [ProfileRequests], providers: [{ provide: ProfileApiService, useValue: api }] }).compileComponents();
		const f = TestBed.createComponent(ProfileRequests);
		f.detectChanges(); await f.whenStable(); f.detectChanges();
		return f.componentInstance;
	}
	afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });

	it('confirmed withdraw calls the endpoint, reloads the list and says so', async () => {
		const c = await mount();
		vi.spyOn(window, 'confirm').mockReturnValue(true);
		c.cancelRequest('r1');
		expect(api.cancelMyChangeRequest).toHaveBeenCalledWith('r1');
		expect(api.getMyChangeRequests).toHaveBeenCalledTimes(2);
		expect(c.showToast()).toBe('تم سحب الطلب');
	});

	it('declined confirm does nothing', async () => {
		const c = await mount();
		vi.spyOn(window, 'confirm').mockReturnValue(false);
		c.cancelRequest('r1');
		expect(api.cancelMyChangeRequest).not.toHaveBeenCalled();
	});

	it('a failed withdraw shows the server message and never claims success', async () => {
		const c = await mount();
		vi.spyOn(window, 'confirm').mockReturnValue(true);
		api.cancelMyChangeRequest.mockReturnValueOnce(throwError(() => ({ error: { message: 'لا يمكن سحب هذا الطلب لأنه لم يعد قيد المراجعة' } })));
		c.cancelRequest('r1');
		expect(c.showToast()).toContain('لم يعد قيد المراجعة');
		expect(api.getMyChangeRequests).toHaveBeenCalledTimes(1);
	});
});
