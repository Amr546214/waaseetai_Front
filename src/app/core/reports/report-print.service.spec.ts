import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ReportPrintService } from './report-print.service';
import { UiNotificationService } from '../services/ui-notification.service';

describe('report print coordinator', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.querySelectorAll('iframe').forEach(frame => frame.remove());
    vi.restoreAllMocks();
  });

  function setup() {
    const notify = { warning: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: UiNotificationService, useValue: notify }] });
    return { printer: TestBed.inject(ReportPrintService), notify };
  }

  it('blocks repeated clicks while fonts load and removes a failed preview', async () => {
    let reject!: (error: Error) => void;
    const ready = new Promise<void>((_resolve, fail) => reject = fail);
    const append = document.body.append.bind(document.body);
    vi.spyOn(document.body, 'append').mockImplementation((...nodes) => {
      append(...nodes);
      for (const frame of nodes) {
        if (frame instanceof HTMLIFrameElement) {
          Object.defineProperty(frame.contentDocument!, 'fonts', { value: { load: () => ready, ready: Promise.resolve() }, configurable: true });
        }
      }
    });
    const { printer, notify } = setup();
    const report = { title: 'تقرير', sections: [{ title: 'بيانات', facts: [['قيمة', 0]] as Array<[string, unknown]> }] };
    printer.print(report);
    printer.print(report);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    expect(printer.preparing()).toBe(true);
    const doc = document.querySelector('iframe')!.contentDocument!;
    expect(doc.body.textContent).toContain('تاريخ الاستخراج');
    expect(doc.body.textContent).not.toContain('لوحة التحكم');
    reject(new Error('failed'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(notify.error).toHaveBeenCalledOnce();
    expect(printer.preparing()).toBe(false);
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('never opens an empty report', () => {
    const { printer, notify } = setup();
    printer.print({ title: 'غير محمل', sections: [] });
    expect(document.querySelector('iframe')).toBeNull();
    expect(notify.warning).toHaveBeenCalledOnce();
  });
});
