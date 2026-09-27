import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

// Batch 3D-2 — assessment_error frontend handling. The backend emits a real
// `assessment_error` event for primary-flow auth/rate-limit/ownership/
// generation/submission failures; before this batch nothing on the frontend
// ever listened for it. socket.io-client is mocked at the module boundary
// (same pattern as ai-assistant.spec.ts / create-request.spec.ts).

const handlers: Record<string, (...args: any[]) => any> = {};
const fakeSocket = {
	connected: false,
	on: vi.fn((event: string, cb: (...args: any[]) => any) => { handlers[event] = cb; }),
	once: vi.fn((event: string, cb: (...args: any[]) => any) => { handlers[event] = cb; }),
	off: vi.fn(),
	emit: vi.fn(),
	disconnect: vi.fn(),
};
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
vi.mock('socket.io-client', () => ({ default: (...args: any[]) => ioSpy(...args), io: (...args: any[]) => ioSpy(...args) }));

import { AntiCheatService } from './anti-cheat.service';

describe('AntiCheatService — assessment_error (Batch 3D-2)', () => {
	let service: AntiCheatService;

	beforeEach(() => {
		ioSpy.mockClear();
		fakeSocket.on.mockClear();
		fakeSocket.disconnect.mockClear();
		fakeSocket.connected = false;
		for (const key of Object.keys(handlers)) delete handlers[key];

		vi.stubGlobal('localStorage', {
			getItem: () => null,
			setItem: () => {},
			clear: () => {},
		});

		TestBed.configureTestingModule({});
		service = TestBed.inject(AntiCheatService);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('registers a real assessment_error listener when the socket initializes', () => {
		service.startAssessmentStream({ providerSpecialtyId: 'spec-1' });
		expect(fakeSocket.on.mock.calls.some((c) => c[0] === 'assessment_error')).toBe(true);
	});

	it('forwards a real backend assessment_error payload to assessmentError$ with its message intact', () => {
		service.startAssessmentStream({ providerSpecialtyId: 'spec-1' });
		const received: any[] = [];
		service.assessmentError$.subscribe((e) => received.push(e));

		handlers['assessment_error']({ message: 'حدث خطأ أثناء بث أسئلة التقييم الفني عبر الذكاء الاصطناعي.' });

		expect(received.length).toBe(1);
		expect(received[0].message).toBe('حدث خطأ أثناء بث أسئلة التقييم الفني عبر الذكاء الاصطناعي.');
	});

	it('normalizes a missing/malformed message to a safe generic string instead of leaking raw payload shape', () => {
		service.startAssessmentStream({ providerSpecialtyId: 'spec-1' });
		const received: any[] = [];
		service.assessmentError$.subscribe((e) => received.push(e));

		handlers['assessment_error']({});

		expect(received.length).toBe(1);
		expect(typeof received[0].message).toBe('string');
		expect(received[0].message.length).toBeGreaterThan(0);
	});

	it('does not register a duplicate assessment_error listener on a second call while already connected', () => {
		fakeSocket.connected = true;
		service.startAssessmentStream({ providerSpecialtyId: 'spec-1' });
		const firstCount = fakeSocket.on.mock.calls.filter((c) => c[0] === 'assessment_error').length;

		service.startAssessmentStream({ providerSpecialtyId: 'spec-1' });
		const secondCount = fakeSocket.on.mock.calls.filter((c) => c[0] === 'assessment_error').length;

		expect(firstCount).toBe(1);
		expect(secondCount).toBe(1);
	});

	it('tears down the listener (via socket disconnect) when monitoring stops', () => {
		service.startMonitoring('session-1', 'spec-1');
		expect(fakeSocket.on.mock.calls.some((c) => c[0] === 'assessment_error')).toBe(true);

		service.stopMonitoring();

		expect(fakeSocket.disconnect).toHaveBeenCalled();
	});
});
