import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProfileEdit } from './profile-edit';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Client profile/edit, "البيانات الأساسية": the name is a governed field -> PUT /profiles/update/basics only records a modification request.
describe('client profile-edit: name change is a request, never a fake save', () => {
	let fixture: ComponentFixture<ProfileEdit>;
	let c: ProfileEdit;
	let updateTab: ReturnType<typeof vi.fn>;
	let getMyChangeRequests: ReturnType<typeof vi.fn>;

	async function mount(opts: { pending?: any[]; updateImpl?: () => any } = {}) {
		updateTab = vi.fn(opts.updateImpl ?? (() => of({ success: true, message: 'تم إرسال طلب تعديل البيانات الأساسية للمراجعة', data: { isPendingRequest: true, requestId: 'req-1', status: 'PENDING_HUMAN_REVIEW' } })));
		getMyChangeRequests = vi.fn(() => of({ success: true, data: opts.pending ?? [] }));
		await TestBed.configureTestingModule({
			imports: [ProfileEdit],
			providers: [
				provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
				{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT' }), token: () => 't', authenticate: vi.fn() } },
				{ provide: ProfileApiService, useValue: {
					getMyProfile: () => of({ success: true, data: { currentProfileData: { firstName: 'Nora', lastName: 'Quest', email: 'c@x.co', phoneNumber: '0500000000' }, latestHistory: [] } }),
					getChangeRequests: () => of({ success: true, data: [] }), getMyChangeRequests, updateTab, updateProfile: vi.fn(() => of({ success: true })),
				} },
			],
		}).compileComponents();
		fixture = TestBed.createComponent(ProfileEdit);
		c = fixture.componentInstance;
		fixture.detectChanges();
		c.switchTab('basics'); fixture.detectChanges();
		return fixture.nativeElement as HTMLElement;
	}
	afterEach(() => TestBed.resetTestingModule());
	const submit = (el: HTMLElement) => (el.querySelector('[data-testid=basics-submit]') as HTMLButtonElement);

	it('the button reads "إرسال طلب تعديل" and the note says the name is reviewed first (not saved at once)', async () => {
		const el = await mount();
		expect(submit(el).textContent?.trim()).toBe('إرسال طلب تعديل');
		const note = el.querySelector('[data-testid=basics-note]')!.textContent!;
		expect(note).toContain('طلب تعديل');
		expect(note).toContain('طلباتي السابقة');
		expect(note).not.toContain('المحفوظ من هذه الصفحة هو الاسم');
	});

	it('submitting sends the name to the basics endpoint, shows "تم إرسال طلب تعديل…", never "تم حفظ"', async () => {
		const el = await mount();
		c.basicsForm.patchValue({ firstName: 'سارة', lastName: 'العتيبي' });
		c.saveTab('basics'); fixture.detectChanges();
		expect(updateTab).toHaveBeenCalledWith('basics', { firstName: 'سارة', lastName: 'العتيبي' });
		expect(c.successMsg()).toBe('تم إرسال طلب تعديل البيانات الأساسية للمراجعة');
		expect(c.successMsg()).not.toContain('حفظ');
	});

	it('the form goes back to the applied name (no fake local change) and a pending note shows the requested name', async () => {
		const el = await mount();
		c.basicsForm.patchValue({ firstName: 'سارة', lastName: 'العتيبي' });
		c.saveTab('basics'); fixture.detectChanges();
		expect(c.basicsForm.get('firstName')?.value).toBe('Nora');
		expect(c.basicsForm.get('lastName')?.value).toBe('Quest');
		const pending = el.querySelector('[data-testid=basics-pending]')!;
		expect(pending.textContent).toContain('سارة العتيبي');
		expect(pending.textContent).toContain('قيد المراجعة');
		expect(submit(el).disabled).toBe(true);
	});

	it('"طلباتي السابقة" links to the profile change-requests page', async () => {
		const el = await mount({ pending: [{ id: 'r1', category: 'CLIENT_BASIC_INFO', status: 'PENDING_HUMAN_REVIEW', requestedValue: 'سارة العتيبي' }] });
		const links = Array.from(el.querySelectorAll('a')).filter(a => a.textContent?.includes('طلباتي السابقة'));
		expect(links.length).toBeGreaterThan(0);
		for (const a of links) expect(a.getAttribute('href')).toBe('/client-overview/profile/requests');
	});

	it('an existing pending request is shown on open: the button is disabled and a new submit sends nothing', async () => {
		const el = await mount({ pending: [{ id: 'r1', category: 'CLIENT_BASIC_INFO', status: 'PENDING_HUMAN_REVIEW', requestedValue: 'سارة العتيبي' }] });
		expect(el.querySelector('[data-testid=basics-pending]')?.textContent).toContain('سارة العتيبي');
		expect(submit(el).disabled).toBe(true);
		c.saveTab('basics');
		expect(updateTab).not.toHaveBeenCalled();
		expect(c.errorMsg()).toContain('قيد المراجعة بالفعل');
	});

	it('a decided (rejected / approved) earlier request does not block a new one', async () => {
		const el = await mount({ pending: [{ id: 'r0', category: 'CLIENT_BASIC_INFO', status: 'REJECTED', requestedValue: 'x y' }, { id: 'r00', category: 'CLIENT_IDENTITY', status: 'PENDING_HUMAN_REVIEW', requestedValue: '******1' }] });
		expect(el.querySelector('[data-testid=basics-pending]')).toBeNull();
		expect(submit(el).disabled).toBe(false);
	});

	it('a server 409 (duplicate) shows its message and no pending/fake state is created', async () => {
		await mount({ updateImpl: () => throwError(() => new HttpErrorResponse({ status: 409, error: { success: false, message: 'لديك طلب تعديل للبيانات الأساسية قيد المراجعة بالفعل' } })) });
		c.basicsForm.patchValue({ firstName: 'سارة', lastName: 'العتيبي' });
		c.saveTab('basics');
		expect(c.errorMsg()).toContain('قيد المراجعة بالفعل');
		expect(c.successMsg()).toBe('');
		expect(c.pendingNameRequest()).toBeNull();
	});

	it('an unchanged name (server records nothing) says so instead of claiming a save', async () => {
		await mount({ updateImpl: () => of({ success: true, message: 'تم التحديث. التعديلات الحساسة تتطلب التحقق.', data: { message: 'x' } }) });
		c.saveTab('basics');
		expect(c.successMsg()).toBe('لا توجد تغييرات على الاسم');
		expect(c.pendingNameRequest()).toBeNull();
	});
});
