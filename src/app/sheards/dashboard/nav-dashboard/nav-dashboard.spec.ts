import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NavDashboard } from './nav-dashboard';

describe('NavDashboard', () => {
  let component: NavDashboard;
  let fixture: ComponentFixture<NavDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NavDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
