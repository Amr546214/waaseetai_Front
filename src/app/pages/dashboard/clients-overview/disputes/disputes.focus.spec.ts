import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Disputes } from './disputes';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';
import { DisputeApiService } from '../../../../core/services/dispute-api.service';

// The client app has no dispute-details route. A notification links to /client-overview/disputes?dispute=<id> and the list opens
// THAT dispute's details; the decision is shown in Arabic (never the raw code) with its real financial effect.
const D = (o: Record<string, unknown> = {}) => ({ id: 'd1', status: 'OPEN', reason: 'تأخر التسليم', description: 'وصف النزاع', createdAt: new Date('2026-10-01').toISOString(), openedById: 'me', projectId: 'proj-1', request: { id: 'proj-1', title: 'مشروع' }, ...o });

async function setup(query: Record<string, string>, list: any[], detail: any) {
  const getClientDisputes = vi.fn(() => of({ success: true, data: { items: list, pagination: {} } }));
  const getClientDispute = vi.fn(() => of({ success: true, data: detail }));
  await TestBed.configureTestingModule({
    imports: [Disputes],
    providers: [
      provideRouter([]),
      { provide: DisputeApiService, useValue: { getClientDisputes, getClientDispute } },
      { provide: AuthStore, useValue: { currentUser: () => ({ id: 'me', accountType: AccountType.CLIENT_INDIVIDUAL }) } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
    ],
  }).compileComponents();
  const f = TestBed.createComponent(Disputes);
  f.detectChanges(); await f.whenStable(); f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  return { f, c: f.componentInstance, el, getClientDispute, q: (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null };
}

describe('client disputes page - notification deep link and decision wording', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('?dispute=<id> opens that dispute\'s details (not another one) and gives its card an anchor id', async () => {
    const s = await setup({ dispute: 'd2' }, [D(), D({ id: 'd2', reason: 'سبب الثاني' })], D({ id: 'd2' }));
    expect(s.getClientDispute).toHaveBeenCalledTimes(1);
    expect(s.getClientDispute).toHaveBeenCalledWith('d2');
    expect(s.c.detailsId()).toBe('d2');
    expect(s.el.querySelector('#dispute-d2')).not.toBeNull();
    expect(s.q('dispute-details')).not.toBeNull();
  });

  it('no query, or an id that is not in the list: nothing is opened automatically', async () => {
    const none = await setup({}, [D()], D());
    expect(none.getClientDispute).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
    const unknown = await setup({ dispute: 'zzz' }, [D()], D());
    expect(unknown.getClientDispute).not.toHaveBeenCalled();
  });

  it('a closed dispute shows the Arabic decision, the executed money effect and never the raw code', async () => {
    const detail = D({ status: 'RESOLVED', resolution: 'SPLIT', resolutionLabel: 'تقسيم المبلغ المحتجز بين الطرفين', resolutionNote: 'بعد مراجعة الأدلة', financialOutcome: { outcome: 'SPLIT', refundToClient: 300, releaseToProvider: 700, platformCommission: 70, providerNet: 630 } });
    const s = await setup({ dispute: 'd1' }, [detail], detail);
    const text = s.q('dispute-details')!.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('تقسيم المبلغ المحتجز بين الطرفين');
    expect(text).toContain('بعد مراجعة الأدلة');
    expect(text).not.toContain('SPLIT');
    expect(s.q('dispute-financial')!.textContent).toContain('300');
    expect(s.q('dispute-financial')!.textContent).toContain('700');
  });

  it('a text-closed dispute says no money changed; an open one with a frozen project shows the freeze reason', async () => {
    const closed = D({ status: 'RESOLVED', resolution: 'MUTUAL_CLOSE' });
    const a = await setup({ dispute: 'd1' }, [closed], closed);
    expect(a.q('dispute-resolution')!.textContent).toContain('إغلاق ودّي');
    expect(a.q('dispute-resolution')!.textContent).not.toContain('MUTUAL_CLOSE');
    expect(a.q('dispute-no-financial')!.textContent).toContain('لم يتغيّر أي مبلغ مالي');
    TestBed.resetTestingModule();
    const open = D({ projectFreeze: { frozen: true, activeDisputeCount: 1, disputeId: 'd1', reason: 'اعتماد المراحل وصرف الأموال موقوفان بسبب نزاع مفتوح' } });
    const b = await setup({ dispute: 'd1' }, [open], open);
    expect(b.q('dispute-freeze')!.textContent).toContain('موقوفان بسبب نزاع مفتوح');
  });
});
