import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SaFinanceReports } from './sa-finance-reports';

const readBlob = (b: Blob) => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsText(b); });

describe('SaFinanceReports export/print buttons', () => {
  afterEach(() => vi.restoreAllMocks());

  it('CSV downloads the active tab rows and print calls window.print', async () => {
    let blob: Blob | undefined;
    let name = '';
    (URL as any).createObjectURL = vi.fn((b: Blob) => { blob = b; return 'blob:x'; });
    (URL as any).revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { name = this.download; });
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const f = TestBed.createComponent(SaFinanceReports);
    f.detectChanges();
    f.componentInstance.setTab('expenses');
    (f.nativeElement.querySelector('[data-testid="frp-csv"]') as HTMLButtonElement).click();
    expect(name).toBe('finance-report-expenses.csv');
    expect(await readBlob(blob!)).toContain('البند,القيمة,النسبة %');
    (f.nativeElement.querySelector('[data-testid="frp-print"]') as HTMLButtonElement).click();
    expect(print).toHaveBeenCalled();
  });
});
