import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AffiliatePicker } from './affiliate-picker';
import { AffiliateApiService, AffiliateSummary } from '../../../../core/services/affiliate-api.service';

// The single "اكتب اسم الوسيط أو كود الإحالة" typeahead.
const SARA: AffiliateSummary = { id: 'a-1', referralSlug: 'sara-ads', displayName: 'Sara Ali', levelName: 'موصل', verified: true, avatarUrl: 'https://img.test/sara.png' };
const KHALID: AffiliateSummary = { id: 'a-2', referralSlug: 'khalid2026', displayName: 'خالد العتيبي', levelName: 'مساعد', verified: false, avatarUrl: null };
const wait = (ms = 380) => new Promise(r => setTimeout(r, ms)); // the field debounces for 300 ms

describe('AffiliatePicker (single typeahead)', () => {
  let fixture: ComponentFixture<AffiliatePicker>;
  let component: AffiliatePicker;
  let search: ReturnType<typeof vi.fn>;
  let resolve: ReturnType<typeof vi.fn>;

  const setup = (opts: { search?: (q: string) => any; resolve?: (c: string) => any } = {}) => {
    search = vi.fn(opts.search ?? (() => of({ success: true, data: [SARA, KHALID] })));
    resolve = vi.fn(opts.resolve ?? (() => throwError(() => ({ status: 404 }))));
    TestBed.configureTestingModule({ imports: [AffiliatePicker], providers: [{ provide: AffiliateApiService, useValue: { search, resolve } }] });
    fixture = TestBed.createComponent(AffiliatePicker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector(s) as HTMLElement | null;
  const all = (s: string) => Array.from(el().querySelectorAll(s)) as HTMLElement[];
  const type = async (text: string, ms = 380) => { component.onInput(text); await wait(ms); fixture.detectChanges(); };
  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

  it('shows one input with the requested label and placeholder — no separate code box, no "تحقق" button', () => {
    setup();
    const input = q('#aff-search') as HTMLInputElement;
    expect(input.placeholder).toBe('اكتب اسم الوسيط أو كود الإحالة');
    expect(q('label[for="aff-search"]')!.textContent).toContain('اكتب اسم الوسيط أو كود الإحالة');
    expect(all('input').length).toBe(1);
    expect(q('#aff-code')).toBeNull();
    expect(el().textContent).not.toContain('لديك كود إحالة');
    expect(el().textContent).not.toContain('ابحث عن الوسيط بالاسم');
  });

  it('under 2 characters: no request and no results (only a hint)', async () => {
    setup();
    await type('a');
    expect(search).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
    expect(all('[data-testid="aff-card"]').length).toBe(0);
    expect(q('[data-testid="aff-hint"]')).not.toBeNull();
  });

  it('2+ characters: searches once (debounced) and renders result cards, not just names', async () => {
    setup();
    component.onInput('s'); component.onInput('sa'); component.onInput('sar');
    await wait(); fixture.detectChanges();
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('sar');
    const cards = all('[data-testid="aff-card"]');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Sara Ali');
    expect(cards[0].textContent).toContain('sara-ads');
    expect(cards[0].textContent).toContain('موصل');
    expect(cards[0].querySelector('[data-testid="aff-verified"]')!.textContent).toContain('موثق');
    expect(cards[0].querySelector('img.aff-avatar')!.getAttribute('src')).toBe('https://img.test/sara.png');
    // unverified marketer: no badge; no avatar url: initials fallback
    expect(cards[1].querySelector('[data-testid="aff-verified"]')).toBeNull();
    expect(cards[1].querySelector('img')).toBeNull();
    expect(cards[1].querySelector('.aff-avatar-fallback')!.textContent!.trim()).toBe('خا');
    // no commission / numeric level anywhere
    expect(el().textContent).not.toMatch(/عمولة|%/);
  });

  it('picking a card shows the selected card and sets the identifier to the referralSlug (never the id or the name)', async () => {
    setup();
    await type('sa');
    (all('[data-testid="aff-card"]')[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(q('#aff-selected')).not.toBeNull();
    expect(q('#aff-selected')!.textContent).toContain('Sara Ali');
    expect(q('#aff-selected')!.textContent).toContain('sara-ads');
    expect(q('#aff-selected')!.textContent).toContain('موثق');
    expect(q('#aff-search')).toBeNull();
    expect(component.value()).toBe('sara-ads');
    expect(component.value()).not.toBe('a-1');
    expect(component.value()).not.toBe('Sara Ali');
  });

  it('the clear button removes the selection: empty input again, identifier null', async () => {
    setup();
    await type('sa');
    (all('[data-testid="aff-card"]')[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    (q('#aff-clear') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(q('#aff-selected')).toBeNull();
    expect((q('#aff-search') as HTMLInputElement).value).toBe('');
    expect(component.value()).toBeNull();
  });

  it('no results: a clear Arabic message, and nothing is selected', async () => {
    setup({ search: () => of({ success: true, data: [] }) });
    await type('zzzz');
    expect(resolve).toHaveBeenCalledWith('zzzz'); // tried once as an exact code
    expect(q('[data-testid="aff-none"]')!.textContent).toContain('لا يوجد وسيط مطابق');
    expect(component.value()).toBeNull();
  });

  it('API error: a light Arabic message, nothing selected, nothing throws, registration is not blocked (value stays null)', async () => {
    setup({ search: () => throwError(() => ({ status: 500 })) });
    await type('sara');
    expect(q('[data-testid="aff-error"]')!.textContent).toContain('تعذر البحث الآن');
    expect(q('[data-testid="aff-error"]')!.textContent).toContain('بدون وسيط');
    expect(component.value()).toBeNull();
    expect(all('[data-testid="aff-card"]').length).toBe(0);
  });

  it('a full slug typed in the same field selects that marketer (identifier = referralSlug), case-insensitively', async () => {
    setup({ search: () => of({ success: true, data: [KHALID] }) });
    await type('KHALID2026');
    fixture.detectChanges();
    expect(q('#aff-selected')).not.toBeNull();
    expect(component.value()).toBe('khalid2026');
  });

  it('a full code that search does not match (e.g. the marketer id) is resolved once and selects the marketer by its slug', async () => {
    setup({ search: () => of({ success: true, data: [] }), resolve: () => of({ success: true, data: SARA }) });
    await type('a-1');
    fixture.detectChanges();
    expect(resolve).toHaveBeenCalledWith('a-1');
    expect(component.value()).toBe('sara-ads');
    expect(q('#aff-selected')!.textContent).toContain('Sara Ali');
  });

  it('typing without selecting never sets an identifier (nothing is sent for free text)', async () => {
    setup();
    await type('sara');
    expect(component.value()).toBeNull();
  });

  it('falls back to the id only when a marketer has no slug', () => {
    setup();
    component.pickResult({ id: 'a-9', referralSlug: '' as any, displayName: 'No Slug' });
    expect(component.value()).toBe('a-9');
  });
});
