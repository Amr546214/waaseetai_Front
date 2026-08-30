import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarketplacePreview } from './marketplace-preview';

describe('MarketplacePreview', () => {
  let component: MarketplacePreview;
  let fixture: ComponentFixture<MarketplacePreview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketplacePreview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarketplacePreview);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
