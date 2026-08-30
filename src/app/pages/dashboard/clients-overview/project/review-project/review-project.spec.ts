import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReviewProject } from './review-project';

describe('ReviewProject', () => {
  let component: ReviewProject;
  let fixture: ComponentFixture<ReviewProject>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReviewProject]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReviewProject);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
