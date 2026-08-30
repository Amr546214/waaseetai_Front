import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApplayRequest } from './applay-request';

describe('ApplayRequest', () => {
  let component: ApplayRequest;
  let fixture: ComponentFixture<ApplayRequest>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApplayRequest]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApplayRequest);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
