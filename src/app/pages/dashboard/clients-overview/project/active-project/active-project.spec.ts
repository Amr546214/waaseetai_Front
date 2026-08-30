import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActiveProject } from './active-project';

describe('ActiveProject', () => {
  let component: ActiveProject;
  let fixture: ComponentFixture<ActiveProject>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActiveProject]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActiveProject);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
