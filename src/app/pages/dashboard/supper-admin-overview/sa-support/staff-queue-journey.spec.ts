import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AdminOpsApiService } from '../../../../core/services/admin-ops-api.service';
import { DisputeApiService } from '../../../../core/services/dispute-api.service';
import { TicketApiService } from '../../../../core/services/ticket-api.service';
import { SaDisputes } from '../sa-disputes/sa-disputes';
import { SaSupport } from './sa-support';
import { SaSupportDetail } from './sa-support-detail/sa-support-detail';

const ticketsOk = { success: true, data: { items: [], counts: {}, pagination: { page: 2, pages: 3, limit: 20, total: 50 } } };

describe('staff queue journey: context survives opening a case', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('support queue restores filter, search and page from the URL and writes changes back', () => {
    const api = { adminListTickets: vi.fn(() => of(ticketsOk)) };
    TestBed.configureTestingModule({ imports: [SaSupport], providers: [provideRouter([]), { provide: TicketApiService, useValue: api },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ filter: 'IN_PROGRESS', q: 'تحويل', page: '2' }) } } }] });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const f = TestBed.createComponent(SaSupport);
    f.detectChanges();
    expect(api.adminListTickets).toHaveBeenLastCalledWith({ status: 'IN_PROGRESS', q: 'تحويل', page: 2 });
    expect(navigate).toHaveBeenLastCalledWith([], { replaceUrl: true, queryParams: { filter: 'IN_PROGRESS', q: 'تحويل', page: 2 } });
    f.componentInstance.setFilter('all');
    expect(navigate).toHaveBeenLastCalledWith([], { replaceUrl: true, queryParams: { filter: null, q: 'تحويل', page: null } });
  });

  it('support queue ignores an unknown filter and a bad page in the URL', () => {
    const api = { adminListTickets: vi.fn(() => of(ticketsOk)) };
    TestBed.configureTestingModule({ imports: [SaSupport], providers: [provideRouter([]), { provide: TicketApiService, useValue: api },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ filter: 'HACK', page: '-4' }) } } }] });
    TestBed.createComponent(SaSupport).detectChanges();
    expect(api.adminListTickets).toHaveBeenLastCalledWith({ status: undefined, q: undefined, page: 1 });
  });

  it('dispute queue restores filter and page, and keeps the follow-up deep link working', () => {
    const api = { getAdminDisputes: vi.fn(() => of({ success: true, data: { items: [], counts: {}, pagination: { page: 3, totalPages: 4, total: 40, limit: 10 } } })) };
    const setup = (params: Record<string, string>) => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [SaDisputes], providers: [provideRouter([]), { provide: DisputeApiService, useValue: api }, { provide: AdminOpsApiService, useValue: { listStaff: () => of({ success: true, data: [] }) } }, 
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } }] });
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      TestBed.createComponent(SaDisputes).detectChanges();
      return navigate;
    };
    const navigate = setup({ filter: 'UNDER_REVIEW', page: '3' });
    expect(api.getAdminDisputes).toHaveBeenLastCalledWith({ status: 'UNDER_REVIEW', page: 3, limit: 10 });
    expect(navigate).toHaveBeenLastCalledWith([], { replaceUrl: true, queryParams: { filter: 'UNDER_REVIEW', followUp: null, q: null, assignee: null, from: null, to: null, page: 3 } });
    setup({ followUp: 'true' });
    expect(api.getAdminDisputes).toHaveBeenLastCalledWith({ followUp: true, status: undefined, page: 1, limit: 10 });
  });

  it('dispute queue shows an Arabic message, not the server English text, when loading fails', () => {
    const api = { getAdminDisputes: vi.fn(() => throwError(() => ({ status: 500, error: { message: 'Internal Server Error' } }))) };
    TestBed.configureTestingModule({ imports: [SaDisputes], providers: [provideRouter([]), { provide: DisputeApiService, useValue: api }, { provide: AdminOpsApiService, useValue: { listStaff: () => of({ success: true, data: [] }) } }] });
    const f = TestBed.createComponent(SaDisputes);
    f.detectChanges();
    expect(f.componentInstance.error()).toMatch(/[؀-ۿ]/);
    expect(f.componentInstance.error()).not.toContain('Internal');
  });

  it('support detail: a network failure is not reported as "ticket not found" and offers a retry', () => {
    let fail = true;
    const api = { adminGetTicket: vi.fn(() => fail ? throwError(() => ({ status: 0 })) : of({ success: true, data: { ticket: { id: 't1', userId: 'u1', status: 'OPEN', priority: 'عادية', createdAt: '2026-10-01T00:00:00Z' }, user: null, messages: [] } })),
      adminListTickets: vi.fn(() => of(ticketsOk)) };
    TestBed.configureTestingModule({ imports: [SaSupportDetail], providers: [provideRouter([]), { provide: TicketApiService, useValue: api },
      { provide: AdminOpsApiService, useValue: { listStaff: () => of({ success: true, data: [] }) } },
      { provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap({ id: 't1' })) } }] });
    const f = TestBed.createComponent(SaSupportDetail);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="load-error"]')).toBeTruthy();
    expect(el.textContent).not.toContain('لم يتم العثور على التذكرة');
    fail = false;
    f.componentInstance.load();
    f.detectChanges();
    expect(el.querySelector('[data-testid="load-error"]')).toBeNull();
    expect(f.componentInstance.data()?.ticket.id).toBe('t1');
  });

  it('support detail: a real 404 still says the ticket was not found', () => {
    const api = { adminGetTicket: vi.fn(() => throwError(() => ({ status: 404 }))), adminListTickets: vi.fn() };
    TestBed.configureTestingModule({ imports: [SaSupportDetail], providers: [provideRouter([]), { provide: TicketApiService, useValue: api },
      { provide: AdminOpsApiService, useValue: { listStaff: () => of({ success: true, data: [] }) } },
      { provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap({ id: 'x' })) } }] });
    const f = TestBed.createComponent(SaSupportDetail);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('لم يتم العثور على التذكرة');
  });
});
