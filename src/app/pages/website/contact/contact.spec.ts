import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { PlatformInfoService } from '../../../core/services/platform-info.service';
import { Contact } from './contact';

describe('Contact', () => {
  let component: Contact;
  let fixture: ComponentFixture<Contact>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Contact],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Contact);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('support phone: the WhatsApp card shows the built-in number while the setting is empty, and the saved number (text and link) once published', () => {
    const el = fixture.nativeElement as HTMLElement; const link = () => el.querySelector('[data-testid="support-phone"]') as HTMLAnchorElement;
    fixture.detectChanges(); expect(link().textContent?.trim()).toBe('+966 55 256 0392'); expect(link().getAttribute('href')).toBe('https://wa.me/966552560392');
    const http = TestBed.inject(HttpTestingController); TestBed.inject(PlatformInfoService).load();
    http.expectOne(`${environment.url_api}/public/settings`).flush({ success: true, data: { supportPhone: '+971 50 123 4567' } });
    fixture.detectChanges(); expect(link().textContent?.trim()).toBe('+971 50 123 4567'); expect(link().getAttribute('href')).toBe('https://wa.me/971501234567');
  });
});
