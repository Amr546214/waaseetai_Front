import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { Marketplace } from './marketplace';
import { MarketplaceService } from '../../../core/services/marketplace.service';

// Service cards show the skills the provider attached (names from the catalog) and a skill chip filters by the EXACT name.
describe('Marketplace skills on cards + skill filter', () => {
  let component: Marketplace;
  let fixture: ComponentFixture<Marketplace>;
  let svc: any;

  beforeEach(async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    svc = {
      getPublishedModels: vi.fn(() => of({ data: { models: [], total: 0, totalPages: 1 } })),
      getCategories: () => of({ data: { categories: [] } }),
      getAiRecommendations: () => of({ data: { recommendations: [] } }),
      getFavorites: () => of([]),
    };
    await TestBed.configureTestingModule({
      imports: [Marketplace],
      providers: [provideRouter([]), { provide: MarketplaceService, useValue: svc }],
    }).compileComponents();
    fixture = TestBed.createComponent(Marketplace);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }, 30000);
  afterEach(() => vi.unstubAllGlobals());

  const models = [
    { id: 'a', title: 'خدمة أ', provider: { id: 'p', name: 'م', initials: 'م' }, skills: ['Figma', 'Photoshop', 'Illustrator', 'XD'] },
    { id: 'b', title: 'خدمة ب', provider: { id: 'p', name: 'م', initials: 'م' } },
  ];

  it('renders up to 3 skill chips from the API output, "+N" for the rest, and nothing invented for a service without skills', () => {
    component.resultsMode.set(true);
    component.allModels.set(models as any);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const blocks = host.querySelectorAll('[data-testid="svc-skills"]');
    expect(blocks.length).toBe(1);
    expect(Array.from(blocks[0].querySelectorAll('button.svc-skill')).map(b => b.textContent?.trim())).toEqual(['Figma', 'Photoshop', 'Illustrator']);
    expect(blocks[0].querySelector('.svc-skill-more')?.textContent?.trim()).toBe('+1');
  });

  it('clicking a skill chip filters by that exact catalog name (?skill=)', () => {
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.filterBySkill('Photoshop');
    expect(nav).toHaveBeenCalledWith(['/marketplace'], { queryParams: { skill: 'Photoshop', page: null }, queryParamsHandling: 'merge' });
  });

  it('the listing request carries skill=<exact name>, and the active filter chip names it', () => {
    component.selectedSkill.set('Figma');
    component.loadModels();
    expect(svc.getPublishedModels.mock.calls.at(-1)[0].skill).toBe('Figma');
    expect(component.activeFilters().some(f => f.key === 'skill' && f.label.includes('Figma'))).toBe(true);
  });
});
