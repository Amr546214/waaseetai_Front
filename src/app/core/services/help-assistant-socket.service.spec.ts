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
import { HELP_ASSISTANT_UNAVAILABLE_MESSAGE } from '../help/assistant-errors';
import { environment } from '../../../environments/environment';

describe('HelpAssistantSocketService (authenticated help transport)', () => {
	const token = signal<string | null>('jwt-A');
	const socketEnvironment = environment as typeof environment & { assistantSocketUrl?: string };
	const originalAssistantSocketUrl = socketEnvironment.assistantSocketUrl;
	let service: HelpAssistantSocketService;
	let events: HelpStreamEvent[];

	beforeEach(() => {
		delete socketEnvironment.assistantSocketUrl;
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
	afterEach(() => {
		if (originalAssistantSocketUrl === undefined) delete socketEnvironment.assistantSocketUrl;
		else socketEnvironment.assistantSocketUrl = originalAssistantSocketUrl;
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
		expect(ioSpy.mock.calls[0][0]).toBe(environment.socketUrl);
		expect(ioSpy.mock.calls[0][1]).toMatchObject({ auth: { token: 'jwt-A' } });
		expect(fakeSocket.emit).toHaveBeenCalledWith('help:ask', {
			question: 'كيف يعمل الضمان؟',
			history: [{ question: 'q', answer: 'a' }],
			clientRequestId: id,
		});
	});
	it('uses a configured assistant-only socket without changing the platform socket URL', () => {
		const platformUrl = environment.socketUrl;
		socketEnvironment.assistantSocketUrl = 'http://127.0.0.1:5011';
		service.ask('سؤال عام');
		expect(ioSpy.mock.calls[0][0]).toBe('http://127.0.0.1:5011');
		expect(environment.socketUrl).toBe(platformUrl);
		expect(ioSpy.mock.calls[0][1]).toMatchObject({ auth: { token: 'jwt-A' } });
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
	it('passes bounded Google attribution to the UI and drops oversized or non-string HTML', () => {
		const id=service.ask('بحث',[],{webSearch:true})!;
		expect(fakeSocket.emit).toHaveBeenCalledWith('help:ask',expect.objectContaining({webSearch:true}));
		handlers['help:citations']({clientRequestId:id,citations:[{docId:'web',title:'مصدر',url:'https://example.com'}],searchSuggestionsHtml:'<div>Google</div>'});
		expect(events.at(-1)).toMatchObject({type:'citations',searchSuggestionsHtml:'<div>Google</div>'});
		handlers['help:citations']({clientRequestId:id,citations:[],searchSuggestionsHtml:'x'.repeat(64001)});expect(events.at(-1)).not.toHaveProperty('searchSuggestionsHtml');
		handlers['help:citations']({clientRequestId:id,citations:[],searchSuggestionsHtml:{html:'invalid'}});expect(events.at(-1)).not.toHaveProperty('searchSuggestionsHtml');
	});
	it('normalizes the obsolete server error and removes its misleading support fallback', () => {
		const id = service.ask('عامل إيه؟')!;
		handlers['help:error']({ clientRequestId: id, code: 'NO_ANSWER', message: 'لم يجد المساعد الذكي إجابة معتمدة لهذا السؤال في قاعدة المعرفة.', humanSupportFallback: true });
		expect(events.at(-1)).toEqual({ type: 'error', clientRequestId: id, code: 'UNAVAILABLE', message: HELP_ASSISTANT_UNAVAILABLE_MESSAGE, humanSupportFallback: false });
		handlers['help:error']({ clientRequestId: id, code: 'RATE_LIMITED', message: 'انتظر دقيقة.', humanSupportFallback: false });
		expect(events.at(-1)).toMatchObject({ code: 'RATE_LIMITED', message: 'انتظر دقيقة.' });
	});
	it('turns a refusal split across answer chunks into an error rather than a completed assistant answer', () => {
		const id = service.ask('سؤال عام')!;
		handlers['help:answer_start']({ clientRequestId: id });
		handlers['help:answer_chunk']({ clientRequestId: id, chunk: 'لم يجد المساعد الذكي ' });
		handlers['help:answer_chunk']({ clientRequestId: id, chunk: 'إجابة معتمدة لهذا السؤال في قاعدة المعرفة.' });
		handlers['help:answer_chunk']({ clientRequestId: id, chunk: ' يمكنك إعادة صياغة سؤالك.' });
		handlers['help:answer_complete']({ clientRequestId: id });
		expect(events.map(event => event.type)).toEqual(['start', 'chunk', 'error']);
		expect(events.at(-1)).toMatchObject({ type: 'error', code: 'UNAVAILABLE', message: HELP_ASSISTANT_UNAVAILABLE_MESSAGE, humanSupportFallback: false });
		expect(JSON.stringify(events)).not.toContain('لم يجد المساعد الذكي إجابة معتمدة');
		const nextId = service.ask('سؤال تاني')!;
		handlers['help:answer_start']({ clientRequestId: nextId });
		handlers['help:answer_chunk']({ clientRequestId: nextId, chunk: 'أنا نديم، أقدر أساعدك.' });
		handlers['help:answer_complete']({ clientRequestId: nextId });
		expect(events.at(-1)).toEqual({ type: 'complete', clientRequestId: nextId });
	});
	it('does not rewrite or suppress a user question quoting the obsolete refusal', () => {
		const question = 'ليه بيجي "لم يجد المساعد الذكي إجابة معتمدة لهذا السؤال في قاعدة المعرفة"؟';
		service.ask(question);
		expect(fakeSocket.emit).toHaveBeenCalledWith('help:ask', expect.objectContaining({ question }));
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
