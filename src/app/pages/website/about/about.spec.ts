import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { About } from './about';

describe('About', () => {
  let component: About;
  let fixture: ComponentFixture<About>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [About]
    })
    .compileComponents();

    fixture = TestBed.createComponent(About);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('About template', () => {
  it('has no small "من نحن" chip above the title, and keeps the main heading (static template check)', () => {
    const html = readFileSync(join(__dirname, 'about.html'), 'utf8');
    expect(html.slice(html.indexOf('about-hero'), html.indexOf('</section>', html.indexOf('about-hero')))).not.toContain('hero-label');
    expect(html.slice(html.indexOf('about-hero'), html.indexOf('<h1>'))).not.toContain('من نحن');
    expect(html).toContain('<h1>نبني مستقبل<br><span>الخدمات المهنية</span> بالذكاء</h1>');
  });
});
