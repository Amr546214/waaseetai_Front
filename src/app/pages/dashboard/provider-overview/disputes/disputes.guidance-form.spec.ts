import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Disputes } from './disputes';
import { DisputeDetails } from './dispute-details/dispute-details';
import { DisputeApiService } from '../../../../core/services/dispute-api.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { expectFieldProblem, expectFocused, settleForm } from '../../../../shared/forms/form-spec-utils';

// The company "guidance to the assigned team member" textarea (list modal + detail modal). mapDispute never fills
// teamMember today, so the dialogs are opened by setting the state directly; this proves the field wiring only.
const DISPUTE: any = { id: 'd1', title: 'تأخر', project: 'مشروع', status: 'open', who: 'mine', extra: '', teamMember: { name: 'ليلى' } };

describe('dispute guidance form (company): empty text is never "sent"', () => {
	const providers = () => [
		provideRouter([]),
		{ provide: DisputeApiService, useValue: { getProviderDisputes: () => of({ success: true, data: { items: [], pagination: {} } }), getProviderDispute: () => of({ success: false }) } },
		{ provide: AuthStore, useValue: { currentUser: () => ({ id: 'me', accountType: 'PROVIDER_COMPANY' }) } },
		{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'd1' }) } } },
	];
	afterEach(() => TestBed.resetTestingModule());

	it('list modal: empty send marks the textarea (aria-invalid + role=alert), focuses it, keeps the modal open and shows no success', async () => {
		await TestBed.configureTestingModule({ imports: [Disputes], providers: providers() }).compileComponents();
		(Element.prototype as any).scrollIntoView = vi.fn();
		const ok = vi.spyOn(TestBed.inject(UiNotificationService), 'success');
		const f = TestBed.createComponent(Disputes);
		f.detectChanges(); await f.whenStable();
		f.componentInstance.openGuidance(DISPUTE); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		const ta = el.querySelector('#dispute-guidance') as HTMLTextAreaElement;
		await f.componentInstance.sendGuidance(); f.detectChanges(); await settleForm();
		expect(ok).not.toHaveBeenCalled();
		expect(f.componentInstance.guidanceTarget()).toBeTruthy();
		expectFocused(ta);
		expectFieldProblem(ta, 'اكتب التوجيه');
		ta.value = 'أرسل سجل التسليم'; ta.dispatchEvent(new Event('input')); f.detectChanges();
		expect(ta.getAttribute('aria-invalid')).toBeNull();
		await f.componentInstance.sendGuidance();
		expect(ok).toHaveBeenCalledTimes(1);
		expect(f.componentInstance.guidanceTarget()).toBeNull();
	});

	it('detail modal: same behaviour', async () => {
		await TestBed.configureTestingModule({ imports: [DisputeDetails], providers: providers() }).compileComponents();
		(Element.prototype as any).scrollIntoView = vi.fn();
		const ok = vi.spyOn(TestBed.inject(UiNotificationService), 'success');
		const f = TestBed.createComponent(DisputeDetails);
		f.detectChanges(); await f.whenStable();
		f.componentInstance.dispute.set({ ...DISPUTE, detail: { parties: [], info: [], evidence: [], history: [], actions: [] } });
		f.componentInstance.isLoading.set(false); f.componentInstance.notFound.set(false);
		f.componentInstance.openGuidance(); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		const ta = el.querySelector('#dispute-guidance') as HTMLTextAreaElement;
		expect(ta).toBeTruthy();
		await f.componentInstance.sendGuidance(); f.detectChanges(); await settleForm();
		expect(ok).not.toHaveBeenCalled();
		expect(f.componentInstance.guidanceOpen()).toBe(true);
		expectFocused(ta);
		expectFieldProblem(ta, 'اكتب التوجيه');
	});
});
