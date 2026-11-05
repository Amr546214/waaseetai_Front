import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { IdentityCheckPanel } from './identity-check-panel';
import { IdentityCheckService } from '../../../../core/services/identity-check.service';

const base = { userId: 'u1', party: 'PROVIDER', autoCheckEnabled: true, state: 'DONE', stateReason: null, manualReviewRequired: true, advisory: true, imageVersion: null, stale: false, startedAt: null, checkedAt: null, model: null, fields: null, notExamined: { faceMatch: 'NOT_EXAMINED', liveness: 'NOT_EXAMINED', documentAuthenticity: 'NOT_EXAMINED' } };
// Test double of the backend contract: proves rendering only, NOT that card reading works.
describe('identity-check-panel (advisory)', () => {
	let fixture: ComponentFixture<IdentityCheckPanel>;
	const load = (resp: any) => {
		TestBed.configureTestingModule({ imports: [IdentityCheckPanel], providers: [{ provide: IdentityCheckService, useValue: { getAdminCheck: vi.fn(() => resp) } }] });
		fixture = TestBed.createComponent(IdentityCheckPanel);
		fixture.componentRef.setInput('userId', 'u1'); fixture.componentRef.setInput('party', 'PROVIDER');
		fixture.detectChanges();
	};
	const q = (id: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
	afterEach(() => TestBed.resetTestingModule());

	it('DONE: three field results, only MATCH is green, face/liveness/authenticity say «لم تُفحص», advisory note shown', () => {
		load(of({ ...base, fields: { fullName: { status: 'MATCH' }, birthDate: { status: 'MISMATCH' }, nationalId: { status: 'COULD_NOT_VERIFY', reason: 'FIELD_NOT_VISIBLE' } } }));
		expect(q('id-check-fullName')!.querySelector('.ok')?.textContent).toContain('مطابق');
		expect(q('id-check-birthDate')!.querySelector('.bad')?.textContent).toContain('غير مطابق');
		expect(q('id-check-nationalId')!.querySelector('.ok')).toBeNull();
		expect(q('id-check-nationalId')!.textContent).toContain('FIELD_NOT_VISIBLE');
		expect(q('id-check-not-examined')!.textContent!.match(/لم تُفحص/g)!.length).toBe(3);
		expect(q('id-check-advisory')!.textContent).toContain('المراجعة اليدوية');
		expect(q('id-check-state')).toBeNull();
	});
	it.each(['UNAVAILABLE', 'NOT_CHECKED', 'SKIPPED'])('%s shows «لم يُفحص آليًا — راجعها يدويًا» and no fields', (state) => {
		load(of({ ...base, state }));
		expect(q('id-check-state')!.textContent).toContain('لم يُفحص آليًا — راجعها يدويًا');
		expect(q('id-check-fields')).toBeNull();
	});
	it('flag off shows the manual message even if a stale DONE sneaks in without fields', () => {
		load(of({ ...base, autoCheckEnabled: false, state: 'NOT_CHECKED', stateReason: 'FLAG_OFF' }));
		expect(q('id-check-state')!.textContent).toContain('راجعها يدويًا');
	});
	it('QUEUED / RUNNING show «قيد الفحص الآلي»', () => {
		load(of({ ...base, state: 'RUNNING' }));
		expect(q('id-check-state')!.textContent).toContain('قيد الفحص الآلي');
	});
	it('request failure never blocks the review: manual message; 403 explains the permission', () => {
		load(throwError(() => ({ status: 500 })));
		expect(q('id-check-error')!.textContent).toContain('راجعها يدويًا');
	});
	it('exposes no approve / reject control', () => {
		load(of({ ...base }));
		expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
	});
});
