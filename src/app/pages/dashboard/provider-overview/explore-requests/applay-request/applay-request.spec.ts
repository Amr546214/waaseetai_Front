import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { ApplayRequest } from './applay-request';

describe('ApplayRequest', () => {
  let component: ApplayRequest;
  let fixture: ComponentFixture<ApplayRequest>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApplayRequest],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
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
