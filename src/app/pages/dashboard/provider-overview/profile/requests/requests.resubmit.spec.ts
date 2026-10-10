import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Requests } from './requests';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// A rejected request gets one clear way back: a link to the tab that edits it. Nothing is sent by the link itself; an unknown category gets no button.
const row = (over: any = {}) => ({ id: 'r-123456789', status: 'REJECTED', category: 'DOCUMENTS', fieldName: 'DOCUMENTS', fieldLabel: 'المستندات', currentValue: 'a', requestedValue: 'b', requiresOtp: true, rejectionReason: 'الصورة غير واضحة', createdAt: new Date().toISOString(), ...over });

async function mount(rows: any[]) {
	await TestBed.configureTestingModule({
		imports: [Requests],
		providers: [provideRouter([]), { provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'PROVIDER_INDIVIDUAL' }) } },
			{ provide: ProviderProfileService, useValue: { getRequests: () => of({ success: true, data: { requests: rows, kpi: {} } }) } }],
	}).compileComponents();
	const f = TestBed.createComponent(Requests);
	f.detectChanges(); await f.whenStable(); f.detectChanges();
	return { el: f.nativeElement as HTMLElement, c: f.componentInstance };
}

describe('provider profile requests: "edit and send again" after a rejection', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('a rejected DOCUMENTS request shows the button, which opens the documents tab and sends nothing', async () => {
		const { el } = await mount([row()]);
		const a = el.querySelector('[data-testid="resubmit-link"]') as HTMLAnchorElement;
		expect(a.textContent).toContain('تعديل وإرسال مرة أخرى');
		expect(a.getAttribute('href')).toContain('/provider-overview/profile/data');
		expect(a.getAttribute('href')).toContain('tab=docs');
	});

	it('maps the categories: DOCUMENTS and legacy NATIONAL_ID -> docs, legacy EMAIL / PHONE_NUMBER -> contact', async () => {
		const { c } = await mount([]);
		expect(c.resubmitTab(row())).toBe('docs');
		expect(c.resubmitTab(row({ category: 'PROFILE', fieldName: 'NATIONAL_ID' }))).toBe('docs');
		expect(c.resubmitTab(row({ category: 'PROFILE', fieldName: 'EMAIL' }))).toBe('contact');
		expect(c.resubmitTab(row({ category: 'PROFILE', fieldName: 'PHONE_NUMBER' }))).toBe('contact');
	});

	it('no misleading button: unknown / retired categories, and any status other than REJECTED', async () => {
		const { el, c } = await mount([row({ category: 'BANKING', fieldName: 'IBAN' }), row({ id: 'r2', category: 'SOMETHING_NEW' }), row({ id: 'r3', status: 'PENDING_HUMAN_REVIEW' }), row({ id: 'r4', status: 'APPROVED' })]);
		expect(el.querySelector('[data-testid="resubmit-link"]')).toBeNull();
		expect(c.resubmitTab(row({ category: 'PROFILE', fieldName: 'OTHER' }))).toBeNull();
		expect(c.resubmitTab(null)).toBeNull();
	});
});
