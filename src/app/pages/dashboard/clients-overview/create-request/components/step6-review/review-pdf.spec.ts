import { vi } from 'vitest';
import { printReviewDocument } from './review-pdf';

describe('request review PDF', () => {
  afterEach(() => { document.querySelectorAll('iframe').forEach(frame => frame.remove()); vi.restoreAllMocks(); });

  it('prints only the complete review snapshot, preserving Arabic and user text without dashboard or publish controls', async () => {
    const source = document.createElement('article');
    source.dir = 'rtl';
    const description = document.createElement('p');
    description.textContent = 'تفاصيل المشروع <script>alert(1)</script> React وواجهات عربية';
    source.append(description);
    const edit = document.createElement('button'); edit.textContent = 'تعديل'; source.append(edit);
    let frame!: HTMLIFrameElement;
    const print = vi.fn();
    const originalTitle = document.title;
    await printReviewDocument(source, 'طلب تطوير واجهات', created => {
      frame = created;
      vi.spyOn(created.contentWindow!, 'print').mockImplementation(print);
      vi.spyOn(created.contentWindow!, 'focus').mockImplementation(() => {});
    });
    expect(print).toHaveBeenCalledOnce();
    expect(frame.contentDocument!.title).toBe('طلب تطوير واجهات');
    expect(frame.contentDocument!.documentElement.dir).toBe('rtl');
    expect(frame.contentDocument!.body.textContent).toContain(description.textContent);
    expect(frame.contentDocument!.querySelector('script')).toBeNull();
    expect(frame.contentDocument!.querySelector('button')).toBeNull();
    expect(source.querySelector('button')).not.toBeNull();
    expect(document.title).toBe(originalTitle);
    frame.contentWindow!.dispatchEvent(new Event('afterprint'));
    expect(frame.isConnected).toBe(false);
  });

  it('waits for the Arabic font before opening the print dialog', async () => {
    const source = document.createElement('article');
    let release!: () => void;
    const loaded = new Promise<void>(resolve => release = resolve);
    const print = vi.fn();
    const exporting = printReviewDocument(source, 'ملخص الطلب', frame => {
      vi.spyOn(frame.contentWindow!, 'print').mockImplementation(print);
      vi.spyOn(frame.contentWindow!, 'focus').mockImplementation(() => {});
      Object.defineProperty(frame.contentDocument!, 'fonts', { value: { load: () => loaded, ready: Promise.resolve() }, configurable: true });
    });
    expect(print).not.toHaveBeenCalled();
    release();
    await exporting;
    expect(print).toHaveBeenCalledOnce();
  });
});
