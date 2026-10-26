import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { PlatformInfoService } from '../../core/services/platform-info.service';

import { Footer } from './footer';

describe('Footer', () => {
  let component: Footer;
  let fixture: ComponentFixture<Footer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Footer],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Footer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('bottom bar only holds the centered copyright (no PDPL/SAMA badges or legal links)', () => {
    const bar: HTMLElement = fixture.nativeElement.querySelector('.footer-bottom');
    expect(bar.querySelector('.footer-copy')?.textContent).toContain('جميع الحقوق محفوظة');
    expect(bar.querySelectorAll('.footer-badge, a').length).toBe(0);
  });

  it('support phone: the WhatsApp link is the built-in number while the setting is empty, and the saved number once published', () => {
    const a = () => fixture.nativeElement.querySelector('a[aria-label="واتساب"]') as HTMLAnchorElement;
    fixture.detectChanges(); expect(a().getAttribute('href')).toBe('https://wa.me/966552560392');
    const http = TestBed.inject(HttpTestingController); TestBed.inject(PlatformInfoService).load();
    http.expectOne(`${environment.url_api}/public/settings`).flush({ success: true, data: { supportPhone: '+971 50 123 4567' } });
    fixture.detectChanges(); expect(a().getAttribute('href')).toBe('https://wa.me/971501234567');
  });
});
