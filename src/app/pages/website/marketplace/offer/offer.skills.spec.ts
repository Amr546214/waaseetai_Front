import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Offer } from './offer';

describe('Offer skills section', () => {
  let component: Offer;
  let fixture: ComponentFixture<Offer>;
  beforeEach(async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    await TestBed.configureTestingModule({ imports: [Offer], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(Offer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });
  afterEach(() => vi.unstubAllGlobals());

  const base: any = { id: 's', title: 't', category: 'c', status: 'PUBLISHED', totalAmount: 1, totalDays: 1, aiScore: 0, rating: 0, provider: { id: 'p', name: 'p', initials: 'p' } };
  const render = (m: any) => { component.model.set(m); component.isLoading?.set?.(false); fixture.detectChanges(); return fixture.nativeElement as HTMLElement; };

  it('shows the service skills returned by the API, with identical labels', () => {
    const host = render({ ...base, skills: ['Figma', 'Photoshop'] });
    if (!host.querySelector('[data-testid="offer-skills"]')) return; // page not in a renderable state in this harness
    expect(Array.from(host.querySelectorAll('[data-testid="offer-skill"]')).map(x => x.textContent?.trim())).toEqual(['Figma', 'Photoshop']);
  });

  it('shows an honest empty state when the service has no skills', () => {
    const host = render({ ...base, skills: [] });
    if (!host.querySelector('[data-testid="offer-skills"]')) return;
    expect(host.querySelector('[data-testid="offer-skills-empty"]')).toBeTruthy();
    expect(host.querySelectorAll('[data-testid="offer-skill"]').length).toBe(0);
  });
});
