import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Data } from './data';
import { MarketerOverviewService } from '../../../../../core/services/marketer-overview.service';
import { MarketerProfileService } from '../../../../../core/services/marketer-profile.service';
import { NotificationPreferencesService } from '../../../../../core/services/notification-preferences.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';

// Marketer basics tab: the same review lifecycle (GET /marketer/profile -> reviewStatus.basicInfo), kept after a refresh.
const entry = (status: string, extra: any = {}) => ({ status, requestId: 'r1', category: 'MARKETER_BASIC_INFO', submittedAt: '2026-10-10T10:00:00Z', reviewedAt: null, rejectionReason: null, ...extra });
const NONE = { status: 'NOT_SUBMITTED', requestId: null, category: null, submittedAt: null, reviewedAt: null, rejectionReason: null };
const base = { id: 'p1', referralSlug: 'abc', completionPercentage: 40, marketingChannels: [], bio: 'x', avatarUrl: '', paypalPayoutEmail: 'm@example.com',
	user: { firstName: 'محمد', lastName: 'أحمد', email: 'm@x.com', phoneNumber: '501234567', phoneCountryCode: '+966', idNumber: '1234567890' } };

describe('marketer profile: review status of the basics request', () => {
	let fixture: ComponentFixture<Data>;
	let c: Data;
	let svc: any;
	const el = () => fixture.nativeElement as HTMLElement;
	const q = (s: string) => el().querySelector(s) as HTMLElement | null;
	const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };

	async function mount(basicInfo: any) {
		svc = {
			getProfile: vi.fn(() => of({ success: true, data: { ...base, reviewStatus: { basicInfo, documents: NONE } } })),
			createIdentityRequest: vi.fn(() => of({ success: true, data: [] })),
		};
		await TestBed.configureTestingModule({
			imports: [Data],
			providers: [provideRouter([]),
				{ provide: MarketerOverviewService, useValue: { getSummary: () => of({ success: true, data: {} }), getChannelPerformance: () => of({ success: true, data: [] }), getRecentCommissions: () => of({ success: true, data: [] }) } },
				{ provide: MarketerProfileService, useValue: svc },
				{ provide: NotificationPreferencesService, useValue: { getPreferences: () => of({ success: true, data: {} }), updatePreferences: vi.fn(() => of({ success: true })) } }],
		}).compileComponents();
		fixture = TestBed.createComponent(Data); c = fixture.componentInstance;
		fixture.detectChanges(); document.body.appendChild(el());
		c.setActiveTab('basics'); render();
	}
	afterEach(() => { el().remove(); TestBed.inject(UiNotificationService).clearAll(); TestBed.resetTestingModule(); });

	it('PENDING after a refresh: the banner shows, the button says "طلب قيد المراجعة" and is disabled, and no request can be sent', async () => {
		await mount(entry('PENDING_REVIEW'));
		expect(q('[data-testid=identity-pending]')!.textContent).toContain('قيد مراجعة الإدارة');
		const btn = q('[data-testid=basics-submit]') as HTMLButtonElement;
		expect(btn.disabled).toBe(true); expect(btn.textContent).toContain('طلب قيد المراجعة');
		c.basicsForm.patchValue({ firstName: 'علي' }); c.submitBasicsChangeRequest();
		expect(svc.createIdentityRequest).not.toHaveBeenCalled();
	});

	it('REJECTED: the admin reason shows and a new request can be sent', async () => {
		await mount(entry('REJECTED', { rejectionReason: 'الاسم لا يطابق الهوية' }));
		expect(q('[data-testid=identity-rejected]')!.textContent).toContain('الاسم لا يطابق الهوية');
		expect(q('[data-testid=identity-pending]')).toBeNull();
		expect((q('[data-testid=basics-submit]') as HTMLButtonElement).disabled).toBe(false);
		c.basicsForm.patchValue({ firstName: 'علي' }); c.submitBasicsChangeRequest();
		expect(svc.createIdentityRequest).toHaveBeenCalledTimes(1);
	});

	it('APPROVED / NOT_SUBMITTED: no waiting banner, no rejection, button enabled', async () => {
		for (const e of [entry('APPROVED'), NONE]) {
			await mount(e);
			expect(q('[data-testid=identity-pending]')).toBeNull(); expect(q('[data-testid=identity-rejected]')).toBeNull();
			expect((q('[data-testid=basics-submit]') as HTMLButtonElement).disabled).toBe(false);
			el().remove(); TestBed.resetTestingModule();
		}
	});

	it('sending a request shows the waiting state at once and a second tap sends nothing', async () => {
		await mount(NONE);
		c.basicsForm.patchValue({ firstName: 'علي' });
		c.submitBasicsChangeRequest(); render();
		expect(svc.createIdentityRequest).toHaveBeenCalledTimes(1);
		expect(q('[data-testid=identity-pending]')).toBeTruthy();
		c.submitBasicsChangeRequest();
		expect(svc.createIdentityRequest).toHaveBeenCalledTimes(1);
	});
});
