import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SaContracts } from './sa-contracts';
import { SaContractDetail } from './sa-contract-detail/sa-contract-detail';
import { AdminContractDetail, AdminContractListData, AdminOpsApiService } from '../../../../core/services/admin-ops-api.service';

const party = (id: string, name: string) => ({ id, name, email: null });
const escrow = (v: number | null) => ({ status: 'HELD' as const, amount: 900, releasedAmount: 0, heldAmount: 900, fundedAt: null, platformCommissionAmount: 9, providerNetReleasedAmount: 0, feePolicyVersion: v });

function listData(overrides: Partial<AdminContractListData> = {}): AdminContractListData {
  return {
    items: [{
      id: 'ct-abcdef123', projectId: 'p-1', projectTitle: 'عنوان مشروع العقد', price: 900, durationDays: 20, status: 'ACTIVE', signedAt: null, createdAt: '2026-01-01T00:00:00Z',
      client: party('c1', 'نور خالد'), provider: party('v1', 'سامر علي'), escrow: escrow(2),
    }],
    counts: { ACTIVE: 5, COMPLETED: 2, DISPUTED: 1 },
    kpis: { activeContractsValue: 45000, currency: 'USD' },
    pagination: { page: 1, limit: 20, total: 8, pages: 1, totalPages: 1 },
    ...overrides,
  };
}

function detailData(fee: number | null = 2): AdminContractDetail {
  return {
    id: 'p-1', title: 'مشروع العقد', description: '', status: 'IN_PROGRESS', createdAt: '2026-01-01T00:00:00Z', deliveryDays: 20, specialty: 'برمجة',
    client: party('c1', 'نور خالد'), provider: party('v1', 'سامر علي'),
    contract: { id: 'ct-1', price: 900, status: 'ACTIVE', durationDays: 20, signedAt: null, clientSignedAt: '2026-01-02T00:00:00Z', providerSignedAt: null },
    escrow: escrow(fee), stages: [], amendments: [{ id: 'a1', title: 'تعديل الميزانية', type: 'BUDGET', status: 'PENDING', budgetDelta: 50, durationDeltaDays: null, createdAt: '2026-01-03T00:00:00Z' }],
    progress: { totalStages: 0, approvedStages: 0, percent: 0 }, disputes: [], openDisputes: 0, currency: 'USD',
    contractId: 'ct-1', terms: null, termsVersion: 3, phasesCount: 2, signatures: { client: true, provider: false },
  };
}

describe('SaContracts (real data)', () => {
  let api: { listContracts: ReturnType<typeof vi.fn>; getContract: ReturnType<typeof vi.fn> };

  async function setup(listImpl: () => any, getImpl: () => any = () => of({ success: true, data: detailData() })) {
    api = { listContracts: vi.fn(listImpl), getContract: vi.fn(getImpl) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'contracts', component: SaContracts },
          { path: 'contracts/:id', component: SaContractDetail },
        ]),
        { provide: AdminOpsApiService, useValue: api },
      ],
    });
    return RouterTestingHarness.create();
  }

  it('renders API rows, API counts and the escrow badge from the DB status', async () => {
    const harness = await setup(() => of({ success: true, data: listData() }));
    await harness.navigateByUrl('/contracts', SaContracts);
    harness.detectChanges();
    const el: HTMLElement = harness.routeNativeElement!;
    expect(el.textContent).toContain('نور خالد');
    expect(el.textContent).toContain('عنوان مشروع العقد');
    expect(el.textContent).toContain('45,000');
    expect(el.querySelector('.ct-escrow')!.textContent).toContain('محتجز');
    expect(el.querySelector('.ct-kpi-val')!.textContent!.trim()).toBe('5');
  });

  it('passes status to the server and shows empty state', async () => {
    const harness = await setup(() => of({ success: true, data: listData({ items: [], counts: {} }) }));
    const cmp = await harness.navigateByUrl('/contracts', SaContracts);
    cmp.setFilter('DISPUTED');
    harness.detectChanges();
    expect(api.listContracts).toHaveBeenLastCalledWith({ status: 'DISPUTED', q: undefined, page: 1, limit: 20 });
    expect(harness.routeNativeElement!.textContent).toContain('لا توجد عقود مطابقة');
  });

  it('shows an error and retries', async () => {
    let fail = true;
    const harness = await setup(() => (fail ? throwError(() => ({ status: 500 })) : of({ success: true, data: listData() })));
    const cmp = await harness.navigateByUrl('/contracts', SaContracts);
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('تعذّر تحميل العقود');
    fail = false;
    cmp.load();
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('نور خالد');
  });

  it('detail shows real data and all financial buttons are disabled with a reason and call no API', async () => {
    const harness = await setup(() => of({ success: true, data: listData() }));
    await harness.navigateByUrl('/contracts/ct-1', SaContractDetail);
    harness.detectChanges();
    const el: HTMLElement = harness.routeNativeElement!;
    expect(api.getContract).toHaveBeenCalledWith('ct-1');
    expect(el.textContent).toContain('تعديل الميزانية');
    expect(el.textContent).toContain('عمولة المنصة');
    const btns = Array.from(el.querySelectorAll('.ct-escrow-actions button')) as HTMLButtonElement[];
    expect(btns.length).toBe(3);
    expect(btns.every((b) => b.disabled)).toBe(true);
    expect(el.querySelector('[data-testid="finance-disabled-reason"]')!.textContent).toContain('يحتاج قرار سياسة مالية');
    api.getContract.mockClear();
    btns.forEach((b) => b.click());
    expect(api.getContract).not.toHaveBeenCalled();
    expect(api.listContracts).toHaveBeenCalledTimes(0);
  });

  it('detail hides fee rows when feePolicyVersion is not 2, and handles 404', async () => {
    const harness = await setup(() => of({ success: true, data: listData() }), () => of({ success: true, data: detailData(null) }));
    await harness.navigateByUrl('/contracts/ct-1', SaContractDetail);
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).not.toContain('عمولة المنصة');
  });

  it('detail shows not-found on 404', async () => {
    const harness = await setup(() => of({ success: true, data: listData() }), () => throwError(() => ({ status: 404 })));
    await harness.navigateByUrl('/contracts/zzz', SaContractDetail);
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('لم يتم العثور على العقد');
  });
});
