import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProviderOverview } from './provider-overview';

describe('ProviderOverview', () => {
  let component: ProviderOverview;
  let fixture: ComponentFixture<ProviderOverview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProviderOverview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProviderOverview);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
