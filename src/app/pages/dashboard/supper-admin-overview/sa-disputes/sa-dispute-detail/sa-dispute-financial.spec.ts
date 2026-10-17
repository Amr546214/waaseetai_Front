import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../../shared/forms/form-spec-utils';

import { SaDisputeDetail } from './sa-dispute-detail';
import { DisputeApiService } from '../../../../../core/services/dispute-api.service';
import { AdminOpsApiService } from '../../../../../core/services/admin-ops-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Admin resolution: two kinds of decision. The text form moves nothing; the financial form needs explicit amounts that settle
// the whole held escrow plus an explicit confirmation, and sends exactly the contract the backend validates.
const base: any = {
  id: 'd1', requestId: null, projectId: 'p1', status: 'OPEN', reason: 'سبب', description: 'وصف', evidence: [],
  createdAt: '2026-01-01T10:00:00.000Z', resolvedAt: null,
  openedBy: { id: 'u1', firstName: 'علي', lastName: 'أحمد' }, againstUser: { id: 'u2', firstName: 'نور', lastName: 'سعد' },
  project: { id: 'p1', title: 'تصميم شعار' }, assignedTo: null,
  escrow: { status: 'HELD', amount: 1000, releasedAmount: 400, fundedAt: null }, heldEscrowAmount: 600, contractStatus: 'ACTIVE',
  projectFreeze: { frozen: true, activeDisputeCount: 2, disputeId: 'd1', reason: 'اعتماد المراحل وصرف الأموال موقوفان بسبب نزاع مفتوح' },
  notes: [], timeline: [],
};

function setup(over: any = {}, financialImpl?: () => any, accountType: string = 'SUPER_ADMIN') {
  const api = {
    getAdminDispute: vi.fn(() => of({ success: true, data: { ...base, ...over } })),
    resolveAdminDispute: vi.fn(() => of({ success: true, data: base })),
    resolveAdminDisputeFinancial: vi.fn(financialImpl ?? (() => of({ success: true, data: base }))),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: DisputeApiService, useValue: api },
      { provide: AuthStore, useValue: { currentUser: () => ({ accountType }) } },
      { provide: AdminOpsApiService, useValue: { listStaff: () => of({ success: true, data: [] }) } },
      { provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap({ id: 'd1' })), snapshot: { paramMap: convertToParamMap({ id: 'd1' }) } } },
    ],
  });
  const f = TestBed.createComponent(SaDisputeDetail);
  f.detectChanges();
  return { f, c: f.componentInstance, api, el: f.nativeElement as HTMLElement };
}

describe('SaDisputeDetail - text vs financial decisions', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('explains the two kinds of decision and shows the frozen project state with the active count', () => {
    const { el } = setup();
    expect(el.querySelector('[data-testid="decision-kinds"]')?.textContent).toContain('ولا ينقل أي مبلغ مالي');
    expect(el.querySelector('[data-testid="decision-kinds"]')?.textContent).toContain('بمبالغ صريحة');
    const banner = el.querySelector('[data-testid="freeze-banner"]');
    expect(banner?.textContent).toContain('2 نزاع نشط');
    expect(banner?.textContent).toContain('جميع النزاعات النشطة');
  });

  it('the text form offers Arabic-labelled closure presets only and sends the plain code, never a money payload', () => {
    const { c, f, api, el } = setup();
    c.openResolveForm('resolve');
    f.detectChanges();
    const presets = Array.from(el.querySelectorAll('.dp-rf-preset')).map(b => b.textContent!.trim());
    expect(presets.some(p => p.includes('إغلاق ودّي'))).toBe(true);
    expect(presets.join(' ')).not.toMatch(/REFUND_CLIENT|RELEASE|PARTIAL|SPLIT/);
    expect(presets.join(' ')).not.toMatch(/MUTUAL_CLOSE/);
    expect(el.querySelector('[data-testid="text-kind-note"]')?.textContent).toContain('ولا ينقل أي مبلغ مالي');
    c.selectPreset('MUTUAL_CLOSE');
    c.requestResolveConfirm();
    c.submitResolve();
    expect(api.resolveAdminDispute).toHaveBeenCalledWith('d1', { action: 'resolve', resolution: 'MUTUAL_CLOSE' });
    expect(api.resolveAdminDisputeFinancial).not.toHaveBeenCalled();
  });

  it('the financial button is disabled with the reason when nothing is held / contract inactive / already decided', () => {
    for (const [over, reason] of [
      [{ heldEscrowAmount: 0 }, 'لا يوجد مبلغ محتجز'],
      [{ escrow: { status: 'RELEASED', amount: 1000, releasedAmount: 1000, fundedAt: null }, heldEscrowAmount: 0 }, 'لا يوجد مبلغ محتجز'],
      [{ contractStatus: 'COMPLETED' }, 'العقد غير نشط'],
      [{ escrow: null }, 'لا يوجد ضمان'],
    ] as [any, string][]) {
      const { el, c } = setup(over);
      const btn = el.querySelector('[data-testid="open-financial"]') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(btn.getAttribute('title')).toContain(reason);
      c.openFinancialForm();
      expect(c.showFinancialForm()).toBe(false);
      TestBed.resetTestingModule();
    }
    const ok = setup();
    expect((ok.el.querySelector('[data-testid="open-financial"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('choosing an outcome pre-fills explicit amounts that settle exactly the held balance', () => {
    const { c } = setup();
    c.openFinancialForm();
    c.chooseOutcome('REFUND_CLIENT');
    expect([c.finRefund(), c.finRelease()]).toEqual(['600.00', '0.00']);
    c.chooseOutcome('RELEASE_PROVIDER');
    expect([c.finRefund(), c.finRelease()]).toEqual(['0.00', '600.00']);
    c.chooseOutcome('SPLIT');
    expect([c.finRefund(), c.finRelease()]).toEqual(['300.00', '300.00']);
    expect(c.finSum()).toBe(600);
  });

  it('validation mirrors the backend: sum must equal held, amounts match the outcome, 2 decimals, no negatives', () => {
    const { c } = setup();
    const d = c.selectedDispute()!;
    c.openFinancialForm();
    expect(c.financialValidation(d)).toContain('اختر نوع القرار');
    c.chooseOutcome('SPLIT');
    c.finRefund.set('100'); c.finRelease.set('100');
    expect(c.financialValidation(d)).toContain('يجب أن يساوي المبلغ المحتجز');
    c.finRefund.set('-1'); c.finRelease.set('601');
    expect(c.financialValidation(d)).toContain('سالبًا');
    c.finRefund.set('0.005'); c.finRelease.set('599.995');
    expect(c.financialValidation(d)).toContain('خانتان');
    c.finRefund.set('0'); c.finRelease.set('600');
    expect(c.financialValidation(d)).toContain('التقسيم');
    c.finRefund.set('abc');
    expect(c.financialValidation(d)).toContain('مبلغين صحيحين');
    c.finRefund.set('250.5'); c.finRelease.set('349.5');
    expect(c.financialValidation(d)).toBe('');
  });

  it('nothing is sent before the explicit confirmation; then exactly the backend contract is sent once', () => {
    const { c, f, api, el } = setup();
    c.openFinancialForm();
    f.detectChanges();
    expect(el.querySelector('[data-testid="financial-held"]')?.textContent).toContain('600.00');
    c.chooseOutcome('SPLIT');
    c.finRefund.set('250.50'); c.finRelease.set('349.50'); c.finNote.set('تسوية بعد مراجعة الأدلة');
    c.submitFinancial();                       // no confirm step yet
    expect(api.resolveAdminDisputeFinancial).not.toHaveBeenCalled();
    c.requestFinancialConfirm();
    f.detectChanges();
    expect(el.querySelector('[data-testid="fin-confirm-box"]')?.textContent).toContain('لا يمكن التراجع');
    c.submitFinancial();                       // confirm step shown but the checkbox is not ticked
    expect(api.resolveAdminDisputeFinancial).not.toHaveBeenCalled();
    c.finConfirmed.set(true);
    c.submitFinancial();
    c.submitFinancial();                       // a double click while/after sending is ignored
    expect(api.resolveAdminDisputeFinancial).toHaveBeenCalledTimes(1);
    expect(api.resolveAdminDisputeFinancial).toHaveBeenCalledWith('d1', {
      outcome: 'SPLIT', refundToClient: 250.5, releaseToProvider: 349.5, expectedHeldAmount: 600, confirm: true, resolutionNote: 'تسوية بعد مراجعة الأدلة',
    });
    expect(c.showFinancialForm()).toBe(false);
    expect(api.getAdminDispute).toHaveBeenCalledTimes(2);   // reloaded after success
    expect(api.resolveAdminDispute).not.toHaveBeenCalled();
  });

  it('a backend refusal (e.g. stale held amount) is shown, the form stays, and nothing is reported as done', () => {
    const { c, api } = setup({}, () => throwError(() => ({ error: { message: 'تغيّر المبلغ المحتجز منذ عرضه عليك' } })));
    c.openFinancialForm();
    c.chooseOutcome('REFUND_CLIENT');
    c.requestFinancialConfirm();
    c.finConfirmed.set(true);
    c.submitFinancial();
    expect(api.resolveAdminDisputeFinancial).toHaveBeenCalledTimes(1);
    expect(c.finError()).toContain('تغيّر المبلغ المحتجز');
    expect(c.showFinancialForm()).toBe(true);
    expect(c.finSubmitting()).toBe(false);
    expect(c.finConfirmStep()).toBe(false);
  });

  it('a decided dispute shows the Arabic label, the executed financial outcome and no resolve buttons', () => {
    const { el } = setup({
      status: 'RESOLVED', resolution: 'SPLIT', resolutionLabel: 'تقسيم المبلغ المحتجز بين الطرفين', resolvedAt: '2026-01-05T10:00:00.000Z',
      financialOutcome: { outcome: 'SPLIT', refundToClient: 250.5, releaseToProvider: 349.5, platformCommission: 34.95, providerNet: 314.55 },
      projectFreeze: { frozen: false, activeDisputeCount: 0, disputeId: null, reason: null },
    });
    expect(el.querySelector('[data-testid="resolution-label"]')?.textContent).toContain('تقسيم المبلغ المحتجز بين الطرفين');
    expect(el.textContent).not.toContain('SPLIT');
    expect(el.querySelector('[data-testid="financial-outcome"]')?.textContent).toContain('250.50');
    expect(el.querySelector('[data-testid="financial-outcome"]')?.textContent).toContain('314.55');
    expect(el.querySelector('[data-testid="open-financial"]')).toBeNull();
    expect(el.querySelector('[data-testid="freeze-banner"]')).toBeNull();
  });

  it('a text-closed dispute says no financial effect was executed, and labels MUTUAL_CLOSE in Arabic', () => {
    const { el } = setup({ status: 'RESOLVED', resolution: 'MUTUAL_CLOSE', resolvedAt: '2026-01-05T10:00:00.000Z', projectFreeze: { frozen: false, activeDisputeCount: 0, disputeId: null, reason: null } });
    expect(el.querySelector('[data-testid="no-financial-outcome"]')?.textContent).toContain('لم يُنفَّذ أي أثر مالي');
    expect(el.querySelector('[data-testid="resolution-label"]')?.textContent).toContain('إغلاق ودّي');
    expect(el.querySelector('[data-testid="resolution-label"]')?.textContent).not.toContain('MUTUAL_CLOSE');
  });
});

describe('SaDisputeDetail - financial decision is SUPER_ADMIN only', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('a plain ADMIN sees the financial button disabled with the reason, and cannot open the form; the text closure stays available', () => {
    const { c, f, el } = setup({}, undefined, 'ADMIN');
    const btn = el.querySelector('[data-testid="open-financial"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('title')).toContain('SUPER_ADMIN');
    c.openFinancialForm(); f.detectChanges();
    expect(el.querySelector('[data-testid="financial-form"]')).toBeNull();
    c.openResolveForm('resolve'); f.detectChanges();
    expect(el.querySelector('.dp-rf-preset')).not.toBeNull();
  });
  it('a SUPER_ADMIN gets the financial form', () => {
    const { c, f, el } = setup({}, undefined, 'SUPER_ADMIN');
    expect((el.querySelector('[data-testid="open-financial"]') as HTMLButtonElement).disabled).toBe(false);
    c.openFinancialForm(); f.detectChanges();
    expect(el.querySelector('[data-testid="financial-form"]')).not.toBeNull();
  });
});

describe('SaDisputeDetail - validation UX', () => {
  afterEach(() => TestBed.resetTestingModule());
  const byId = (el: HTMLElement, id: string) => el.querySelector('#' + id) as HTMLElement;

  it('financial form: no outcome -> message at the outcome group; wrong sum -> message at the refund field, focus moves, nothing is sent', async () => {
    const { f, c, api, el } = setup();
    c.openFinancialForm(); f.detectChanges();
    c.requestFinancialConfirm(); await settleForm();
    expectFieldProblem(byId(el, 'dp-fin-outcome'), 'اختر نوع القرار');
    expectFocused(byId(el, 'dp-fin-outcome'));
    c.chooseOutcome('SPLIT'); f.detectChanges();
    expect(el.querySelectorAll('.ws-invalid').length).toBe(0);   // choosing an outcome clears the old mark
    c.finRefund.set('100'); c.finRelease.set('100'); f.detectChanges();
    c.requestFinancialConfirm(); await settleForm();
    expectFieldProblem(byId(el, 'dp-fin-refund'), 'يجب أن يساوي المبلغ المحتجز');
    expectFocused(byId(el, 'dp-fin-refund'));
    expect(c.finRelease()).toBe('100');
    expect(api.resolveAdminDisputeFinancial).not.toHaveBeenCalled();
    expect(c.finConfirmStep()).toBe(false);
  });

  it('financial form: a negative release amount is reported at the release field', async () => {
    const { f, c, el } = setup();
    c.openFinancialForm(); c.chooseOutcome('SPLIT'); f.detectChanges();
    c.finRefund.set('700'); c.finRelease.set('-100'); f.detectChanges();
    c.requestFinancialConfirm(); await settleForm();
    expectFieldProblem(byId(el, 'dp-fin-release'), 'سالبًا');
  });

  it('financial submit: a 400 naming refundToClient goes under that field; 429 / 500 / 403 stay a generic alert and no amount is touched', async () => {
    const calls: number[] = [];
    const { f, c, api, el } = setup({}, () => { const st = [400, 429, 500, 403][calls.length]; calls.push(st); return throwError(() => httpFail(st, st === 400 ? { errors: [{ field: 'refundToClient', message: 'مبلغ الاسترداد لا يطابق المحتجز' }] } : { message: 'x' })); });
    c.openFinancialForm(); c.chooseOutcome('REFUND_CLIENT'); f.detectChanges();
    for (let i = 0; i < 4; i++) {
      c.requestFinancialConfirm(); c.finConfirmed.set(true); c.submitFinancial();
      await settleForm(); f.detectChanges();
      if (i === 0) { expectFieldProblem(byId(el, 'dp-fin-refund'), 'لا يطابق المحتجز'); expect(c.finError()).toBe(''); }
      else { expect(c.finError(), String(i)).toBeTruthy(); expectNoFieldProblem(el); expect(el.querySelector('[data-testid="fin-error"]')?.getAttribute('role')).toBe('alert'); }
    }
    expect(api.resolveAdminDisputeFinancial).toHaveBeenCalledTimes(4);
    expect(c.finRefund()).toBe('600.00');
    expect(c.showFinancialForm()).toBe(true);
  });

  it('financial submit: the BE sum-mismatch 400 (errors[] on releaseToProvider next to heldAmount) goes under the release box', async () => {
    const { f, c, el } = setup({}, () => throwError(() => httpFail(400, { message: 'مجموع المبلغين (500) يجب أن يساوي المبلغ المحتجز بالكامل (600)', errors: [{ heldAmount: 600 }, { field: 'releaseToProvider', path: 'releaseToProvider', message: 'مجموع المبلغين (500) يجب أن يساوي المبلغ المحتجز بالكامل (600)' }] })));
    c.openFinancialForm(); c.chooseOutcome('REFUND_CLIENT'); f.detectChanges();
    c.requestFinancialConfirm(); c.finConfirmed.set(true); c.submitFinancial();
    await settleForm(); f.detectChanges();
    expectFieldProblem(byId(el, 'dp-fin-release'), 'يساوي المبلغ المحتجز');
    expect(c.finError()).toBe('');
  });

  it('text decision: empty resolution -> message under the resolution input with focus; short note -> under the note', async () => {
    const { f, c, api, el } = setup();
    c.openResolveForm('resolve'); f.detectChanges();
    c.resolutionNote.set('x'); f.detectChanges();
    c.requestResolveConfirm(); await settleForm();
    expectFieldProblem(byId(el, 'dp-resolution'), 'قرار النزاع');
    expectFieldProblem(byId(el, 'dp-resolution-note'), 'قصيرة');
    expectFocused(byId(el, 'dp-resolution'));
    expect(c.confirmingResolve()).toBe(false);
    expect(api.resolveAdminDispute).not.toHaveBeenCalled();
  });

  it('text decision: 500 on submit is a generic alert, not a field error', async () => {
    const { f, c, api, el } = setup();
    api.resolveAdminDispute.mockReturnValueOnce(throwError(() => httpFail(500, null)));
    c.openResolveForm('resolve'); c.resolutionText.set('تم الحل'); f.detectChanges();
    c.requestResolveConfirm(); c.submitResolve(); await settleForm(); f.detectChanges();
    expect(el.querySelector('[data-testid="resolve-error"]')?.textContent).toContain('الخادم');
    expectNoFieldProblem(el);
  });

  it('assign / note without input explain themselves at the control and send nothing', async () => {
    const { f, c, el } = setup();
    c.assign(); await settleForm(); f.detectChanges();
    expectFieldProblem(el.querySelector('#dp-assignee-trigger'), 'اختر الموظف');
    c.addNote(); await settleForm();
    expectFieldProblem(byId(el, 'dp-note'), 'الملاحظة');
  });
});
