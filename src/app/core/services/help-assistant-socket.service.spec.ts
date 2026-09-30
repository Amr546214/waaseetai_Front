import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';

// Transport for the shared Help assistant. socket.io-client is mocked at
// the module boundary; handlers registered with `.on()` are captured so the
// backend gateway's events can be simulated. No network.

const handlers: Record<string, (...args: any[]) => any> = {};
const fakeSocket = {
	on: vi.fn((event: string, cb: (...args: any[]) => any) => { handlers[event] = cb; }),
	emit: vi.fn(),
	disconnect: vi.fn(),
	removeAllListeners: vi.fn(),
};
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
vi.mock('socket.io-client', () => ({ default: (...args: any[]) => ioSpy(...args), io: (...args: any[]) => ioSpy(...args) }));

import { HELP_SOCKET_IO, HelpAssistantSocketService, HelpStreamEvent } from './help-assistant-socket.service';
import { AuthStore } from '../store/auth.store';

describe('HelpAssistantSocketService (authenticated help transport)', () => {
	const token = signal<string | null>('jwt-A');
	let service: HelpAssistantSocketService;
	let events: HelpStreamEvent[];

	beforeEach(() => {
		ioSpy.mockClear();
		fakeSocket.emit.mockClear();
		fakeSocket.disconnect.mockClear();
		for (const k of Object.keys(handlers)) delete handlers[k];
		token.set('jwt-A');
		TestBed.configureTestingModule({ providers: [{ provide: AuthStore, useValue: { token } }, { provide: HELP_SOCKET_IO, useValue: ioSpy }] });
		service = TestBed.inject(HelpAssistantSocketService);
		events = [];
		service.events$.subscribe((e) => events.push(e));
	});

	it('without a session token it opens NO socket (no guest path) and reports AUTH_REQUIRED', () => {
		token.set(null);
		const id = service.ask('سؤال');
		expect(id).toBeNull();
		expect(ioSpy).not.toHaveBeenCalled();
		expect(events[0]).toMatchObject({ type: 'error', code: 'AUTH_REQUIRED' });
	});

	it('authenticates the socket handshake with the app JWT and emits help:ask with a correlation id', () => {
		const id = service.ask('كيف يعمل الضمان؟', [{ question: 'q', answer: 'a' }]);
		expect(ioSpy).toHaveBeenCalledTimes(1);
		expect(ioSpy.mock.calls[0][1]).toMatchObject({ auth: { token: 'jwt-A' } });
		expect(fakeSocket.emit).toHaveBeenCalledWith('help:ask', {
			question: 'كيف يعمل الضمان؟',
			history: [{ question: 'q', answer: 'a' }],
			clientRequestId: id,
		});
	});

	it('maps backend events to tagged stream events for every consumer', () => {
		const id = service.ask('سؤال')!;
		handlers['help:answer_start']({ clientRequestId: id });
		handlers['help:answer_chunk']({ clientRequestId: id, chunk: 'أ' });
		handlers['help:answer_chunk']({ clientRequestId: id, chunk: 42 }); // malformed → dropped
		handlers['help:answer_complete']({ clientRequestId: id });
		handlers['help:error']({ clientRequestId: id, code: 'NO_ANSWER', message: 'm', humanSupportFallback: true });
		expect(events.map((e) => e.type)).toEqual(['start', 'chunk', 'complete', 'error']);
		// The legacy socket voice path is gone: nothing listens for help:audio*.
		expect(handlers['help:audio']).toBeUndefined();
		expect(handlers['help:audio_unavailable']).toBeUndefined();
		expect(events.every((e) => !('clientRequestId' in e) || e.clientRequestId === id)).toBe(true);
	});

	it('reuses one socket per token and reconnects with the new token after a login change', () => {
		service.ask('1');
		service.ask('2');
		expect(ioSpy).toHaveBeenCalledTimes(1);
		token.set('jwt-B');
		service.ask('3');
		expect(fakeSocket.disconnect).toHaveBeenCalled();
		expect(ioSpy).toHaveBeenCalledTimes(2);
		expect(ioSpy.mock.calls[1][1]).toMatchObject({ auth: { token: 'jwt-B' } });
	});

	it('cancel() emits help:cancel for the request; transport loss is surfaced', () => {
		const id = service.ask('سؤال');
		service.cancel(id);
		expect(fakeSocket.emit).toHaveBeenCalledWith('help:cancel', { clientRequestId: id });
		handlers['disconnect']();
		expect(events.at(-1)).toEqual({ type: 'connection_lost' });
	});
});

describe('HelpAssistantSocketService session isolation (logout / token change)', () => {
	const token = signal<string | null>('jwt-A');
	let service: HelpAssistantSocketService;

	beforeEach(() => {
		ioSpy.mockClear();
		fakeSocket.disconnect.mockClear();
		fakeSocket.removeAllListeners.mockClear();
		token.set('jwt-A');
		TestBed.configureTestingModule({ providers: [{ provide: AuthStore, useValue: { token } }, { provide: HELP_SOCKET_IO, useValue: ioSpy }] });
		service = TestBed.inject(HelpAssistantSocketService);
		TestBed.tick();
	});

	it('closes the authenticated socket as soon as the user logs out (not only on the next question)', () => {
		service.ask('سؤال');
		token.set(null);
		TestBed.tick();
		expect(fakeSocket.removeAllListeners).toHaveBeenCalled();
		expect(fakeSocket.disconnect).toHaveBeenCalledTimes(1);
	});

	it('closes the old socket immediately when another identity signs in', () => {
		service.ask('سؤال');
		token.set('jwt-B');
		TestBed.tick();
		expect(fakeSocket.disconnect).toHaveBeenCalledTimes(1);
		service.ask('سؤال ب');
		expect(ioSpy).toHaveBeenCalledTimes(2);
		expect(ioSpy.mock.calls[1][1]).toMatchObject({ auth: { token: 'jwt-B' } });
	});

	it('an unchanged token keeps the connection', () => {
		service.ask('سؤال');
		token.set('jwt-A');
		TestBed.tick();
		expect(fakeSocket.disconnect).not.toHaveBeenCalled();
	});
});
