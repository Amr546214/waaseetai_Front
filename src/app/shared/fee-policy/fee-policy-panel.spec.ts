import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FeePolicyPanel, diffPayload, describePath } from './fee-policy-panel';
import { FeePolicyApi, FeePolicyPayload, FeePolicyView } from '../../core/services/fee-policy.api';
import { AdminAccessService } from '../../core/services/admin-access.service';
import { ConfirmModalService } from '../../core/services/confirm-modal.service';

const payload = (): FeePolicyPayload => ({
	providerCommissionByLevel: Array(15).fill(10), clientCashbackByLevel: Array(15).fill(1), marketerCommissionByLevel: Array(15).fill(2),
	depositFeePercent: { mada: 4, visa_mastercard: 5, paypal: 7, international_transfer: 7, other: 8 },
	marketerWithdrawalFeePercent: { bank_transfer: 8, paypal: 7, usdt: 4 }, minMarketerPayout: 300, minProviderPayout: 0,
});
const view = (upcoming: FeePolicyView['upcoming'] = []): FeePolicyView => ({ active: { id: 'a', version: 1, effectiveFrom: '2000-01-01T00:00:00Z', payload: payload(), note: null, createdById: null, createdAt: '', cancelledAt: null, state: 'EFFECTIVE' }, upcoming, history: [], limits: { minLeadMinutes: 15, maxLeadDays: 366 }, now: '' });

async function setup(v: FeePolicyView, can = true, confirm = true) {
	const api = { view: vi.fn(() => of({ success: true, data: v })), schedule: vi.fn(() => of({ success: true, data: { version: 2, id: 'b', effectiveFrom: '', diff: [] } })), cancel: vi.fn(() => of({ success: true, data: { version: 2, cancelled: true } })) };
	TestBed.configureTestingModule({ imports: [FeePolicyPanel], providers: [{ provide: FeePolicyApi, useValue: api }, { provide: AdminAccessService, useValue: { can: () => can } }, { provide: ConfirmModalService, useValue: { confirm: () => Promise.resolve(confirm) } }] });
	const f = TestBed.createComponent(FeePolicyPanel); f.detectChanges(); await f.whenStable(); return { f, c: f.componentInstance, api };
}

describe('FeePolicyPanel', () => {
	it('diffs only changed fields and names them', async () => {
		const b = payload(); b.providerCommissionByLevel[2] = 9; b.depositFeePercent['paypal'] = 6;
		const d = diffPayload(payload(), b);
		expect(d.length).toBe(2);
		expect(describePath(d[0].path)).toContain('المستوى 3');
	});
	it('sends only the changed keys with the base version and the confirmation flag', async () => {
		const { c, api } = await setup(view());
		c.setMin('minMarketerPayout', '250'); c.note.set('reason');
		await c.submit();
		const body = (api.schedule.mock.lastCall as any[])[0];
		expect(body.changes).toEqual({ minMarketerPayout: 250 });
		expect(body.baseVersion).toBe(1); expect(body.confirmSensitive).toBe(true);
	});
	it('writes nothing when the confirmation is declined or the reason is empty', async () => {
		const a = await setup(view(), true, false); a.c.setMin('minMarketerPayout', '250'); a.c.note.set('r'); await a.c.submit(); expect(a.api.schedule).not.toHaveBeenCalled();
		TestBed.resetTestingModule();
		const b = await setup(view()); b.c.setMin('minMarketerPayout', '250'); await b.c.submit(); expect(b.api.schedule).not.toHaveBeenCalled(); expect(b.c.formError()).toContain('سبب');
	});
	it('is read-only without fees.manage and while a version is pending', async () => {
		const a = await setup(view(), false); expect(a.c.editable()).toBe(false);
		TestBed.resetTestingModule();
		const b = await setup(view([{ ...view().active, id: 'u', version: 2, state: 'SCHEDULED' }])); expect(b.c.editable()).toBe(false); expect(b.c.pending().length).toBe(1);
	});
	it('shows cashback and the marketer withdrawal fee as display-only: disabled, labelled, never sent', async () => {
		const { f, c, api } = await setup(view()); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="fp-display-only"]')?.textContent).toContain('لا تُطبَّق ماليًا');
		const cashback = el.querySelectorAll('[data-testid="fp-ladders"] tbody tr td:nth-child(3) input');
		expect(cashback.length).toBe(15); expect(Array.from(cashback).every(i => (i as HTMLInputElement).disabled)).toBe(true);
		c.setMin('minProviderPayout', '5'); c.note.set('r'); await c.submit();
		expect(Object.keys((api.schedule.mock.lastCall as any[])[0].changes)).toEqual(['minProviderPayout']);
	});
	it('types the effective time in the platform zone and sends the matching UTC instant', async () => {
		const { setPlatformRegional } = await import('../../core/utils/regional');
		setPlatformRegional({ defaultTimezone: 'Asia/Riyadh' });
		try {
			const { c, api } = await setup(view()); c.setMin('minProviderPayout', '5'); c.note.set('r'); c.effectiveFrom.set('2030-03-10T09:30');
			await c.submit(); expect((api.schedule.mock.lastCall as any[])[0].effectiveFrom).toBe('2030-03-10T06:30:00.000Z');
			expect(c.zoneLabel()).toBe('Asia/Riyadh');
		} finally { setPlatformRegional({}); }
	});
});
