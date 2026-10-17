import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ArchivedProjects } from './archived-projects';
import { AuthStore } from '../../../../../core/store/auth.store';

// The client archive: a project closed by a dispute settlement is labelled «أُغلق بتسوية نزاع», is not counted as «مكتملة», and never offers a NEW rating.
const ITEM = (o: Record<string, unknown>) => ({ id: 'p', projectId: 'p', title: 'مشروع', status: 'COMPLETED', provider: { name: 'نورة' }, totalPrice: 20, completedAt: '2026-10-01T00:00:00Z', canRate: true, hasRated: false, adminSettled: null, ...o });

describe('client archived projects: settled end state', () => {
  async function setup(items: any[]) {
    await TestBed.configureTestingModule({ imports: [ArchivedProjects], providers: [provideRouter([]),
      { provide: HttpClient, useValue: { get: vi.fn(() => of({ success: true, data: { items } })), post: vi.fn() } }, { provide: AuthStore, useValue: { currentUser: () => null } }] }).compileComponents();
    const f = TestBed.createComponent(ArchivedProjects); f.detectChanges(); await f.whenStable(); f.detectChanges();
    return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement };
  }
  afterEach(() => TestBed.resetTestingModule());

  it('a settled project shows the settlement label (not «مكتمل»), cannot be rated, and is not counted among the completed ones', async () => {
    const s = await setup([ITEM({ id: 'a', adminSettled: { disputeId: 'd', outcome: 'SPLIT', label: 'أُغلق بتسوية نزاع' }, statusLabel: 'أُغلق بتسوية نزاع' }), ITEM({ id: 'b' })]);
    const rows = Array.from(s.el.querySelectorAll('.pl-row')) as HTMLElement[];
    const settledRow = rows.find(r => r.textContent!.includes('أُغلق بتسوية نزاع'))!;
    expect(settledRow).toBeTruthy();
    expect(settledRow.querySelector('.pl-pill')?.textContent?.trim()).toBe('أُغلق بتسوية نزاع');
    const deliveredRow = rows.find(r => !r.textContent!.includes('أُغلق بتسوية نزاع'))!;
    expect(deliveredRow.querySelector('.pl-pill')?.textContent?.trim()).toBe('مكتمل');
    const [settled, delivered] = s.c.projects();
    expect(settled.status).toBe('settled'); expect(settled.canRate).toBe(false);
    expect(delivered.status).toBe('done'); expect(delivered.canRate).toBe(true);
    expect(s.c.kpis().find(k => k.label === 'مكتملة')!.value).toBe(1);
    expect(s.c.kpis().find(k => k.label === 'إجمالي المنتهية')!.value).toBe(2);
    expect(s.c.tabs().some(t => t.label === 'أُغلق بتسوية نزاع' && t.count === 1)).toBe(true);
  });

  it('without a settled project there is no settlement tab', async () => {
    const s = await setup([ITEM({ id: 'b' })]);
    expect(s.c.tabs().some(t => t.id === 'settled')).toBe(false);
  });
});
