import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminOpsApiService } from '../../../../core/services/admin-ops-api.service';
import { DisputeApiService } from '../../../../core/services/dispute-api.service';
import { SaDisputes, normalizeDisputeSearch, validDay } from './sa-disputes';

const STAFF_ID = '4a3bbbba-95dd-45bd-be20-59b69a29fa2e';
const page = (extra: object = {}) => ({ success: true, data: { items: [], counts: {}, followUpCount: 0, pagination: { page: 1, limit: 10, total: 30, pages: 3, totalPages: 3 }, ...extra } });

function setup(params: Record<string, string> = {}, over: { api?: any; staff?: any } = {}) {
  const api = over.api ?? { getAdminDisputes: vi.fn(() => of(page())) };
  const ops = over.staff ?? { listStaff: vi.fn(() => of({ success: true, data: [{ id: STAFF_ID, name: 'منى', email: 'm@x', accountType: 'ADMIN' }] })) };
  TestBed.configureTestingModule({ imports: [SaDisputes], providers: [provideRouter([]), { provide: DisputeApiService, useValue: api }, { provide: AdminOpsApiService, useValue: ops },
    { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } }] });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const f = TestBed.createComponent(SaDisputes);
  f.detectChanges();
  return { f, c: f.componentInstance, api, ops, navigate, el: f.nativeElement as HTMLElement };
}
const lastQuery = (api: any) => api.getAdminDisputes.mock.lastCall[0];
const lastUrl = (nav: any) => nav.mock.lastCall[1].queryParams;

describe('admin dispute queue: search, assignee and period filters', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('restores every URL param and sends them all to the server', () => {
    const { api, navigate, c } = setup({ filter: 'OPEN', q: '3F6FA186', assignee: STAFF_ID, from: '2026-10-01', to: '2026-10-31', page: '2' });
    expect(lastQuery(api)).toEqual({ status: 'OPEN', q: '3f6fa186', assignee: STAFF_ID, createdFrom: '2026-10-01', createdTo: '2026-10-31', page: 2, limit: 10 });
    expect(lastUrl(navigate)).toEqual({ filter: 'OPEN', followUp: null, q: '3f6fa186', assignee: STAFF_ID, from: '2026-10-01', to: '2026-10-31', page: 2 });
    expect(c.searchDraft()).toBe('3f6fa186');
  });

  it('the follow-up deep link keeps working and combines with the new filters', () => {
    const { api } = setup({ followUp: 'true', assignee: 'me', q: '#3f6fa186…' });
    expect(lastQuery(api)).toEqual({ followUp: true, status: undefined, q: '3f6fa186', assignee: 'me', page: 1, limit: 10 });
  });

  it('ignores invalid URL values safely (bad dates, impossible period, bad ids, short search)', () => {
    const { api } = setup({ q: 'abc', assignee: 'hacker', from: '2026-02-31', to: 'x', filter: 'NOPE', page: '-2' });
    expect(lastQuery(api)).toEqual({ status: undefined, page: 1, limit: 10 });
    TestBed.resetTestingModule();
    const r = setup({ from: '2026-10-31', to: '2026-10-01' });
    expect(lastQuery(r.api)).toEqual({ status: undefined, page: 1, limit: 10 });
    expect(r.c.filterError()).toBe('');
    TestBed.resetTestingModule();
    const long = setup({ from: '2020-01-01', to: '2026-01-01' });
    expect(lastQuery(long.api).createdFrom).toBeUndefined();
  });

  it('a staff id in the URL is dropped when the staff list is not available to this account (never sent)', () => {
    const { api, c } = setup({ assignee: STAFF_ID }, { staff: { listStaff: vi.fn(() => throwError(() => ({ status: 403 }))) } });
    expect(lastQuery(api).assignee).toBeUndefined();
    expect(c.assigneeOptions().map(o => o.value)).toEqual(['', 'me', 'unassigned']);
  });

  it('assignee options: always الكل / المعيّن لي / غير معيّن, plus staff when the list is available', () => {
    const { c } = setup({});
    expect(c.assigneeOptions().map(o => o.label)).toEqual(['الكل', 'المعيّن لي', 'غير معيّن', 'منى']);
    expect(c.assigneeOptions().map(o => o.value)).toEqual(['', 'me', 'unassigned', STAFF_ID]);
  });

  it('a valid staff id in the URL is kept when the list has that person', () => {
    const { api, c } = setup({ assignee: STAFF_ID });
    expect(lastQuery(api).assignee).toBe(STAFF_ID);
    expect(c.assignee()).toBe(STAFF_ID);
  });

  it('any change resets to page 1 and is written to the URL; filters combine', () => {
    const { c, api, navigate } = setup({ page: '3' });
    expect(lastQuery(api).page).toBe(3);
    c.setAssignee('unassigned');
    expect(lastQuery(api)).toEqual({ status: undefined, assignee: 'unassigned', page: 1, limit: 10 });
    c.currentPage.set(3); c.setPeriod('from', '2026-10-01');
    expect(lastQuery(api)).toEqual({ status: undefined, assignee: 'unassigned', createdFrom: '2026-10-01', page: 1, limit: 10 });
    c.currentPage.set(3); c.setPeriod('to', '2026-10-20');
    c.currentPage.set(3); c.searchDraft.set(' 3f6f '); c.applySearch();
    expect(lastQuery(api)).toEqual({ status: undefined, q: '3f6f', assignee: 'unassigned', createdFrom: '2026-10-01', createdTo: '2026-10-20', page: 1, limit: 10 });
    c.currentPage.set(3); c.setFilter('RESOLVED');
    expect(lastQuery(api)).toEqual({ status: 'RESOLVED', q: '3f6f', assignee: 'unassigned', createdFrom: '2026-10-01', createdTo: '2026-10-20', page: 1, limit: 10 });
    expect(lastUrl(navigate)).toEqual({ filter: 'RESOLVED', followUp: null, q: '3f6f', assignee: 'unassigned', from: '2026-10-01', to: '2026-10-20', page: null });
  });

  it('search: Enter applies, a short or malformed term is explained and sends nothing, an empty box clears it', () => {
    const { c, api, el } = setup({});
    const calls = api.getAdminDisputes.mock.calls.length;
    c.searchDraft.set('ab'); c.applySearch(); (c as any).searchHint(); 
    expect(api.getAdminDisputes.mock.calls.length).toBe(calls);
    expect(c.searchHint()).toContain('4');
    c.searchDraft.set('zzzz'); c.applySearch();
    expect(api.getAdminDisputes.mock.calls.length).toBe(calls);
    c.searchDraft.set('3f6fa186'); c.applySearch();
    expect(c.searchHint()).toBe(''); expect(lastQuery(api).q).toBe('3f6fa186');
    c.searchDraft.set(''); c.applySearch();
    expect(lastQuery(api).q).toBeUndefined(); expect(c.appliedQuery()).toBe('');
    const input = el.querySelector('[data-testid="dispute-search"]') as HTMLInputElement;
    expect(input).toBeTruthy();
  });

  it('Enter in the search input triggers the search', () => {
    const { f, api, el } = setup({});
    const input = el.querySelector('[data-testid="dispute-search"]') as HTMLInputElement;
    input.value = '3f6fa186'; input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
    f.detectChanges();
    expect(lastQuery(api).q).toBe('3f6fa186');
  });

  it('an impossible period (from after to) is explained and nothing is sent', () => {
    const { c, api } = setup({});
    c.setPeriod('to', '2026-10-01');
    const calls = api.getAdminDisputes.mock.calls.length;
    c.setPeriod('from', '2026-10-05');
    expect(api.getAdminDisputes.mock.calls.length).toBe(calls);
    expect(c.filterError()).toContain('تاريخ البداية');
    c.setPeriod('from', '');
    expect(c.filterError()).toBe('');
    expect(lastQuery(api).createdTo).toBe('2026-10-01');
  });

  it('empty result: honest "no disputes" without filters, "no results for these filters" with a reset action when filtered', () => {
    const empty = { getAdminDisputes: vi.fn(() => of(page({ pagination: { page: 1, limit: 10, total: 0, pages: 0, totalPages: 0 } }))) };
    const plain = setup({}, { api: empty });
    expect(plain.el.textContent).toContain('لا توجد نزاعات في هذا التصنيف');
    expect(plain.el.querySelector('[data-testid="dispute-no-results"]')).toBeNull();
    TestBed.resetTestingModule();
    const filtered = setup({ q: '3f6fa186', assignee: 'me' }, { api: empty });
    expect(filtered.el.textContent).toContain('لا توجد نتائج لهذه المرشحات');
    (filtered.el.querySelector('[data-testid="dispute-empty-reset"]') as HTMLButtonElement).click();
    expect(lastQuery(filtered.api)).toEqual({ status: undefined, page: 1, limit: 10 });
    expect(lastUrl(filtered.navigate)).toEqual({ filter: null, followUp: null, q: null, assignee: null, from: null, to: null, page: null });
    expect(filtered.c.hasSearchFilters()).toBe(false);
  });

  it('reset clears status, search, assignee and period and returns to page 1', () => {
    const { c, api } = setup({ filter: 'OPEN', q: '3f6fa186', assignee: 'me', from: '2026-10-01', page: '2' });
    c.resetFilters();
    expect(lastQuery(api)).toEqual({ status: undefined, page: 1, limit: 10 });
    expect(c.activeFilter()).toBe('all');
  });

  it('page navigation keeps all filters and the URL; counters mirror the server answer', () => {
    const api = { getAdminDisputes: vi.fn(() => of(page({ counts: { OPEN: 2, RESOLVED: 1 }, followUpCount: 1 }))) };
    const { c, navigate } = setup({ q: '3f6fa186', assignee: 'me' }, { api });
    expect(c.countFor('all')).toBe(3); expect(c.countFor('OPEN')).toBe(2); expect(c.countFor('followUp')).toBe(1);
    c.nextPage();
    expect(lastQuery(api)).toEqual({ status: undefined, q: '3f6fa186', assignee: 'me', page: 2, limit: 10 });
    expect(lastUrl(navigate)).toMatchObject({ q: '3f6fa186', assignee: 'me', page: 2 });
    c.prevPage();
    expect(lastQuery(api).page).toBe(1);
  });

  it('open a dispute and come back: the real router keeps every param and the queue is restored exactly', async () => {
    const d = { id: '3f6fa186-0000-4000-8000-000000000001', status: 'OPEN', reason: 'سبب', evidence: [], createdAt: '2026-10-01T00:00:00Z' };
    const api = { getAdminDisputes: vi.fn(() => of(page({ items: [d] }))) };
    @Component({ template: '' }) class Detail {}
    TestBed.configureTestingModule({ imports: [SaDisputes], providers: [provideRouter([{ path: 'disputes', component: SaDisputes }, { path: ':id', component: Detail }]),
      { provide: DisputeApiService, useValue: api }, { provide: AdminOpsApiService, useValue: { listStaff: () => of({ success: true, data: [] }) } }] });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/disputes?filter=OPEN&q=3f6fa186&assignee=me&from=2026-10-01&to=2026-10-31&page=2');
    const f = TestBed.createComponent(SaDisputes);
    f.detectChanges(); await f.whenStable();
    expect(f.nativeElement.textContent).toContain('#3f6fa186…');
    const open = Array.from(f.nativeElement.querySelectorAll('button')).find((b: any) => b.textContent.includes('عرض التفاصيل')) as HTMLButtonElement;
    open.click(); await f.whenStable();
    expect(router.url).toContain('/3f6fa186-0000-4000-8000-000000000001');
    const q = router.parseUrl(router.url).queryParams;
    expect(q).toEqual({ filter: 'OPEN', q: '3f6fa186', assignee: 'me', from: '2026-10-01', to: '2026-10-31', page: '2' });
    // back (what the detail page's back button does) -> a fresh queue reads the same URL
    await router.navigateByUrl('/disputes?' + new URLSearchParams(q as any).toString());
    api.getAdminDisputes.mockClear();
    const back = TestBed.createComponent(SaDisputes); back.detectChanges();
    expect(lastQuery(api)).toEqual({ status: 'OPEN', q: '3f6fa186', assignee: 'me', createdFrom: '2026-10-01', createdTo: '2026-10-31', page: 2, limit: 10 });
  });

  it('a stale response never overwrites a newer one', () => {
    const slow = new Subject<any>(); const fast = new Subject<any>();
    const api = { getAdminDisputes: vi.fn().mockReturnValueOnce(of(page())).mockReturnValueOnce(slow).mockReturnValueOnce(fast) };
    const { c } = setup({}, { api });
    c.setAssignee('me'); c.setAssignee('unassigned');
    fast.next(page({ items: [{ id: 'new', status: 'OPEN', reason: 'new', evidence: [] }], counts: { OPEN: 1 } })); fast.complete();
    slow.next(page({ items: [{ id: 'old', status: 'OPEN', reason: 'old', evidence: [] }], counts: { OPEN: 9 } })); slow.complete();
    expect(c.disputes().map(d => d.id)).toEqual(['new']);
    expect(c.countFor('OPEN')).toBe(1);
  });

  it('loading error shows an Arabic message and retry repeats the same query', () => {
    const api = { getAdminDisputes: vi.fn((): any => throwError(() => ({ status: 500, error: { message: 'Internal Server Error' } }))) };
    const { c, el, f } = setup({ q: '3f6fa186' }, { api });
    f.detectChanges();
    expect(c.error()).toMatch(/[؀-ۿ]/); expect(c.error()).not.toContain('Internal');
    expect(el.textContent).toContain('إعادة المحاولة');
    api.getAdminDisputes.mockReturnValue(of(page()));
    c.fetchDisputes();
    expect(lastQuery(api).q).toBe('3f6fa186'); expect(c.error()).toBe('');
  });

  it('normalizers', () => {
    expect(normalizeDisputeSearch('#3F6FA186…')).toBe('3f6fa186');
    expect(normalizeDisputeSearch('abc')).toBeNull(); expect(normalizeDisputeSearch('xyzxyz')).toBeNull(); expect(normalizeDisputeSearch(null)).toBeNull();
    expect(validDay('2024-02-29')).toBe('2024-02-29'); expect(validDay('2023-02-29')).toBeNull(); expect(validDay('2024-2-9')).toBeNull(); expect(validDay('')).toBeNull();
  });
});
