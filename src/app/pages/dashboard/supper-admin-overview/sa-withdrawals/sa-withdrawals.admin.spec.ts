import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../shared/forms/form-spec-utils';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SaWithdrawals } from './sa-withdrawals';
import { SaWithdrawalDetail } from './sa-withdrawal-detail/sa-withdrawal-detail';
import { WithdrawalApiService } from '../../../../core/services/withdrawal-api.service';
import { AdminOpsApiService } from '../../../../core/services/admin-ops-api.service';

const ROW = (id: string, status: string, over: any = {}) => ({
	id, status, amount: 75.5, currency: 'USD', method: 'paypal', paypalEmail: 'dest@example.com', createdAt: '2026-10-01T10:00:00Z',
	user: { id: 'u1', firstName: 'ليلى', lastName: 'الحربي', email: 'laila@example.com', accountType: 'PROVIDER', affiliateProfile: null }, ...over,
});
const COUNTS = { PENDING: { count: 3, amount: 300 }, APPROVED: { count: 1, amount: 50 }, PROCESSING: { count: 0, amount: 0 }, COMPLETED: { count: 7, amount: 900 }, REJECTED: { count: 2, amount: 20 }, REVERSED: { count: 1, amount: 11 } };

/** saveBlob is an ESM export (cannot be spied): observe the real browser calls instead. */
function stubSave() {
	(URL as any).createObjectURL = vi.fn(() => 'blob:test');
	(URL as any).revokeObjectURL = vi.fn();
	return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
}

afterEach(() => TestBed.resetTestingModule());

describe('SaWithdrawals list (real API fields)', () => {
	function setup(rows: any[], list = vi.fn((_q?: any) => of({ success: true, data: { items: rows, counts: COUNTS, pagination: { page: 1, limit: 10, total: 25, pages: 3, totalPages: 3 } } } as any))) {
		const csv = vi.fn((_n: any, _f?: any) => of(new Blob(['a'])));
		const save = stubSave();
		TestBed.configureTestingModule({
			imports: [SaWithdrawals],
			providers: [provideRouter([]), { provide: WithdrawalApiService, useValue: { getAdminWithdrawals: list } }, { provide: AdminOpsApiService, useValue: { downloadCsv: csv } }],
		});
		const f = TestBed.createComponent(SaWithdrawals);
		f.detectChanges();
		return { f, el: f.nativeElement as HTMLElement, list, csv, save };
	}

	it('renders the API user, Arabic status label, real counts and totalPages', () => {
		const { el } = setup([ROW('wd-1', 'PROCESSING'), ROW('wd-2', 'REVERSED', { user: { firstName: '', lastName: '', email: 'only@mail.com' } })]);
		const text = el.textContent || '';
		expect(text).toContain('ليلى الحربي');
		expect(text).toContain('only@mail.com');
		expect(text).toContain('قيد التحويل');
		expect(text).toContain('أُعيد من PayPal');
		for (const l of ['قيد المراجعة', 'معتمد (بانتظار التحويل)', 'تم التحويل', 'مرفوض']) expect(text).toContain(l);
		expect(text).toContain('صفحة 1 من 3');
		const tabs = Array.from(el.querySelectorAll('.wd-filters .wd-ftab')).map((b) => b.textContent || '');
		expect(tabs.find((t) => t.includes('قيد المراجعة'))).toContain('3');
		expect(tabs.find((t) => t.includes('الكل'))).toContain('14'); // 3+1+0+7+2+1
		expect(el.querySelector('[data-testid="wd-paypal-destination"]')?.textContent).toContain('dest@example.com');
	});

	it('owner filter sends the owner param and resets the page', () => {
		const { f, el, list } = setup([ROW('wd-1', 'PENDING')]);
		const btns = Array.from(el.querySelectorAll('[data-testid="wd-owner-filter"] button')) as HTMLButtonElement[];
		btns.find((b) => b.textContent?.includes('الوسطاء التسويقيون'))!.click();
		f.detectChanges();
		expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ owner: 'affiliate', page: 1 }));
		btns.find((b) => b.textContent?.includes('مقدمو الخدمة'))!.click();
		expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ owner: 'provider' }));
	});

	it('CSV button calls downloadCsv("withdrawals", {status}) and saves the file', () => {
		const { f, el, csv, save } = setup([ROW('wd-1', 'PENDING')]);
		(Array.from(el.querySelectorAll('.wd-filters .wd-ftab')).find((b) => b.textContent?.includes('قيد المراجعة')) as HTMLButtonElement).click();
		f.detectChanges();
		(el.querySelector('[data-testid="wd-export-csv"]') as HTMLButtonElement).click();
		expect(csv).toHaveBeenCalledWith('withdrawals', { status: 'PENDING' });
		expect(save).toHaveBeenCalled();
	});
});

describe('SaWithdrawalDetail actions', () => {
	function setup(row: any) {
		const api = {
			getAdminWithdrawal: vi.fn(() => of({ success: true, data: row } as any)),
			approveAdminWithdrawal: vi.fn(() => of({ success: true, data: { ...row, status: 'APPROVED' } } as any)),
			rejectAdminWithdrawal: vi.fn(() => of({ success: true, data: { ...row, status: 'REJECTED' } } as any)),
			sendAdminWithdrawalPayout: vi.fn(() => of({ success: true, data: { outcome: 'SENT', message: 'تم إرسال التحويل' } })),
		};
		const route = { paramMap: of(convertToParamMap({ id: row.id })), snapshot: { paramMap: convertToParamMap({ id: row.id }) } };
		TestBed.configureTestingModule({ imports: [SaWithdrawalDetail], providers: [provideRouter([]), { provide: ActivatedRoute, useValue: route }, { provide: WithdrawalApiService, useValue: api }] });
		const f = TestBed.createComponent(SaWithdrawalDetail);
		f.detectChanges();
		return { f, api, el: f.nativeElement as HTMLElement };
	}
	const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement | null;

	it('approve and reject require a confirmation modal with the warning before any API call', () => {
		const { f, api, el } = setup(ROW('wd-9', 'PENDING'));
		q(el, 'wd-approve')!.click(); f.detectChanges();
		expect(api.approveAdminWithdrawal).not.toHaveBeenCalled();
		expect(q(el, 'wd-action-modal')).toBeTruthy();
		expect(el.textContent).toContain('اعتماد الطلب لا يحوّل المال؛ التحويل خطوة منفصلة');
		q(el, 'wd-action-confirm')!.click(); f.detectChanges();
		expect(api.approveAdminWithdrawal).toHaveBeenCalledTimes(1);
	});

	it('reject shows the final-warning modal and does not call the API until confirmed with a reason', () => {
		const { f, api, el } = setup(ROW('wd-11', 'PENDING'));
		q(el, 'wd-reject')!.click(); f.detectChanges();
		expect(el.textContent).toContain('الرفض نهائي ويُبلَّغ به المستخدم');
		expect(api.rejectAdminWithdrawal).not.toHaveBeenCalled();
		q(el, 'wd-action-confirm')!.click(); f.detectChanges();
		expect(api.rejectAdminWithdrawal).not.toHaveBeenCalled(); // reason is required
		const ta = el.querySelector('[data-testid="wd-action-modal"] textarea') as HTMLTextAreaElement;
		ta.value = 'بيانات غير مكتملة'; ta.dispatchEvent(new Event('input'));
		q(el, 'wd-action-confirm')!.click(); f.detectChanges();
		expect(api.rejectAdminWithdrawal).toHaveBeenCalledWith('wd-11', { rejectionReason: 'بيانات غير مكتملة' });
	});

	it('send-payout is disabled with the reason when automation is off', () => {
		const { f, api, el } = setup(ROW('wd-12', 'APPROVED', { payoutAutomationEnabled: false }));
		const btn = q(el, 'wd-send-payout')!;
		expect(btn.disabled).toBe(true);
		expect(q(el, 'wd-payout-off')?.textContent).toContain('التحويل الآلي عبر PayPal غير مفعّل في هذه البيئة');
		btn.click(); f.detectChanges();
		expect(api.sendAdminWithdrawalPayout).not.toHaveBeenCalled();
	});

	it('send-payout asks for confirmation (amount + PayPal email), then calls the API and shows its message', () => {
		const { f, api, el } = setup(ROW('wd-13', 'APPROVED', { payoutAutomationEnabled: true, payoutAttempts: [{ id: 'a1', status: 'FAILED', createdAt: '2026-10-02T10:00:00Z', updatedAt: '2026-10-02T10:01:00Z' }] }));
		expect(q(el, 'wd-attempts')).toBeTruthy();
		q(el, 'wd-send-payout')!.click(); f.detectChanges();
		expect(api.sendAdminWithdrawalPayout).not.toHaveBeenCalled();
		const modal = q(el, 'wd-payout-modal')!;
		expect(modal.textContent).toContain('dest@example.com');
		expect(modal.textContent).toContain('لا يمكن التراجع');
		q(el, 'wd-payout-confirm')!.click(); f.detectChanges();
		expect(api.sendAdminWithdrawalPayout).toHaveBeenCalledWith('wd-13');
		expect(q(el, 'wd-payout-result')?.textContent).toContain('تم إرسال التحويل');
	});

	it('send-payout button is not offered for a PENDING request', () => {
		const { el } = setup(ROW('wd-14', 'PENDING', { payoutAutomationEnabled: true }));
		expect(q(el, 'wd-send-payout')).toBeNull();
	});

	it('reject without a reason: message under the reason box, focus there, nothing sent', async () => {
		const { f, api, el } = setup(ROW('wd-21', 'PENDING'));
		q(el, 'wd-reject')!.click(); f.detectChanges();
		q(el, 'wd-action-confirm')!.click(); await settleForm();
		const ta = el.querySelector('#wd-reject-reason');
		expectFieldProblem(ta, 'سبب الرفض');
		expectFocused(ta);
		expect(api.rejectAdminWithdrawal).not.toHaveBeenCalled();
	});

	it('reject: a 400 naming rejectionReason goes under the box; 429 / 500 / 409 / 403 / network stay a generic alert (reason kept)', async () => {
		const { f, api, el } = setup(ROW('wd-22', 'PENDING'));
		q(el, 'wd-reject')!.click(); f.detectChanges();
		const ta = el.querySelector('#wd-reject-reason') as HTMLTextAreaElement;
		ta.value = 'بيانات ناقصة'; ta.dispatchEvent(new Event('input'));
		api.rejectAdminWithdrawal.mockReturnValueOnce(throwError(() => httpFail(400, { errors: [{ field: 'rejectionReason', message: 'السبب قصير جدًا' }] })));
		q(el, 'wd-action-confirm')!.click(); await settleForm(); f.detectChanges();
		expectFieldProblem(ta, 'قصير جدًا');
		for (const st of [429, 500, 409, 403, 0]) {
			api.rejectAdminWithdrawal.mockReturnValueOnce(throwError(() => httpFail(st, { message: 'x' })));
			q(el, 'wd-action-confirm')!.click(); await settleForm(); f.detectChanges();
			expectNoFieldProblem(el);
			expect(q(el, 'wd-action-error')?.getAttribute('role'), String(st)).toBe('alert');
		}
		expect(ta.value).toBe('بيانات ناقصة');
		expect(el.querySelector('[data-testid="wd-action-modal"]')).toBeTruthy();
	});

	it('double click on confirm sends one approve request', () => {
		const { f, api, el } = setup(ROW('wd-23', 'PENDING'));
		api.approveAdminWithdrawal.mockReturnValue(new Subject() as any);
		q(el, 'wd-approve')!.click(); f.detectChanges();
		const b = q(el, 'wd-action-confirm')!;
		b.click(); b.click();
		expect(api.approveAdminWithdrawal).toHaveBeenCalledTimes(1);
	});
});
