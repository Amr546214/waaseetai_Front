import { Component, DOCUMENT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { TourService } from '../../../../../core/tour/tour.service';
import { VISITOR_TOUR } from '../../../../../core/tour/tours/visitor.tour';

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

  /**
   * «شاهد كيف يعمل»: a visitor (no account) gets the guided tour narrated by Bebo; a signed-in user keeps the scroll to the section for now (their role tour comes with the dashboard tours).
   * The link keeps its href, so without JavaScript it still goes to the section.
   */
  watchHowItWorks(event: Event): void {
    if (this.authStore.isAuthenticated()) { this.scrollToHowItWorks(event); return; }
    event.preventDefault();
    this.tour.start(VISITOR_TOUR);
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
