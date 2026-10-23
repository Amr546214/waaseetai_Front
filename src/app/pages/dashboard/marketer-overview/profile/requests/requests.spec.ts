import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { Requests } from './requests';
import { MarketerProfileService } from '../../../../../core/services/marketer-profile.service';

describe('Requests', () => {
  let component: Requests;
  let fixture: ComponentFixture<Requests>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Requests],
      // the component reads its list on creation; without this double the spec called the REAL dev API and `whenStable()` waited for that network call
      providers: [{ provide: MarketerProfileService, useValue: { getRequests: () => of({ success: true, data: { totalRequests: 0, pendingAiCount: 0, pendingHumanCount: 0, approvedCount: 0, rejectedCount: 0, items: [] } }) } }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Requests);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.loadError()).toBe(false);
    expect(component.summary()?.items).toEqual([]);
  });
});
