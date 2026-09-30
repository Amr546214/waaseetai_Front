import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

import { Help } from './help';
import { AssistantStore } from '../../../../core/store/assistant.store';
import { HelpAssistantSocketService } from '../../../../core/services/help-assistant-socket.service';
import { MarketerOverviewService } from '../../../../core/services/marketer-overview.service';

describe('Help', () => {
  let component: Help;
  let fixture: ComponentFixture<Help>;
  const socket = { events$: new Subject<any>().asObservable(), ask: vi.fn(() => 'm-1'), cancel: vi.fn() };

  beforeEach(async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
    await TestBed.configureTestingModule({
      imports: [Help],
      // The help search now uses the shared real assistant; its transport is faked here.
      providers: [
        provideRouter([]),
        { provide: HelpAssistantSocketService, useValue: socket },
        // No real HTTP from a unit test.
        { provide: MarketerOverviewService, useValue: { getSummary: () => of({ success: false, data: null }) } },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Help);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('askAI() sends the question to the shared real assistant (no keyword/setTimeout fake)', () => {
    component.searchQuery.set('كيف تُحتسب العمولة؟');
    component.askAI();
    const store = TestBed.inject(AssistantStore);
    expect(store.panelOpen()).toBe(true);
    expect(socket.ask).toHaveBeenCalledWith('كيف تُحتسب العمولة؟', []);
  });
});
