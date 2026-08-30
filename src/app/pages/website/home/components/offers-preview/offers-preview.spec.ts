import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OffersPreview } from './offers-preview';

describe('OffersPreview', () => {
  let component: OffersPreview;
  let fixture: ComponentFixture<OffersPreview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OffersPreview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OffersPreview);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
