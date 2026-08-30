import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-cookies',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cookies.component.html',
  styleUrls: ['./cookies.component.css']
})
export class CookiesComponent implements OnInit {
  functionalEnabled = true;
  analyticsEnabled = false;
  marketingEnabled = false;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.functionalEnabled = localStorage.getItem('cookie-functional') !== 'false'; // default true
      this.analyticsEnabled = localStorage.getItem('cookie-analytics') === 'true';
      this.marketingEnabled = localStorage.getItem('cookie-marketing') === 'true';
    }
  }

  toggleFunctional(event: Event) {
    const target = event.target as HTMLInputElement;
    this.functionalEnabled = target.checked;
    this.savePreferences();
  }

  toggleAnalytics(event: Event) {
    const target = event.target as HTMLInputElement;
    this.analyticsEnabled = target.checked;
    this.savePreferences();
  }

  toggleMarketing(event: Event) {
    const target = event.target as HTMLInputElement;
    this.marketingEnabled = target.checked;
    this.savePreferences();
  }

  acceptAll() {
    this.functionalEnabled = true;
    this.analyticsEnabled = true;
    this.marketingEnabled = true;
    this.savePreferences();
  }

  rejectOptional() {
    this.functionalEnabled = false;
    this.analyticsEnabled = false;
    this.marketingEnabled = false;
    this.savePreferences();
  }

  savePreferences() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('cookie-functional', String(this.functionalEnabled));
      localStorage.setItem('cookie-analytics', String(this.analyticsEnabled));
      localStorage.setItem('cookie-marketing', String(this.marketingEnabled));
      localStorage.setItem('cookie-accepted', 'true');
    }
  }

  openModal() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
