import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { vi } from 'vitest';
import { SpecialtiesBar } from './specialties-bar';

const CATS = [
  { id: '1', slug: 'ai-data', name: 'البيانات والذكاء الاصطناعي', icon: 'bar-chart', count: 12, subSpecialties: [{ id: 'a', slug: 'ml', name: 'تعلم الآلة' }, { id: 'b', slug: 'viz', name: 'لوحات بيانات' }] },
  { id: '2', slug: 'design', name: 'الإبداع والتصميم', icon: 'palette', count: 9, subSpecialties: [{ id: 'c', slug: 'logo', name: 'تصميم شعارات' }] },
  { id: '3', slug: 'legal', name: 'الخدمات القانونية', icon: 'scale', count: 4, subSpecialties: [] },
];

@Component({ standalone: true, imports: [SpecialtiesBar], template: `<app-specialties-bar [categories]="cats" [activeCategory]="active" [activeSub]="sub" />` })
class Host { cats: any[] = CATS; active = 'design'; sub = ''; }

describe('SpecialtiesBar', () => {
  let fixture: ComponentFixture<Host>;
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector(s) as HTMLElement | null;
  const all = (s: string) => Array.from(el().querySelectorAll(s)) as HTMLElement[];
  const flush = () => fixture.detectChanges();

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(Host);
    flush();
  });
  afterEach(() => document.documentElement.classList.remove('spb-lock'));

  it('renders one chip per specialty (real data) with its count, the active one highlighted, and the real total', () => {
    expect(all('.spb-chip').length).toBe(3);
    expect(all('.spb-chip .spb-cnt').map(c => c.textContent!.trim())).toEqual(['12', '9', '4']);
    expect(q('.spb-chip.active .spb-chip-name')!.textContent).toContain('الإبداع');
    expect(q('.spb-badge')!.textContent!.trim()).toBe('3'); // 2 + 1 + 0 sub-specialties = 3
  });

  it('chips and sub links use the app routes: /marketplace/:slug and /marketplace/:slug?sub=:sub', () => {
    expect(all('.spb-chip').map(a => a.getAttribute('href'))).toEqual(['/marketplace/ai-data', '/marketplace/design', '/marketplace/legal']);
    q('[data-testid="spb-all"]')!.click(); flush();
    expect(all('.spb-sub').map(a => a.getAttribute('href'))).toEqual(['/marketplace/design?sub=logo']); // the active specialty opens first
    expect(q('.spb-cta')!.getAttribute('href')).toBe('/marketplace/design');
  });

  it('opening the mega panel shows search, all chips and the detail; picking another specialty switches the detail', () => {
    q('[data-testid="spb-all"]')!.click(); flush();
    expect(q('[data-testid="spb-panel"]')).toBeTruthy();
    expect(all('.spb-mchip').length).toBe(3);
    all('.spb-mchip')[0].click(); flush();
    expect(q('.spb-detail-name')!.textContent).toContain('البيانات');
    expect(all('.spb-sub').map(a => a.textContent!.trim())).toEqual(['تعلم الآلة', 'لوحات بيانات']);
  });

  it('a specialty without sub-specialties still offers "عرض كل خدمات …"', () => {
    q('[data-testid="spb-all"]')!.click(); flush();
    all('.spb-mchip')[2].click(); flush();
    expect(q('.spb-empty')).toBeTruthy();
    expect(q('.spb-cta')!.textContent).toContain('الخدمات القانونية');
  });

  it('search narrows the specialties (by specialty or sub-specialty name) and shows an empty state', () => {
    q('[data-testid="spb-all"]')!.click(); flush();
    const input = q('[data-testid="spb-search"]') as HTMLInputElement;
    input.value = 'شعارات'; input.dispatchEvent(new Event('input')); flush();
    expect(all('.spb-mchip').length).toBe(1);
    expect(q('.spb-detail-name')!.textContent).toContain('الإبداع');
    input.value = 'غير موجود'; input.dispatchEvent(new Event('input')); flush();
    expect(q('[data-testid="spb-no-results"]')).toBeTruthy();
  });

  it('closes with the X, the backdrop and Escape', () => {
    for (const close of [
      () => q('[data-testid="spb-close-top"]')!.click(),
      () => q('[data-testid="spb-overlay"]')!.click(),
      () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
    ]) {
      q('[data-testid="spb-all"]')!.click(); flush();
      expect(q('[data-testid="spb-panel"]')).toBeTruthy();
      close(); flush();
      expect(q('[data-testid="spb-panel"]')).toBeNull();
    }
  });

  it('follows a link: the panel closes and the router navigates', async () => {
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    q('[data-testid="spb-all"]')!.click(); flush();
    q('.spb-cta')!.click(); flush();
    expect(q('[data-testid="spb-panel"]')).toBeNull();
    expect(nav).toHaveBeenCalled();
  });

  it('renders nothing while there are no categories', () => {
    fixture.componentInstance.cats = []; fixture.changeDetectorRef.detectChanges();
    expect(q('[data-testid="specialties-bar"]')).toBeNull();
  });
});
