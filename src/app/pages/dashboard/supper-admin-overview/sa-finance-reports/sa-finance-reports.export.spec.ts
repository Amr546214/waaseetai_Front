import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { SaFinanceReports } from './sa-finance-reports';
import { AdminOpsApiService } from '../../../../core/services/admin-ops-api.service';

const readBlob = (b: Blob) => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsText(b); });

// D2: the export is the server-produced commissions CSV (real data), and "طباعة / حفظ PDF" prints the page (no fake PDF file).
function make(api: any) {
  TestBed.configureTestingModule({ providers: [{ provide: AdminOpsApiService, useValue: api }] });
  const f = TestBed.createComponent(SaFinanceReports);
  f.detectChanges();
  return f;
}

describe('SaFinanceReports export/print buttons', () => {
  afterEach(() => { vi.restoreAllMocks(); TestBed.resetTestingModule(); });

  it('CSV downloads the server commissions file and print calls window.print', async () => {
    let blob: Blob | undefined;
    let name = '';
    (URL as any).createObjectURL = vi.fn((b: Blob) => { blob = b; return 'blob:x'; });
    (URL as any).revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { name = this.download; });
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const downloadCsv = vi.fn(() => of(new Blob(['id,amount\n1,9'], { type: 'text/csv' })));
    const f = make({ financeOverview: () => of({ success: true, data: null }), downloadCsv });
    f.componentInstance.setTab('expenses');
    f.detectChanges();
    (f.nativeElement.querySelector('[data-testid="frp-csv"]') as HTMLButtonElement).click();
    expect(downloadCsv).toHaveBeenCalledWith('commissions');
    expect(name).toBe('commissions.csv');
    expect(await readBlob(blob!)).toContain('id,amount');
    const printBtn = f.nativeElement.querySelector('[data-testid="frp-print"]') as HTMLButtonElement;
    expect(printBtn.textContent).toContain('طباعة / حفظ PDF');
    printBtn.click();
    expect(print).toHaveBeenCalled();
  });

  it('a failed export is reported and no file is saved', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const f = make({ financeOverview: () => of({ success: true, data: null }), downloadCsv: () => throwError(() => ({ error: { message: 'فشل' } })) });
    (f.nativeElement.querySelector('[data-testid="frp-csv"]') as HTMLButtonElement).click();
    expect(click).not.toHaveBeenCalled();
    expect(f.componentInstance.exportError()).toBeTruthy();
  });
});
