import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Kpi } from './kpi';

describe('Kpi', () => {
  let component: Kpi;
  let fixture: ComponentFixture<Kpi>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Kpi]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Kpi);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('the gradient-clipped numbers (incl. "آلي") have room above and below the glyphs: line-height > 1.2 and no overflow clipping', () => {
    const css = readFileSync(join(__dirname, '..', '..', 'home-design.css'), 'utf8');
    const rule = /app-home \.kpi-num\{([^}]*)\}/.exec(css)![1];
    expect(Number(/line-height:([\d.]+)/.exec(rule)![1])).toBeGreaterThan(1.2);
    expect(rule).toContain('padding-block');
    expect(rule).not.toMatch(/overflow:\s*hidden/);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('آلي');
  });
});
