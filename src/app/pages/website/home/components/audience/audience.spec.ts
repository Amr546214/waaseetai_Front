import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Audience } from './audience';

describe('Audience', () => {
  let component: Audience;
  let fixture: ComponentFixture<Audience>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Audience]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Audience);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
