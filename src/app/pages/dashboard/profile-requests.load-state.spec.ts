import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Requests as ProviderRequests } from './provider-overview/profile/requests/requests';
import { ProfileRequests as ClientRequests } from './clients-overview/profile/profile-requests/profile-requests';
import { Requests as MarketerRequests } from './marketer-overview/profile/requests/requests';
import { ProviderProfileService } from '../../core/services/provider-profile.service';
import { ProfileApiService } from '../../core/services/profile-api.service';
import { MarketerProfileService } from '../../core/services/marketer-profile.service';
import { AuthStore } from '../../core/store/auth.store';

// "Profile modification requests" pages (provider / client / marketer): a failed read (401 / 429 / 5xx / network) must show an
// error with a retry — never zero counters + "no requests". The empty state is only for a successful, empty answer.
const EMPTY_TEXT = 'لا توجد طلبات في هذا التصنيف';
const ERROR_TEXT = 'تعذر تحميل طلبات التعديل حاليًا';

const KPI = { totalRequests: 1, pendingOtpCount: 0, inAiReviewCount: 0, pendingHumanCount: 1, approvedCount: 0, rejectedCount: 0 };
const ONE = { id: 'abcdef12-0000', fieldLabel: 'بيانات التواصل', status: 'PENDING_HUMAN_REVIEW', requiresOtp: true, createdAt: '2026-10-08T10:00:00Z' };

interface Page {
	name: string;
	component: Type<any>;
	/** Wires the page's service to `read` and returns the spy. */
	wire: (read: () => Observable<any>) => { provide: any; useValue: any }[];
	spy: () => any;
	ok: (items: any[]) => any;
}

let spyRef: ReturnType<typeof vi.fn>;
const PAGES: Page[] = [
	{
		name: 'provider', component: ProviderRequests, spy: () => spyRef,
		wire: (read) => { spyRef = vi.fn(read); return [{ provide: ProviderProfileService, useValue: { getRequests: spyRef } }]; },
		ok: (items) => ({ success: true, data: { requests: items, kpi: { ...KPI, totalRequests: items.length } } }),
	},
	{
		name: 'client', component: ClientRequests, spy: () => spyRef,
		wire: (read) => { spyRef = vi.fn(read); return [{ provide: ProfileApiService, useValue: { getMyChangeRequests: spyRef } }]; },
		ok: (items) => ({ success: true, data: items }),
	},
	{
		name: 'marketer', component: MarketerRequests, spy: () => spyRef,
		wire: (read) => { spyRef = vi.fn(read); return [{ provide: MarketerProfileService, useValue: { getRequests: spyRef } }]; },
		ok: (items) => ({ success: true, data: { items, totalRequests: items.length, pendingAiCount: 0, pendingHumanCount: 0, approvedCount: 0, rejectedCount: 0 } }),
	},
];

describe('profile modification requests: loading / error / empty', () => {
	afterEach(() => TestBed.resetTestingModule());

	for (const page of PAGES) {
		describe(page.name, () => {
			async function mount(read: () => Observable<any>) {
				await TestBed.configureTestingModule({
					imports: [page.component],
					providers: [
						provideRouter([]),
						{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL' }) } },
						...page.wire(read),
					],
				}).compileComponents();
				const f = TestBed.createComponent(page.component);
				f.detectChanges();
				await f.whenStable();
				const el: HTMLElement = f.nativeElement;
				const q = (id: string) => el.querySelector(`[data-testid="${id}"]`);
				return { f, el, q, text: () => el.textContent || '' };
			}

			it('shows a loading state before the reply, and neither the empty text nor an error', async () => {
				const never = new Subject<any>();
				const { f, q, text } = await mount(() => never.asObservable());
				f.detectChanges();
				expect(q('requests-loading')).not.toBeNull();
				expect(q('requests-load-error')).toBeNull();
				expect(text()).not.toContain(EMPTY_TEXT);
			});

			for (const status of [401, 429, 500, 0]) {
				it(`a failed read (${status || 'network error'}) shows the error + retry, not zeros / "no requests"`, async () => {
					const { f, q, text } = await mount(() => throwError(() => new HttpErrorResponse({ status, statusText: 'x' })));
					f.detectChanges();
					expect(q('requests-load-error')).not.toBeNull();
					expect(text()).toContain(ERROR_TEXT);
					expect(q('requests-retry')).not.toBeNull();
					expect(q('requests-loading')).toBeNull();
					expect(text()).not.toContain(EMPTY_TEXT);
					expect(text()).not.toContain('الكل0');
				});
			}

			it('a thrown (non-HTTP) error is an error state too', async () => {
				const { q, text } = await mount(() => throwError(() => new Error('boom')));
				expect(q('requests-load-error')).not.toBeNull();
				expect(text()).not.toContain(EMPTY_TEXT);
			});

			it('an unsuccessful / malformed answer is an error, not an empty list', async () => {
				const { q, text } = await mount(() => of(page.name === 'client' ? { message: 'nope' } : { success: false, message: 'nope' }));
				expect(q('requests-load-error')).not.toBeNull();
				expect(text()).not.toContain(EMPTY_TEXT);
			});

			it('the empty state appears ONLY for a successful, empty answer', async () => {
				const { f, q, text } = await mount(() => of(page.ok([])));
				f.detectChanges();
				expect(q('requests-load-error')).toBeNull();
				expect(q('requests-loading')).toBeNull();
				expect(text()).toContain(EMPTY_TEXT);
			});

			it('a successful answer with requests shows no error and no empty state', async () => {
				const { q, text } = await mount(() => of(page.ok([ONE])));
				expect(q('requests-load-error')).toBeNull();
				expect(text()).not.toContain(EMPTY_TEXT);
			});

			it('retry calls the endpoint again and shows the result', async () => {
				let calls = 0;
				const { f, q, text } = await mount(() => (++calls === 1 ? throwError(() => new HttpErrorResponse({ status: 500 })) : of(page.ok([]))));
				expect(q('requests-load-error')).not.toBeNull();
				expect(page.spy()).toHaveBeenCalledTimes(1);
				(q('requests-retry') as HTMLButtonElement).click();
				f.detectChanges(); await f.whenStable(); f.detectChanges();
				expect(page.spy()).toHaveBeenCalledTimes(2);
				expect(q('requests-load-error')).toBeNull();
				expect(text()).toContain(EMPTY_TEXT);
			});
		});
	}

	describe('provider (company mode)', () => {
		async function mountCompany(read: () => Observable<any>) {
			await TestBed.configureTestingModule({
				imports: [ProviderRequests],
				providers: [
					provideRouter([]),
					{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'PROVIDER_COMPANY' }) } },
					{ provide: ProviderProfileService, useValue: { getRequests: vi.fn(read) } },
				],
			}).compileComponents();
			const f = TestBed.createComponent(ProviderRequests);
			f.detectChanges(); await f.whenStable(); f.detectChanges();
			return f.nativeElement as HTMLElement;
		}

		it('loading, then error with retry (no zero KPIs, no "no requests" row)', async () => {
			const loading = await mountCompany(() => new Subject<any>().asObservable());
			expect(loading.querySelector('[data-testid="requests-loading"]')).not.toBeNull();
			TestBed.resetTestingModule();
			const el = await mountCompany(() => throwError(() => new HttpErrorResponse({ status: 429 })));
			expect(el.querySelector('[data-testid="requests-load-error"]')).not.toBeNull();
			expect(el.querySelector('[data-testid="requests-retry"]')).not.toBeNull();
			expect(el.querySelector('.kpi-row')).toBeNull();
			expect(el.textContent).not.toContain('لا توجد طلبات بهذا التصفية');
		});

		it('a successful empty answer shows the table\'s empty row and the KPIs', async () => {
			const el = await mountCompany(() => of(PAGES[0].ok([])));
			expect(el.querySelector('[data-testid="requests-load-error"]')).toBeNull();
			expect(el.querySelector('.kpi-row')).not.toBeNull();
			expect(el.textContent).toContain('لا توجد طلبات بهذا التصفية');
		});
	});
});
