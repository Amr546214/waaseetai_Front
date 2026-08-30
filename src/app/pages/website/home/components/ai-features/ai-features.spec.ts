import { ComponentFixture, TestBed } from '@angular/core/testing';

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
});
