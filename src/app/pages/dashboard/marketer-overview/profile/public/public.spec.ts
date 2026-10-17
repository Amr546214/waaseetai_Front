import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Public } from './public';

describe('Public', () => {
  let component: Public;
  let fixture: ComponentFixture<Public>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Public]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Public);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { readFileSync } from 'node:fs';
describe('public marketer profile never shows a made-up member-since year', () => {
	it('template has no hard-coded year and uses memberSince()', () => {
		const html = readFileSync('src/app/pages/dashboard/marketer-overview/profile/public/public.html', 'utf8');
		expect(html).not.toMatch(/منذ\s*20\d\d/);
		expect(html).toContain('memberSince()');
	});
});

describe('public marketer profile channel status is honest', () => {
	it('says the channel was added, never under review or verified', () => {
		const ts = readFileSync('src/app/pages/dashboard/marketer-overview/profile/public/public.ts', 'utf8');
		expect(ts).toContain("return 'قناة مضافة'");
		expect(ts).not.toMatch(/return\s+'(قيد المراجعة|موثّق|موثق)'/);
	});
});
