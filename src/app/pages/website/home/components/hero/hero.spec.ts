import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { Hero } from './hero';
import { TourService } from '../../../../../core/tour/tour.service';
import { AuthStore } from '../../../../../core/store/auth.store';

describe('Hero', () => {
  let component: Hero;
  let fixture: ComponentFixture<Hero>;

  beforeEach(async () => {
    // The test runner has no global localStorage and Hero injects the real AuthStore (same gap as marketplace.spec.ts).
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    await TestBed.configureTestingModule({
      imports: [Hero],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Hero);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('"شاهد كيف يعمل" button', () => {
    afterEach(() => document.getElementById('how-it-works')?.remove());

    it('links to the real section id (not the dead #how)', () => {
      const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a.btn-secondary');
      expect(link.getAttribute('href')).toBe('/#how-it-works');
    });

    it('smooth-scrolls to the #how-it-works section and does not follow the link', () => {
      const target = document.createElement('section');
      target.id = 'how-it-works';
      document.body.appendChild(target);
      const scrollIntoView = vi.fn();
      target.scrollIntoView = scrollIntoView;
      const event = new Event('click', { cancelable: true });
      component.scrollToHowItWorks(event);
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      expect(event.defaultPrevented).toBe(true);
    });

    it('falls back to the normal link when the section is not on the page', () => {
      const event = new Event('click', { cancelable: true });
      component.scrollToHowItWorks(event);
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('«شاهد كيف يعمل» starts the guided tour for a visitor', () => {
    afterEach(() => document.getElementById('how-it-works')?.remove());
    it('a visitor (no account) gets the tour and the link is not followed', () => {
      const start = vi.spyOn(TestBed.inject(TourService), 'start').mockImplementation(() => {});
      vi.spyOn(TestBed.inject(AuthStore), 'isAuthenticated').mockReturnValue(false);
      const event = new Event('click', { cancelable: true });
      component.watchHowItWorks(event);
      expect(start).toHaveBeenCalledTimes(1); expect((start.mock.calls[0][0] as any).id).toBe('visitor-v1'); expect(event.defaultPrevented).toBe(true);
    });
    it('a signed-in user keeps the scroll to the section (their role tour comes with the dashboard tours)', () => {
      const start = vi.spyOn(TestBed.inject(TourService), 'start').mockImplementation(() => {});
      vi.spyOn(TestBed.inject(AuthStore), 'isAuthenticated').mockReturnValue(true);
      const target = document.createElement('section'); target.id = 'how-it-works'; target.scrollIntoView = vi.fn(); document.body.appendChild(target);
      component.watchHowItWorks(new Event('click', { cancelable: true }));
      expect(start).not.toHaveBeenCalled(); expect(target.scrollIntoView).toHaveBeenCalled();
    });
  });
});
