import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Commissions } from './commissions';

describe('Commissions', () => {
  let component: Commissions;
  let fixture: ComponentFixture<Commissions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Commissions]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Commissions);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
