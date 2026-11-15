import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

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
  it('keeps the current payment stages when AI percentages do not total 100', () => {
    component.reqId.set('fixture-project');
    component.proposal.update(p => ({ ...p, title: 'عنوان العرض', message: 'تفاصيل العرض' }));
    const before = component.proposal().milestones;
    component.useAISuggest();
    TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/proposals/ai-suggest')).flush({
      data: {
        suggestedMilestones: [
          { name: 'تحليل', days: 1, pct: 10 },
          { name: 'تنفيذ', days: 1, pct: 90 },
          { name: 'تسليم', days: 1, pct: 90 }
        ]
      }
    });
    expect(component.proposal().milestones).toEqual(before);
    expect(component.isFetchingAiSuggest()).toBe(false);
  });

});
