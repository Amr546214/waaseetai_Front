import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Requests } from './requests';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { AuthStore } from '../../../../../core/store/auth.store';

const READY = { status: 'READY', source: 'WASEET_AI', summary: 'ملخص مزود', recommendation: 'توصية مزود', generatedAt: null, observations: ['مرصود 1'] };
const row = (over: any = {}) => ({ id: 'r-123456789', status: 'PENDING_HUMAN_REVIEW', category: 'DOCUMENTS', fieldLabel: 'المستندات', currentValue: 'a', requestedValue: 'b', requiresOtp: true, createdAt: '2026-10-08T10:00:00Z', aiReview: null, ...over });

async function mount(rows: any[]) {
	await TestBed.configureTestingModule({
		imports: [Requests],
		providers: [provideRouter([]), { provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'PROVIDER_INDIVIDUAL' }) } },
			{ provide: ProviderProfileService, useValue: { getRequests: () => of({ success: true, data: { requests: rows, kpi: {} } }) } }],
	}).compileComponents();
	const f = TestBed.createComponent(Requests);
	f.detectChanges(); await f.whenStable(); f.detectChanges();
	return f.nativeElement as HTMLElement;
}

describe('provider profile requests: AI pre-review block', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('READY renders summary + recommendation + observations; no confidence anywhere', async () => {
		const el = await mount([row({ aiReview: READY, aiConfidence: null })]);
		const t = el.textContent || '';
		for (const x of ['فحص أولي بالذكاء الاصطناعي', 'ملخص مزود', 'توصية مزود', 'مرصود 1', 'استشاري، القرار للمراجع']) expect(t).toContain(x);
		expect(t).not.toContain('ثقة');
	});

	it('FAILED shows the unavailable text; null shows only the waiting line', async () => {
		const el = await mount([row({ id: 'f1', aiReview: { ...READY, status: 'FAILED', summary: null, recommendation: null, observations: [] } }), row({ id: 'n1' })]);
		expect(el.querySelector('[data-testid="ai-review-failed"]')?.textContent).toContain('تعذر تشغيل الفحص الأولي حاليًا');
		expect(el.querySelectorAll('[data-testid="ai-review-waiting"]').length).toBe(1);
		expect(el.textContent).not.toContain('فحص أولي بالذكاء الاصطناعي');
	});
});
