import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AddAccount } from './add-account';

describe('AddAccount', () => {
  let component: AddAccount;
  let fixture: ComponentFixture<AddAccount>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddAccount],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AuthStore, useValue: { currentUser: () => null } }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddAccount);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
