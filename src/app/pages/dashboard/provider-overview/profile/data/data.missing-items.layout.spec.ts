import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Data } from './data';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// "لإكمال ملفك إلى 100%" cards: one uniform layout whatever the number of items or the length of the text. Visual only: the items and percentages come from the backend untouched.
const css = readFileSync(join(__dirname, 'data.css'), 'utf8');
const rule = (sel: string) => (css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{([^}]*)\\}`)) ?? [])[1] ?? '';
const LONG = 'اكتب وصفًا مهنيًا من 50 حرفًا على الأقل يوضح خبرتك ومجالات تخصصك وما يميزك عن غيرك من مقدمي الخدمات في نفس المجال';
const BASE = {
  headline: 'مصمم', mainSpecialty: 'تصميم', bio: 'x'.repeat(60), country: 'السعودية', city: 'الرياض', location: '', hourlyRate: null, yearsOfExperience: null,
  user: { firstName: 'أحمد', lastName: 'علي', email: 'a@b.co', phoneNumber: '+966501234567', alternativePhone: '', idDocumentUrl: null },
  certUrls: [], skills: [{ name: 'Figma' }], portfolioItems: [], languages: [],
};
const FOUR = { ...BASE, completionPercentage: 55, missingItems: [
  { key: 'bio', label: 'الوصف المهني', points: 15, status: 'missing', tab: 'bio', hint: LONG },
  { key: 'payout', label: 'حساب PayPal لاستلام المدفوعات', points: 10, status: 'missing', tab: 'payout', hint: 'أضف بريد PayPal لاستلام المدفوعات' },
  { key: 'idDocument', label: 'مستند إثبات الهوية', points: 10, status: 'pending_review', tab: 'docs', hint: 'مستند الهوية قيد المراجعة' },
  { key: 'portfolio', label: 'أعمال سابقة', points: 10, status: 'rejected', tab: 'portfolio', hint: 'تم رفض العمل، عدّله وأعد الإرسال' },
] };

describe('provider data page: missing-items cards layout', () => {
  let fixture: ComponentFixture<Data>;
  const all = (s: string) => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(s)) as HTMLElement[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Data],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { currentUser: () => null } },
        { provide: ProviderProfileService, useValue: {
          getProfile: vi.fn(() => of(FOUR)), getSpecialtyCategories: () => of({ success: true, data: [] }), getSkillsCatalog: () => of({ success: true, data: { category: null, skills: [] } }), getActiveSessions: vi.fn(() => of({ data: [] })), getChangeRequests: vi.fn(() => of([])),
          updateSkills: vi.fn(() => of({})), savePaypalPayoutEmail: vi.fn(() => of({})), requestPaypalEmailChange: vi.fn(() => of({})),
        } },
      ],
    });
    fixture = TestBed.createComponent(Data);
    fixture.detectChanges();
    fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();
  });
  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

  it('4 items (including a very long hint) all render with the SAME structure: label, hint, one badge, one arrow', () => {
    const items = all('.miss-item');
    expect(items.length).toBe(4);
    for (const li of items) {
      expect(li.querySelectorAll('.miss-label').length).toBe(1);
      expect(li.querySelectorAll('.miss-hint').length).toBe(1);
      expect(li.querySelectorAll('.miss-badge').length).toBe(1);
      expect(li.querySelectorAll('.miss-go').length).toBe(1);
    }
    expect(all('.miss-hint')[0].textContent).toContain('اكتب وصفًا مهنيًا من 50 حرفًا على الأقل');
    expect(all('.miss-hint')[0].getAttribute('title')).toContain('اكتب وصفًا مهنيًا'); // the clamped text stays readable on hover
    expect(all('.miss-badge').map(b => b.textContent!.trim())).toEqual(['ناقص · +15%', 'ناقص · +10%', 'قيد المراجعة', 'مرفوض — يحتاج تعديل']);
  });

  it('the grid is 3 / 2 / 1 columns by container width, with shrinkable tracks (no fixed px column that breaks a phone, no horizontal scroll)', () => {
    const list = rule('.miss-list');
    expect(list).toContain('display:grid');
    expect(list).toContain('repeat(3,minmax(0,1fr))');
    expect(list).toContain('align-items:stretch');
    expect(list).not.toMatch(/minmax\(\d+px/);
    expect(css).toMatch(/@container \(max-width:760px\)\{\.miss-list\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/);
    expect(css).toMatch(/@container \(max-width:480px\)\{\.miss-list\{grid-template-columns:minmax\(0,1fr\)\}\}/);
    expect(rule('.miss-box')).toContain('container-type:inline-size');
    expect(rule('.miss-link')).not.toMatch(/(?:^|;)(?:width|min-width):\d+px/);
  });

  it('cards in one row have the same height: the item is a flex box and the button fills it, with a minimum height', () => {
    expect(rule('.miss-item')).toContain('display:flex');
    const link = rule('.miss-link');
    expect(link).toContain('flex:1');
    expect(link).toMatch(/min-height:\d+px/);
    expect(link).toContain('grid-template-columns:minmax(0,1fr) auto auto'); // text | badge | arrow: fixed positions
  });

  it('long text wraps and is clamped inside the card instead of pushing its height', () => {
    for (const sel of ['.miss-label,.miss-hint']) {
      const r = rule(sel);
      expect(r).toContain('-webkit-line-clamp:2');
      expect(r).toContain('overflow:hidden');
      expect(r).toContain('overflow-wrap:anywhere');
    }
    expect(rule('.miss-badge')).toContain('white-space:nowrap');
  });

  it('dark is the default (readable light-on-dark badges), light theme overrides them, and focus is visible', () => {
    expect(rule('.miss-badge')).toContain('color:#FBBF24');
    expect(css).toMatch(/:host-context\(body\.light-theme\) \.miss-badge[^{]*\{color:#92400E/);
    expect(css).toMatch(/:host-context\(body\.light-theme\) \.miss-badge\.is-pending[^{]*\{color:#1D4ED8/);
    expect(css).toMatch(/\.miss-link:focus-visible\{outline:2px solid/);
    expect(css).toMatch(/\.miss-link:hover\{/);
  });
});
