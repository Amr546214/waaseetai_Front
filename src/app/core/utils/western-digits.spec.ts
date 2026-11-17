import { installWesternDigits, toWesternDigits } from './western-digits';

describe('western digits', () => {
  it('converts Arabic-Indic and Persian digits and nothing else', () => {
    expect(toWesternDigits('٣٠٤٨٠١٢٢٠٣٢٩٦')).toBe('30480122032' + '96');
    expect(toWesternDigits('۱۲۳ abc عمرو ٤')).toBe('123 abc عمرو 4');
  });
  it('rewrites typed digits in text fields and textareas but never in passwords', () => {
    const stop = installWesternDigits(document);
    const mk = (tag: string, type?: string) => { const e = document.createElement(tag) as HTMLInputElement; if (type) e.type = type; document.body.appendChild(e); return e; };
    const text = mk('input', 'text'); const area = mk('textarea'); const pw = mk('input', 'password');
    for (const e of [text, area, pw]) { e.value = '٣٤٥'; e.dispatchEvent(new Event('input', { bubbles: true })); }
    expect(text.value).toBe('345'); expect(area.value).toBe('345'); expect(pw.value).toBe('٣٤٥');
    stop();
    text.value = '٣'; text.dispatchEvent(new Event('input', { bubbles: true }));
    expect(text.value).toBe('٣');
    [text, area, pw].forEach(e => e.remove());
  });
});
