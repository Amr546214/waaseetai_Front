import { vi } from 'vitest';
import { AssistantLiveSession, livePcm16, LiveCallbacks } from './assistant-live-session';

class FakeProcessor { onaudioprocess: any = null; connect = vi.fn(); disconnect = vi.fn(); }
class FakeSocket {
	static instances: FakeSocket[] = [];
	readyState = 1; bufferedAmount = 0;
	onopen: any = null; onmessage: any = null; onerror: any = null; onclose: any = null;
	send = vi.fn(); close = vi.fn();
	constructor(readonly url: string) { FakeSocket.instances.push(this); }
	message(data: any) { this.onmessage?.({ data: JSON.stringify(data) }); }
}
class FakeContext {
	static last: FakeContext;
	sampleRate = 48000; currentTime = 0; destination = {};
	processor = new FakeProcessor();
	resume = vi.fn(async () => {}); close = vi.fn(async () => {});
	createMediaStreamSource = vi.fn(() => ({connect: vi.fn(), disconnect:vi.fn()}));
	createScriptProcessor = vi.fn(() => this.processor);
	createGain = vi.fn(() => ({gain:{value:1},connect:vi.fn(),disconnect:vi.fn()}));
	constructor() { FakeContext.last = this; }
}
const token = { token:'ephemeral',model:'gemini-3.8-live',voice:'Puck',wsUrl:'wss://generativelanguage.googleapis.com/ws/live?access_token=ephemeral',sessionConfig:{setup:{model:'models/gemini-3.8-live'}} };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe('Live voice protocol and resource lifecycle', () => {
	let callbacks: LiveCallbacks, session: AssistantLiveSession;
	const track = { stop:vi.fn() };
	beforeEach(() => {
		FakeSocket.instances=[]; track.stop.mockClear();
		vi.stubGlobal('AudioContext',FakeContext); vi.stubGlobal('ScriptProcessorNode',FakeProcessor); vi.stubGlobal('WebSocket',FakeSocket);
		Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn(async () => ({getTracks:() => [track]}))}});
		callbacks={state:vi.fn(),transcript:vi.fn(),level:vi.fn(),error:vi.fn()}; session=new AssistantLiveSession(callbacks);
	});
	afterEach(() => { session.stop(); vi.unstubAllGlobals(); });
	it('converts clamped samples to little-endian mono PCM16 and downsamples 48 kHz', () => {
		const bytes=livePcm16(new Float32Array([-2,0,2]),16000), view=new DataView(bytes.buffer);
		expect([view.getInt16(0,true),view.getInt16(2,true),view.getInt16(4,true)]).toEqual([-32768,0,32767]);
		expect(livePcm16(new Float32Array(4800),48000)).toHaveLength(3200);
	});
	it('rejects a supplied socket outside the official encrypted endpoint before opening a microphone', async () => {
		await session.start({...token,wsUrl:'wss://evil.example/?access_token=ephemeral'});
		expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
		expect(FakeSocket.instances).toHaveLength(0); expect(callbacks.error).toHaveBeenCalled();
	});
	it('sends setup once, starts capture only after acknowledgement, and fully releases resources on stop', async () => {
		await session.start(token); const socket=FakeSocket.instances[0]; socket.onopen();
		expect(JSON.parse(socket.send.mock.calls[0][0])).toMatchObject({setup:{model:'models/gemini-3.8-live'}});
		expect(FakeContext.last.createMediaStreamSource).not.toHaveBeenCalled();
		socket.message({setupComplete:{}}); await flush();
		FakeContext.last.processor.onaudioprocess({inputBuffer:{getChannelData:() => new Float32Array(2048)}});
		expect(JSON.parse(socket.send.mock.calls[1][0]).realtimeInput.audio.mimeType).toBe('audio/pcm;rate=16000');
		socket.message({serverContent:{inputTranscription:{text:'سؤالي'},outputTranscription:{text:'ردي'},turnComplete:true}}); await flush();
		expect(callbacks.transcript).toHaveBeenCalledWith('assistant','ردي',true);
		session.stop(); expect(track.stop).toHaveBeenCalledTimes(1); expect(socket.close).toHaveBeenCalledWith(1000); expect(FakeContext.last.close).toHaveBeenCalled(); expect(socket.onmessage).toBeNull();
	});
	it('stopping during the permission prompt prevents a later granted microphone from leaking', async () => {
		let resolve!: (stream:any) => void;
		vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(new Promise(done => resolve=done));
		const starting=session.start(token); await flush(); session.stop(); resolve({getTracks:() => [track]}); await starting;
		expect(track.stop).toHaveBeenCalledTimes(1); expect(FakeSocket.instances).toHaveLength(0);
	});
});
