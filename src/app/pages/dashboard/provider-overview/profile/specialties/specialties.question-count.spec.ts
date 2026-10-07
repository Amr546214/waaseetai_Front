import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fakeSocket = { connected: false, on: vi.fn(), once: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
vi.mock('socket.io-client', () => ({ default: () => fakeSocket, io: () => fakeSocket }));

import { Specialties } from './specialties';

// #20 — the number of questions is whatever the backend says (assessment_ready / each streamed question), never a fixed 20 or 10.
describe('specialty assessment — question count comes from the backend (#20)', () => {
	let fixture: any;
	function make() {
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, clear: () => {} });
		TestBed.configureTestingModule({ imports: [Specialties], providers: [{ provide: HttpClient, useValue: { get: () => of({ success: false }), post: () => of({ success: true }) } }] });
		fixture = TestBed.createComponent(Specialties);
		fixture.detectChanges();
		return fixture.componentInstance;
	}
	afterEach(() => { fixture?.destroy(); vi.unstubAllGlobals(); TestBed.resetTestingModule(); });

	it('unknown until the backend reports it; then the reported total drives the counter and the percentage', () => {
		const c = make();
		expect(c.expectedQuestions()).toBeNull();
		expect(c.streamProgressPercent()).toBe(0);
		c.antiCheatService.assessmentReady$.next({ attemptId: 'a1', totalQuestions: 15, timeLimitMinutes: 15 });
		expect(c.expectedQuestions()).toBe(15);
		c.streamProgressCount.set(6);
		expect(c.streamProgressPercent()).toBe(40);
	});

	it('a streamed question carries the total too (even before the quiz view is active)', () => {
		const c = make();
		c.antiCheatService.questionStreamed$.next({ sessionId: 's', question: { id: 'q1', subSpecialtyTag: 't', text: 'x', options: ['a', 'b'] }, index: 0, total: 12, isLast: false } as any);
		expect(c.expectedQuestions()).toBe(12);

	});

	it('the template has no fixed "/ 20"', () => {
		const html = readFileSync(join(process.cwd(), 'src/app/pages/dashboard/provider-overview/profile/specialties/specialties.html'), 'utf8');
		expect(html).not.toContain('streamProgressCount() }} / 20');
		expect(html).not.toContain('streamProgressCount() / 20');
		expect(html).toContain('expectedQuestions()');
	});
});
