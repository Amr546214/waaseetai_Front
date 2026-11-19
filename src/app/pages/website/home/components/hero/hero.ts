import { Component, DOCUMENT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { TourService } from '../../../../../core/tour/tour.service';
import { TourCatalogService } from '../../../../../core/tour/tour-catalog.service';

@Component({
  selector: 'app-hero',
  imports: [RouterLink],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero {
  readonly authStore = inject(AuthStore);
  private readonly doc = inject(DOCUMENT);
  private readonly tour = inject(TourService);
  private readonly catalog = inject(TourCatalogService);

  /**
   * «شاهد كيف يعمل»: runs the guided tour narrated by Bebo: the introduction for a visitor, the dashboard tour of their role for a signed-in user.
   * A signed-in role that has no tour yet keeps the old behaviour (scroll to the section). The link keeps its href, so without JavaScript it still goes to the section.
   */
  watchHowItWorks(event: Event): void {
    const tour = this.catalog.mainTour();
    if (!tour) { this.scrollToHowItWorks(event); return; }
    event.preventDefault();
    this.tour.start(tour);
  }

  /**
   * Smooth-scrolls to the "كيف يعمل وسيط AI" section (id="how-it-works"; its scroll-margin-top keeps the
   * title below the fixed header) and puts the matching hash in the URL. If the section is not on the
   * page the default link navigation runs, and the router's anchor scrolling takes over.
   */
  scrollToHowItWorks(event: Event): void {
    const target = this.doc.getElementById('how-it-works');
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.doc.defaultView?.history.replaceState(null, '', '/#how-it-works');
  }
}
