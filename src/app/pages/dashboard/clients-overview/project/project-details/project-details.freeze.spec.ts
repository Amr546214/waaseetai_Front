import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { readFileSync } from 'node:fs';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ProjectDetails } from './project-details';

vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });

// Dispute freeze on the client's project page: approve / release actions are disabled with the reason (not removed);
// the project details, the chat and the dispute link stay available; a revision request is not an approval.
const REASON = 'اعتماد المراحل وصرف الأموال موقوفان بسبب نزاع مفتوح على هذا المشروع إلى أن تحسمه الإدارة.';
const html = readFileSync('src/app/pages/dashboard/clients-overview/project/project-details/project-details.html', 'utf8');

describe('ProjectDetails - dispute freeze', () => {
  let component: ProjectDetails;
  let navigate: ReturnType<typeof vi.spyOn>;
  let post: ReturnType<typeof vi.fn<(...a: any[]) => any>>;

  beforeEach(async () => {
    post = vi.fn(() => of({ success: true, data: {} }));
    await TestBed.configureTestingModule({
      imports: [ProjectDetails],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: () => of({ success: true, data: null }), post: (...a: any[]) => post(...a) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'proj-1' }) }, params: of({ id: 'proj-1' }) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProjectDetails);
    component = fixture.componentInstance;
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
  });
  afterEach(() => TestBed.resetTestingModule());

  it('freezeReason: the server reason while frozen, null otherwise or on an older backend', () => {
    expect(component.freezeReason({ disputeFreeze: { frozen: true, reason: REASON } })).toBe(REASON);
    expect(component.freezeReason({ disputeFreeze: { frozen: true } })).toMatch(/نزاع مفتوح/);
    expect(component.freezeReason({ disputeFreeze: { frozen: false, reason: null } })).toBeNull();
    expect(component.freezeReason({})).toBeNull();
    expect(component.freezeReason(null)).toBeNull();
  });

  it('openReview(approve) does not leave the page while frozen and tells the client why; a revision still navigates', () => {
    component.project.set({ disputeFreeze: { frozen: true, reason: REASON } });
    component.openReview({ id: 's1' }, 'approve');
    expect(navigate).not.toHaveBeenCalled();
    expect(component.error()).toBe(REASON);
    component.openReview({ id: 's1' }, 'revision');
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('openReview(approve) works as before when not frozen', () => {
    component.project.set({ disputeFreeze: { frozen: false, reason: null } });
    component.openReview({ id: 's1' }, 'approve');
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('the inline approval is not posted while frozen', () => {
    component.project.set({ disputeFreeze: { frozen: true, reason: REASON } });
    component.inlineReviewStage.set({ id: 's1' });
    component.reviewDecision.set('approve');
    component.submitReview();
    expect(post).not.toHaveBeenCalled();
  });

  it('template: the banner exists and BOTH approve buttons are disabled by the freeze (kept, not removed)', () => {
    expect(html).toContain('data-testid="pd-freeze-banner"');
    expect(html).toMatch(/data-testid="pd-approve"[^>]*\[disabled\]="!!freezeReason\(data\)"/);
    expect(html).toMatch(/data-testid="pd-approve-miles"[^>]*\[disabled\]="!!freezeReason\(data\)"/);
    // chat and the dispute link are never gated by the freeze
    expect(html).toMatch(/class="lc-qa-chat" \(click\)="openConversation\(data\)"/);
    expect(html).not.toMatch(/lc-qa-chat"[^>]*freezeReason/);
    expect(html).toContain('routerLink="/client-overview/disputes"');
  });
});

import { readFileSync } from 'node:fs';
describe('project details is keyed by the contract id for marketplace purchases', () => {
	it('the previous-requests list matches the amendment by project id OR contract id', () => {
		const ts = readFileSync('src/app/pages/dashboard/clients-overview/project/project-details/project-details.ts', 'utf8');
		expect(ts).toContain('a.projectId === this.projectId || a.contractId === this.projectId');
	});
});
