import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { MyRequest } from './my-request';
import { ProjectApiService } from '../../../../core/services/project-api.service';

describe('MyRequest', () => {
  let component: MyRequest;
  let fixture: ComponentFixture<MyRequest>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyRequest],
      providers: [provideRouter([]), { provide: ProjectApiService, useValue: { getMyRequests: () => of({ success: true, filters: {}, data: [] }) } }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyRequest);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
