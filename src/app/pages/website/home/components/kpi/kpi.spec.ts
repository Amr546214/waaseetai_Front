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
});
