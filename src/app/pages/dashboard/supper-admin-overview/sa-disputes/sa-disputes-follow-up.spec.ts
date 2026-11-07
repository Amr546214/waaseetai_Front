import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { DisputeApiService } from '../../../../core/services/dispute-api.service';
import { SaDisputes } from './sa-disputes';

describe('admin dispute follow-up queue', () => {
  it('opens the deep link on the server filter and keeps the follow-up count separate', () => {
    const api = { getAdminDisputes: vi.fn(() => of({
      success: true, data: { items: [], followUpCount: 1, counts: { OPEN: 3, RESOLVED: 2 } },
    })) };
    TestBed.configureTestingModule({
      imports: [SaDisputes],
      providers: [provideRouter([]), { provide: DisputeApiService, useValue: api }, {
        provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ followUp: 'true' }) } },
      }],
    });
    const fixture = TestBed.createComponent(SaDisputes);
    fixture.detectChanges();
    expect(api.getAdminDisputes).toHaveBeenLastCalledWith({ followUp: true, status: undefined, page: 1, limit: 10 });
    expect(fixture.componentInstance.countFor('all')).toBe(5);
    expect(fixture.componentInstance.countFor('followUp')).toBe(1);
    fixture.componentInstance.setFilter('OPEN');
    expect(api.getAdminDisputes).toHaveBeenLastCalledWith({ status: 'OPEN', page: 1, limit: 10 });
  });
});
