import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AmendmentsProject } from './amendments-project';

describe('AmendmentsProject', () => {
  let component: AmendmentsProject;
  let fixture: ComponentFixture<AmendmentsProject>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AmendmentsProject]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AmendmentsProject);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
