import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { AccreditationDetails } from './accreditation-details';

describe('AccreditationDetails', () => {
  let component: AccreditationDetails;
  let fixture: ComponentFixture<AccreditationDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
		imports: [AccreditationDetails],
		providers: [provideHttpClient(), provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccreditationDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
