import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarketerMessages } from './messages';

describe('Messages', () => {
  let component: MarketerMessages;
  let fixture: ComponentFixture<MarketerMessages>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketerMessages]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarketerMessages);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
