import { ComponentFixture, TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';

import { AiFeatures } from './ai-features';

describe('AiFeatures', () => {
  let component: AiFeatures;
  let fixture: ComponentFixture<AiFeatures>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiFeatures]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AiFeatures);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('allows .ai-badge to wrap cleanly inside .ai-persona without horizontal text overflow', () => {
    const homeCss = readFileSync('src/app/pages/website/home/home-design.css', 'utf8');
    const featCss = readFileSync('src/app/pages/website/home/components/ai-features/ai-features.css', 'utf8');
    const badgeRules = (homeCss.match(/app-home\s+\.ai-badge\{[^}]+\}/g) || []).join('\n');
    expect(badgeRules).toContain('white-space:normal');
    expect(badgeRules).not.toContain('white-space:nowrap');
    expect(badgeRules).toContain('max-width:100%');
    expect(badgeRules).toContain('box-sizing:border-box');
    expect(featCss).toContain('white-space: normal');
  });
});
