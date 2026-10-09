import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SaModificationRequests } from './sa-modification-requests';
import { SaModificationRequestsService } from './sa-modification-requests.service';

// Admin queue for profile modification requests: marketers (ProfileChangeRequest) + providers/clients (ProfileModificationRequest), with history.
const aff = (over: any = {}) => ({
	id: 'aff-1', requestNumber: 'REQ-100001', fieldType: 'FIRST_NAME', fieldLabel: 'الاسم الأول', currentValue: 'نورة', requestedValue: 'سارة',
	status: 'PENDING_AI_REVIEW', createdAt: '2026-10-08T10:00:00Z', affiliateProfile: { id: 'a', referralSlug: null, user: { id: 'u1', firstName: 'نورة', lastName: 'ع', email: 'n@x.co' } }, ...over,
});
const prof = (over: any = {}) => ({
	id: 'abcdef12-0000-4000-8000-000000000000', fieldName: 'NATIONAL_ID', fieldLabel: 'رقم الهوية / الإقامة', currentValue: '******0001', requestedValue: '******6789', category: 'CLIENT_IDENTITY',
	status: 'PENDING_HUMAN_REVIEW', createdAt: '2026-10-08T11:00:00Z', provider: { firstName: 'خالد', lastName: 'ش', email: 'k@x.co', accountType: 'CLIENT_INDIVIDUAL' }, ...over,
});

describe('admin modification requests: all roles + history', () => {
	let svc: any;
	async function mount(opts: { affiliate?: any; profile?: any } = {}) {
		svc = {
			list: vi.fn(() => opts.affiliate ?? of({ success: true, data: [] })),
			listProfileRequests: vi.fn(() => opts.profile ?? of({ success: true, data: [] })),
			approve: vi.fn(() => of({ success: true })),
			reject: vi.fn(() => of({ success: true })),
			reviewProfileRequest: vi.fn(() => of({ success: true })),
		};
		await TestBed.configureTestingModule({ imports: [SaModificationRequests], providers: [{ provide: SaModificationRequestsService, useValue: svc }] }).compileComponents();
		const f = TestBed.createComponent(SaModificationRequests);
		f.detectChanges(); await f.whenStable(); f.detectChanges();
		return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement };
	}
	afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });

	it('loads BOTH sources with their history (ALL), merged newest first, with the right requester type', async () => {
		const { c } = await mount({
			affiliate: of({ success: true, data: [aff(), aff({ id: 'aff-2', status: 'APPROVED_AND_APPLIED', createdAt: '2026-10-07T10:00:00Z' }), aff({ id: 'aff-3', status: 'WITHDRAWN' })] }),
			profile: of({ success: true, data: [prof(), prof({ id: 'p-2', status: 'APPROVED', provider: { firstName: 'م', lastName: 'ح', email: 'p@x.co', accountType: 'PROVIDER_INDIVIDUAL' }, createdAt: '2026-10-06T10:00:00Z' }), prof({ id: 'p-3', status: 'PENDING_OTP' })] }),
		});
		expect(svc.list).toHaveBeenCalledWith('ALL');
		expect(svc.listProfileRequests).toHaveBeenCalledWith('ALL');
		const rows = c.requests();
		expect(rows.map(r => r.id)).toEqual(['abcdef12-0000-4000-8000-000000000000', 'aff-1', 'aff-2', 'p-2']);   // newest first; WITHDRAWN and PENDING_OTP are not queue items
		expect(rows.map(r => r.requesterType)).toEqual(['طالب خدمة', 'وسيط تسويقي', 'وسيط تسويقي', 'مقدم خدمة']);
		expect(rows.map(r => r.status)).toEqual(['human', 'ai', 'ok', 'ok']);
		expect(c.countFor('ok')).toBe(2);   // decided requests stay visible (history), they no longer vanish
	});

	it('approve / reject go to the endpoint of the request\'s own source', async () => {
		const { c } = await mount({ affiliate: of({ success: true, data: [aff()] }), profile: of({ success: true, data: [prof()] }) });
		const [profileRow, affRow] = [c.requests().find(r => r.source === 'profile')!, c.requests().find(r => r.source === 'affiliate')!];
		c.approve(profileRow);
		expect(svc.reviewProfileRequest).toHaveBeenCalledWith(profileRow.id, true);
		expect(svc.approve).not.toHaveBeenCalled();
		c.approve(affRow);
		expect(svc.approve).toHaveBeenCalledWith('aff-1');
		vi.spyOn(window, 'prompt').mockReturnValue('  الصورة غير واضحة ');
		c.reject(profileRow);
		expect(svc.reviewProfileRequest).toHaveBeenLastCalledWith(profileRow.id, false, 'الصورة غير واضحة');
		c.reject(affRow);
		expect(svc.reject).toHaveBeenCalledWith('aff-1', 'الصورة غير واضحة');
	});

	it('a rejected decision with no reason is not sent', async () => {
		const { c } = await mount({ profile: of({ success: true, data: [prof()] }) });
		vi.spyOn(window, 'prompt').mockReturnValue('   ');
		c.reject(c.requests()[0]);
		expect(svc.reviewProfileRequest).not.toHaveBeenCalled();
	});

	it('a failed decision shows the server message and no success', async () => {
		const { c } = await mount({ profile: of({ success: true, data: [prof()] }) });
		svc.reviewProfileRequest.mockReturnValueOnce(throwError(() => ({ error: { message: 'REQUEST_NOT_PENDING_REVIEW' } })));
		c.approve(c.requests()[0]);
		expect(c.toast()).toBe('REQUEST_NOT_PENDING_REVIEW');
	});

	it('one source failing still shows the other, with a visible incomplete-list warning', async () => {
		const { c, el } = await mount({ affiliate: throwError(() => ({ status: 500 })), profile: of({ success: true, data: [prof()] }) });
		expect(c.hasError()).toBe(false);
		expect(c.requests().length).toBe(1);
		expect(c.failedSources()).toEqual(['الوسطاء']);
		expect(el.querySelector('[data-testid="partial-load-error"]')?.textContent).toContain('الوسطاء');
	});

	it('both sources failing is an error state (not an empty list) and retry reloads', async () => {
		const { f, c, el } = await mount({ affiliate: throwError(() => ({ status: 429 })), profile: of({ success: false }) });
		expect(c.hasError()).toBe(true);
		expect(el.querySelector('[data-testid="admin-requests-error"]')).not.toBeNull();
		expect(el.textContent).not.toContain('لا توجد طلبات في هذا التصنيف');
		svc.list.mockReturnValue(of({ success: true, data: [] })); svc.listProfileRequests.mockReturnValue(of({ success: true, data: [] }));
		c.loadRequests(); f.detectChanges(); await f.whenStable(); f.detectChanges();
		expect(svc.list).toHaveBeenCalledTimes(2);
		expect(c.hasError()).toBe(false);
		expect(el.textContent).toContain('لا توجد طلبات في هذا التصنيف');
	});

	it('decided requests show no fake action buttons (no "طلب مصحح" / "التفاصيل" toast-only buttons)', async () => {
		const { el } = await mount({ affiliate: of({ success: true, data: [aff({ status: 'REJECTED', rejectionReason: 'x' }), aff({ id: 'a2', status: 'APPROVED_AND_APPLIED' })] }) });
		expect(el.textContent).not.toContain('طلب مصحح');
		expect(el.textContent).not.toContain('التفاصيل');
		expect(el.querySelectorAll('.mr-actions button').length).toBe(0);   // no approve/reject on decided requests either
	});
});

describe('admin modification requests: AI pre-review block', () => {
	const READY = { status: 'READY', source: 'GEMINI', summary: 'ملخص للمراجع', recommendation: 'توصية للمراجع', generatedAt: null, observations: ['مرصود'] };
	async function mountWith(rows: any[]) {
		const svc: any = { list: () => of({ success: true, data: [aff()] }), listProfileRequests: () => of({ success: true, data: rows }), approve: vi.fn(), reject: vi.fn(), reviewProfileRequest: vi.fn() };
		await TestBed.configureTestingModule({ imports: [SaModificationRequests], providers: [{ provide: SaModificationRequestsService, useValue: svc }] }).compileComponents();
		const f = TestBed.createComponent(SaModificationRequests);
		f.detectChanges(); await f.whenStable(); f.detectChanges();
		return f.nativeElement as HTMLElement;
	}
	afterEach(() => TestBed.resetTestingModule());

	it('READY shows the advisory block; null waits; FAILED says unavailable; password change shows none; marketer requests show none', async () => {
		const el = await mountWith([
			prof({ id: 'p-ready', aiReview: READY }),
			prof({ id: 'p-null', aiReview: null }),
			prof({ id: 'p-fail', aiReview: { ...READY, status: 'FAILED', summary: null, recommendation: null, observations: [] } }),
			prof({ id: 'p-pw', category: 'CLIENT_PASSWORD_CHANGE', aiReview: null }),
		]);
		expect(el.querySelectorAll('[data-testid="ai-review-ready"]').length).toBe(1);
		expect(el.textContent).toContain('ملخص للمراجع');
		expect(el.textContent).toContain('استشاري، القرار للمراجع');
		expect(el.querySelectorAll('[data-testid="ai-review-failed"]').length).toBe(1);
		expect(el.querySelectorAll('[data-testid="ai-review-waiting"]').length).toBe(1);   // p-null only (password + marketer: none)
		expect(el.textContent).not.toContain('ثقة');
	});
});
