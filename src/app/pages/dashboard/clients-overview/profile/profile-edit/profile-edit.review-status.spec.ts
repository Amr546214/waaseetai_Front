import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProfileEdit } from './profile-edit';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Client: the unified review lifecycle (GET /profiles/me -> reviewStatus) drives the identity / name / password states and the completion card.
const entry = (status: string, extra: any = {}) => ({ status, requestId: 'r1', category: 'X', submittedAt: '2026-10-10T10:00:00Z', reviewedAt: null, rejectionReason: null, ...extra });
const NONE = { status: 'NOT_SUBMITTED', requestId: null, category: null, submittedAt: null, reviewedAt: null, rejectionReason: null };

describe('client profile-edit: review status', () => {
	let fixture: ComponentFixture<ProfileEdit>;
	let c: ProfileEdit;
	let updateTab: ReturnType<typeof vi.fn>;
	const el = () => fixture.nativeElement as HTMLElement;
	const q = (s: string) => el().querySelector(s) as HTMLElement | null;

	async function mount(initial: any, missingItems: any[] = [], updateImpl?: () => any) {
		let reviewStatus = initial; // what the backend would answer on the next read
		updateTab = vi.fn(updateImpl ?? (() => { reviewStatus = { ...reviewStatus, identity: entry('PENDING_REVIEW', { requestId: 'r9', category: 'CLIENT_IDENTITY' }) }; return of({ success: true, message: 'ok', data: { isPendingRequest: true, requestId: 'r9', status: 'PENDING_HUMAN_REVIEW' } }); }));
		await TestBed.configureTestingModule({
			imports: [ProfileEdit],
			providers: [
				provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
				{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT' }), token: () => 't', authenticate: vi.fn() } },
				{ provide: ProfileApiService, useValue: {
					getMyProfile: () => of({ success: true, data: { currentProfileData: { firstName: 'Nora', lastName: 'Quest', email: 'c@x.co', phoneNumber: '0500000000', idNumber: '1234567890', reviewStatus, missingItems, profileCompletionPercent: 70 }, latestHistory: [] } }),
					getChangeRequests: () => of({ success: true, data: [] }), getMyChangeRequests: () => of({ success: true, data: [] }), updateTab, updateProfile: vi.fn(() => of({ success: true })),
				} },
			],
		}).compileComponents();
		fixture = TestBed.createComponent(ProfileEdit);
		c = fixture.componentInstance;
		fixture.detectChanges();
	}
	afterEach(() => TestBed.resetTestingModule());
	const tab = (t: 'basics' | 'identity' | 'contact' | 'banking' | 'security') => { c.switchTab(t as any); fixture.detectChanges(); };

	it('PENDING identity (after a refresh): the waiting banner shows and the send button is disabled', async () => {
		await mount({ basicInfo: NONE, identity: entry('PENDING_REVIEW', { category: 'CLIENT_IDENTITY' }), password: NONE, documents: NONE });
		tab('identity');
		expect(q('[data-testid=identity-pending]')!.textContent).toContain('قيد مراجعة الإدارة');
		expect((q('[data-testid=identity-submit]') as HTMLButtonElement).disabled).toBe(true);
		expect(q('[data-testid=identity-rejected]')).toBeNull();
	});

	it('sending a new ID number creates the waiting state at once, and a second send makes no second request', async () => {
		await mount({ basicInfo: NONE, identity: NONE, password: NONE, documents: NONE });
		tab('identity');
		c.identityForm.patchValue({ idNumber: '1987654321' });
		c.saveTab('identity'); fixture.detectChanges();
		expect(updateTab).toHaveBeenCalledTimes(1);
		expect(q('[data-testid=identity-pending]')).toBeTruthy();
		c.saveTab('identity');
		expect(updateTab).toHaveBeenCalledTimes(1);
	});

	it('REJECTED identity shows the admin reason and the form stays open for a new request', async () => {
		await mount({ basicInfo: NONE, identity: entry('REJECTED', { rejectionReason: 'الرقم غير مطابق للمستند' }), password: NONE, documents: NONE });
		tab('identity');
		expect(q('[data-testid=identity-rejected]')!.textContent).toContain('الرقم غير مطابق للمستند');
		expect(q('[data-testid=identity-pending]')).toBeNull();
		expect((q('[data-testid=identity-submit]') as HTMLButtonElement).disabled).toBe(false);
	});

	it('APPROVED identity shows no waiting state and no rejection', async () => {
		await mount({ basicInfo: NONE, identity: entry('APPROVED'), password: NONE, documents: NONE });
		tab('identity');
		expect(q('[data-testid=identity-pending]')).toBeNull();
		expect(q('[data-testid=identity-rejected]')).toBeNull();
		expect((q('[data-testid=identity-submit]') as HTMLButtonElement).disabled).toBe(false);
	});

	it('name: a waiting request from the profile read shows the banner and disables the button; a rejected one shows the reason', async () => {
		await mount({ basicInfo: entry('PENDING_REVIEW', { category: 'CLIENT_BASIC_INFO' }), identity: NONE, password: NONE, documents: NONE });
		tab('basics');
		expect(q('[data-testid=basics-pending]')!.textContent).toContain('قيد المراجعة');
		expect((q('[data-testid=basics-submit]') as HTMLButtonElement).disabled).toBe(true);
		TestBed.resetTestingModule();
		await mount({ basicInfo: entry('REJECTED', { rejectionReason: 'الاسم لا يطابق الهوية' }), identity: NONE, password: NONE, documents: NONE });
		tab('basics');
		expect(q('[data-testid=basics-rejected]')!.textContent).toContain('الاسم لا يطابق الهوية');
		expect((q('[data-testid=basics-submit]') as HTMLButtonElement).disabled).toBe(false);
	});

	it('password: waiting request from the profile read blocks a new one; rejected shows the reason', async () => {
		await mount({ basicInfo: NONE, identity: NONE, password: entry('PENDING_REVIEW', { category: 'CLIENT_PASSWORD_CHANGE' }), documents: NONE });
		tab('security');
		expect(c.pendingPasswordRequest()).toBeTruthy();
		TestBed.resetTestingModule();
		await mount({ basicInfo: NONE, identity: NONE, password: entry('REJECTED', { rejectionReason: 'سبب أمني' }), documents: NONE });
		tab('security');
		expect(q('[data-testid=pw-rejected]')?.textContent ?? '').toContain('سبب أمني');
	});

	it('completion card: a pending_review item reads "قيد المراجعة", never "ناقص"; a missing one still reads "ناقص"', async () => {
		await mount({ basicInfo: NONE, identity: NONE, password: NONE, documents: NONE }, [
			{ key: 'idNumber', label: 'رقم الهوية', points: 20, tab: 'setup', status: 'pending_review', hint: 'قيد المراجعة' },
			{ key: 'bio', label: 'النبذة', points: 15, tab: 'profile', status: 'missing', hint: 'أضف نبذة' },
		]);
		const id = q('[data-key=idNumber]')!;
		expect(id.textContent).toContain('قيد المراجعة'); expect(id.textContent).not.toContain('ناقص');
		expect(q('[data-key=bio]')!.textContent).toContain('ناقص');
	});

	it('banking: PayPal is saved at once, so the page no longer says an admin reviews it', async () => {
		await mount({ basicInfo: NONE, identity: NONE, password: NONE, documents: NONE });
		tab('banking');
		expect(el().textContent).not.toContain('يعتمده مراجع بشري');
		expect(el().textContent).toContain('يُحفظ بريد PayPal مباشرة');
	});
});
