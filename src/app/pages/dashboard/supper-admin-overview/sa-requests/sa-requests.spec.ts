import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SaRequests } from './sa-requests';
import { formatBudget } from './sa-requests.service';

const row = (o: any = {}) => ({
  id: 'abcdef12-0000', title: 'طلب', status: 'OPEN', projectStatus: null, contractStatus: null,
  client: { userId: 'u1', name: 'عميل', email: 'a@b.c', accountType: 'CLIENT', memberSince: '2026-01-01', rating: null, completedProjects: 0 },
  specialty: 'برمجة', budget: { type: 'RANGE', min: 100, max: 300, currency: 'USD' }, durationDays: 10,
  offersCount: 2, openDisputes: 0, createdAt: '2026-01-02T00:00:00Z', ...o,
});
const payload = (items = [row()]) => ({
  success: true,
  data: { items, pagination: { page: 1, limit: 20, total: items.length, totalPages: 3 }, counts: { all: 9, disputed: 2, OPEN: 4, COMPLETED: 1 } },
});

function setup(get: any) {
  TestBed.configureTestingModule({ imports: [SaRequests], providers: [provideRouter([]), { provide: HttpClient, useValue: { get } }] });
  const f = TestBed.createComponent(SaRequests);
  f.detectChanges();
  return f;
}

describe('SaRequests (live)', () => {
  it('loads from the API and maps counts, with disputed replacing needs-review', () => {
    const get = vi.fn().mockReturnValue(of(payload()));
    const c = setup(get).componentInstance;
    expect(get.mock.calls[0][0]).toContain('/admin/requests');
    expect(c.items().length).toBe(1);
    expect(c.stats()).toEqual({ total: 9, open: 4, completed: 1, disputed: 2 });
    expect(c.counts().CANCELLED).toBe(0);
  });

  it('sends status and page to the server and resets page on filter change', () => {
    const get = vi.fn().mockReturnValue(of(payload()));
    const c = setup(get).componentInstance;
    c.goPage(2);
    expect(get.mock.calls.at(-1)![1].params.get('page')).toBe('2');
    c.setFilter('DISPUTED');
    const p = get.mock.calls.at(-1)![1].params;
    expect(p.get('status')).toBe('DISPUTED');
    expect(p.get('page')).toBe('1');
  });

  it('debounces server search', () => {
    vi.useFakeTimers();
    const get = vi.fn().mockReturnValue(of(payload()));
    const c = setup(get).componentInstance;
    c.onSearch('ab'); c.onSearch('abc');
    expect(get).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(400);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1][1].params.get('search')).toBe('abc');
    vi.useRealTimers();
  });

  it('shows the BE error message', () => {
    const c = setup(vi.fn().mockReturnValue(throwError(() => ({ error: { message: 'خطأ من الخادم' } })))).componentInstance;
    expect(c.error()).toBe('خطأ من الخادم');
    expect(c.loading()).toBe(false);
  });

  it('formats budgets in USD', () => {
    expect(formatBudget({ type: 'RANGE', min: 100, max: 300, currency: 'USD' })).toBe('100–300 $');
    expect(formatBudget({ type: 'FIXED', min: 500, max: null, currency: 'USD' })).toBe('500 $');
    expect(formatBudget({ type: 'FIXED', min: null, max: null, currency: 'USD' })).toBe('—');
  });
});
