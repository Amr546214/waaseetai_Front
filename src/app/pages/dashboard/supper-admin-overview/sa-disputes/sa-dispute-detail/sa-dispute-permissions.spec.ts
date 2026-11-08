import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaDisputeDetail } from './sa-dispute-detail';
import { DisputeApiService } from '../../../../../core/services/dispute-api.service';
import { AdminAccessService } from '../../../../../core/services/admin-access.service';
import { AdminOpsApiService } from '../../../../../core/services/admin-ops-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { ADMIN_ROUTE_ACCESS } from '../../../../../core/config/admin-access-rules';

// Server keys: view = disputes.view; resolve / reject / review status = disputes.resolve; assign / escalate = disputes.assign; notes = disputes.note; financial = disputes.resolve + payouts.send.
const dispute: any = { id: 'd1', requestId: 'r1', projectId: null, status: 'OPEN', reason: 'سبب', description: 'وصف', evidence: [], createdAt: '2026-01-01T10:00:00.000Z', resolvedAt: null,
	openedBy: { id: 'u1', firstName: 'علي', lastName: 'أحمد' }, againstUser: { id: 'u2', firstName: 'نور', lastName: 'سعد' }, request: { id: 'r1', title: 't' }, assignedTo: null, notes: [], timeline: [] };

function setup(perms: string[]) {
	const ok = () => of({ success: true, data: dispute });
	const api = { getAdminDispute: vi.fn(ok), assignAdminDispute: vi.fn(ok), addAdminDisputeNote: vi.fn(ok), setAdminDisputeStatus: vi.fn(ok), resolveAdminDispute: vi.fn(ok) };
	TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
		{ provide: DisputeApiService, useValue: api }, { provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'ADMIN' }) } },
		{ provide: AdminAccessService, useValue: { can: (p: string) => perms.includes(p) } },
		{ provide: AdminOpsApiService, useValue: { listStaff: () => of({ success: true, data: [] }) } },
		{ provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap({ id: 'd1' })), snapshot: { paramMap: convertToParamMap({ id: 'd1' }) } } }] });
	const f = TestBed.createComponent(SaDisputeDetail); f.detectChanges();
	return { c: f.componentInstance as any, el: f.nativeElement as HTMLElement };
}
afterEach(() => TestBed.resetTestingModule());
const has = (el: HTMLElement, sel: string) => el.querySelector(sel) !== null;

describe('dispute page: execute controls follow the server permissions', () => {
	it('disputes.view only (VIEW): no assign, review status, note input, resolve / reject / financial buttons', () => {
		const { el, c } = setup(['disputes.view']);
		expect(el.textContent).toContain('سبب');
		expect(has(el, '#dp-assignee')).toBe(false);
		expect(has(el, '#dp-note')).toBe(false);
		expect(has(el, '[data-testid="open-text-resolve"]')).toBe(false);
		expect(has(el, '[data-testid="open-financial"]')).toBe(false);
		expect(has(el, '[data-testid="decision-kinds"]')).toBe(false);
		expect(el.textContent).not.toContain('بدء المراجعة');
		expect(c.canEscalate()).toBe(false);
	});
	it('disputes.resolve only: the decision buttons and the review status appear, assignment and notes do not', () => {
		const { el } = setup(['disputes.view', 'disputes.resolve']);
		expect(has(el, '[data-testid="open-text-resolve"]')).toBe(true);
		expect(el.textContent).toContain('بدء المراجعة');
		expect(has(el, '#dp-assignee')).toBe(false);
		expect(has(el, '#dp-note')).toBe(false);
	});
	it('disputes.assign + disputes.note only: assignment, escalation and notes appear, no decision', () => {
		const { el, c } = setup(['disputes.view', 'disputes.assign', 'disputes.note']);
		expect(has(el, '#dp-assignee')).toBe(true);
		expect(has(el, '#dp-note')).toBe(true);
		expect(c.canEscalate()).toBe(true);
		expect(has(el, '[data-testid="open-text-resolve"]')).toBe(false);
		expect(el.textContent).not.toContain('بدء المراجعة');
	});
	it('the route rule of the page is disputes.view', () => { expect(ADMIN_ROUTE_ACCESS['disputes']).toEqual({ all: ['disputes.view'] }); });
});
