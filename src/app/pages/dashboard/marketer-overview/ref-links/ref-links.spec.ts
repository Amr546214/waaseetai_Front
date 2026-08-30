import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RefLinks } from './ref-links';

describe('RefLinks', () => {
  let component: RefLinks;
  let fixture: ComponentFixture<RefLinks>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RefLinks]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RefLinks);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
