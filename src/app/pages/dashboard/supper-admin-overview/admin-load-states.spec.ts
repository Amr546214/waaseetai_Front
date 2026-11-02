import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { SaSecurity } from './it/sa-security/sa-security';
import { AdminSecurityApiService } from '../../../core/services/admin-security-api.service';
import { SUPPER_ADMIN_ROUTES } from './supper-admin.routes';

// Admin audit 2026-10-22: a failed load must never render as zero / "no data".
describe('admin load states', () => {
  it('security: a failed feed shows an error with retry and dashes, not "0 events"', () => {
    TestBed.configureTestingModule({
      imports: [SaSecurity],
      providers: [{ provide: AdminSecurityApiService, useValue: { getSecurityEvents: () => throwError(() => new Error('x')) } }],
    });
    const f = TestBed.createComponent(SaSecurity);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="itsec-error"]')).toBeTruthy();
    expect(el.textContent).not.toContain('لا توجد أحداث في هذه الفئة');
    expect(Array.from(el.querySelectorAll('.it-kpi-val')).map((n) => n.textContent?.trim())).toEqual(['—', '—', '—']);
  });

  it('security: success still shows real numbers', () => {
    TestBed.configureTestingModule({
      imports: [SaSecurity],
      providers: [{ provide: AdminSecurityApiService, useValue: { getSecurityEvents: () => of({ success: true, data: { events: [], kpis: { totalEventsToday: 6, criticalOrWarningToday: 1, failedLoginAttemptsToday: 2 } } }) } }],
    });
    const f = TestBed.createComponent(SaSecurity);
    f.detectChanges();
    expect(Array.from((f.nativeElement as HTMLElement).querySelectorAll('.it-kpi-val')).map((n) => n.textContent?.trim())).toEqual(['6', '1', '2']);
  });

  it('sub-finance: the group has its own empty-path page (sidebar link no longer blank)', () => {
    const group: any = (function find(rs: any[]): any {
      for (const r of rs) { if (r.path === 'sub-finance' && r.children) return r; if (r.children) { const f = find(r.children); if (f) return f; } }
    })(SUPPER_ADMIN_ROUTES);
    const home = group.children.find((c: any) => c.path === '');
    expect(home).toBeTruthy();
    expect(home.pathMatch).toBe('full');
    expect(group.children.some((c: any) => c.path === 'sub-finance')).toBe(false);
  });
});
