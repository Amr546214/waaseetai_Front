import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RestPassword } from './rest-password';

describe('RestPassword', () => {
  let component: RestPassword;
  let fixture: ComponentFixture<RestPassword>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RestPassword]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RestPassword);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
