import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Slug } from './slug';

describe('Slug', () => {
  let component: Slug;
  let fixture: ComponentFixture<Slug>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Slug]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Slug);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
