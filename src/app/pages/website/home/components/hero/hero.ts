import { Component, DOCUMENT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';

@Component({
  selector: 'app-hero',
  imports: [RouterLink],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero {
  readonly authStore = inject(AuthStore);
  private readonly doc = inject(DOCUMENT);

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
