import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideRouter } from '@angular/router';

import { Footer } from './footer';

describe('Footer', () => {
  let component: Footer;
  let fixture: ComponentFixture<Footer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Footer],
      providers: [provideRouter([])]
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
});
