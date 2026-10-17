import type { AssistantLiveToken } from './assistant-capabilities.service';

export interface LiveCallbacks {
	state(value: 'connecting' | 'listening' | 'speaking' | 'ended'): void;
	transcript(role: 'user' | 'assistant', text: string, complete: boolean): void;
	level(value: number | null): void;
	error(message: string): void;
}

/** Google Live takes mono, little-endian PCM16 at 16 kHz, not WebM recordings. */
export function livePcm16(samples: Float32Array, sampleRate: number): Uint8Array {
	const ratio = sampleRate / 16000;
	const output = new Uint8Array(Math.floor(samples.length / ratio) * 2);
	const view = new DataView(output.buffer);
	for (let i = 0; i < output.length / 2; i++) {
		const start = Math.floor(i * ratio), end = Math.min(samples.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
		let sum = 0; for (let j = start; j < end; j++) sum += samples[j];
		const value = Math.max(-1, Math.min(1, sum / (end - start)));
		view.setInt16(i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
	}
	return output;
}

function base64(bytes: Uint8Array): string {
	let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
	return btoa(binary);
}

/** One explicit voice session. stop() releases mic, socket, playback and timers. */
export class AssistantLiveSession {
	private stopped = false;
	private ready = false;
	private socket: WebSocket | null = null;
	private stream: MediaStream | null = null;
	private context: AudioContext | null = null;
	private source: MediaStreamAudioSourceNode | null = null;
	private processor: AudioWorkletNode | ScriptProcessorNode | null = null;
	private silent: GainNode | null = null;
	private outputs = new Set<AudioBufferSourceNode>();
	private nextOutputAt = 0;
	private timers = new Set<ReturnType<typeof setTimeout>>();
	private inputText = '';
	private outputText = '';
	private receiving: Promise<void> = Promise.resolve();

	constructor(private readonly callbacks: LiveCallbacks) {}

	async start(token: AssistantLiveToken, maxSeconds = 300): Promise<void> {
		if (this.stopped) return;
		try {
			const url = new URL(token.wsUrl);
			if (url.protocol !== 'wss:' || url.hostname !== 'generativelanguage.googleapis.com' || !url.searchParams.has('access_token') || !token.sessionConfig?.setup) throw new Error('invalid token contract');
			this.callbacks.state('connecting');
			this.context = new AudioContext();
			await this.context.resume();
			if (this.stopped) return;
			const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
			if (this.stopped) { stream.getTracks().forEach(track => track.stop()); return; }
			this.stream = stream;
			const socket = this.socket = new WebSocket(url.href);
			socket.onopen = () => { if (!this.stopped) socket.send(JSON.stringify({ setup: { ...token.sessionConfig.setup, inputAudioTranscription: {}, outputAudioTranscription: {} } })); };
			socket.onmessage = event => { this.receiving = this.receiving.then(async () => {
				if (this.stopped) return;
				try { const raw = event.data instanceof Blob ? await event.data.text() : String(event.data); if (!this.stopped) await this.message(JSON.parse(raw)); } catch { this.fail('تعذر قراءة الاتصال الصوتي.'); }
			}); };
			socket.onerror = () => this.fail('تعذر الاتصال بالمحادثة الصوتية.');
			socket.onclose = () => { if (!this.stopped) this.fail('انتهت المحادثة الصوتية. يمكنك بدء جلسة جديدة.'); };
			this.after(12_000, () => { if (!this.ready) this.fail('انتهت مهلة بدء المحادثة الصوتية.'); });
			this.after(Math.max(30, Math.min(900, maxSeconds)) * 1000, () => { this.callbacks.error('انتهت مدة الجلسة الصوتية. يمكنك بدء جلسة جديدة.'); this.stop(); });
		} catch { this.fail('تعذر بدء الصوت المباشر. تحقق من إذن الميكروفون والاتصال.'); }
	}

	stop(): void {
		if (this.stopped) return;
		this.stopped = true;
		for (const timer of this.timers) clearTimeout(timer); this.timers.clear();
		if (this.socket) {
			this.socket.onopen = this.socket.onmessage = this.socket.onerror = this.socket.onclose = null;
			try { if (this.socket.readyState === 1) this.socket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } })); this.socket.close(1000); } catch { /* socket already closed */ }
			this.socket = null;
		}
		this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
		if (typeof ScriptProcessorNode !== 'undefined' && this.processor instanceof ScriptProcessorNode) this.processor.onaudioprocess = null;
		if (typeof AudioWorkletNode !== 'undefined' && this.processor instanceof AudioWorkletNode) this.processor.port.onmessage = null;
		this.processor?.disconnect(); this.processor = null;
		this.source?.disconnect(); this.source = null;
		this.silent?.disconnect(); this.silent = null;
		this.interrupt(); this.flushText();
		this.context?.close().catch(() => {}); this.context = null;
		this.callbacks.state('ended');
	}

	private async message(message: any): Promise<void> {
		if (message.error) { this.fail('أوقف الخادم الجلسة الصوتية. حاول مرة أخرى.'); return; }
		if (message.setupComplete && !this.ready) { this.ready = true; await this.capture(); if (!this.stopped) this.callbacks.state('listening'); }
		if (message.goAway) { this.callbacks.error('الجلسة الصوتية على وشك الانتهاء؛ ابدأ جلسة جديدة.'); this.stop(); return; }
		const content = message.serverContent;
		if (!content || this.stopped) return;
		if (content.interrupted) { this.interrupt(); this.flushText(); this.callbacks.state('listening'); }
		if (content.inputTranscription?.text) { this.inputText += content.inputTranscription.text; this.callbacks.transcript('user', this.inputText, false); }
		if (content.outputTranscription?.text) { this.outputText += content.outputTranscription.text; this.callbacks.transcript('assistant', this.outputText, false); }
		for (const part of content.modelTurn?.parts ?? []) {
			if (part.inlineData?.data && /^audio\/pcm/.test(part.inlineData.mimeType ?? '')) this.play(part.inlineData.data, Number(/rate=(\d+)/.exec(part.inlineData.mimeType)?.[1]) || 24000);
		}
		if (content.turnComplete && content.interactionStatus !== 'IN_PROGRESS') { this.flushText(); if (!this.outputs.size) this.callbacks.state('listening'); }
	}

	private async capture(): Promise<void> {
		const context = this.context; if (!context || !this.stream || this.stopped) return;
		this.source = context.createMediaStreamSource(this.stream);
		const send = (samples: Float32Array) => {
			if (this.stopped || this.socket?.readyState !== 1) return;
			if (this.socket.bufferedAmount > 256_000) { this.fail('الاتصال بطيء للمحادثة الصوتية. يمكنك استخدام رسالة مسجلة.'); return; }
			this.socket.send(JSON.stringify({ realtimeInput: { audio: { data: base64(livePcm16(samples, context.sampleRate)), mimeType: 'audio/pcm;rate=16000' } } }));
		};
		if (context.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
			const module = URL.createObjectURL(new Blob([`class BeboCapture extends AudioWorkletProcessor { constructor(){super();this.samples=[];} process(inputs){const channel=inputs[0]?.[0];if(channel){this.samples.push(...channel);if(this.samples.length>=2048){this.port.postMessage(new Float32Array(this.samples));this.samples=[];}}return true;} } registerProcessor('bebo-capture',BeboCapture);`], { type: 'text/javascript' }));
			try { await context.audioWorklet.addModule(module); } finally { URL.revokeObjectURL(module); }
			if (this.stopped) return;
			const node = new AudioWorkletNode(context, 'bebo-capture'); node.port.onmessage = event => send(event.data); this.processor = node;
		} else {
			const node = context.createScriptProcessor(2048, 1, 1); node.onaudioprocess = event => send(event.inputBuffer.getChannelData(0)); this.processor = node;
		}
		this.silent = context.createGain(); this.silent.gain.value = 0;
		this.source.connect(this.processor); this.processor.connect(this.silent); this.silent.connect(context.destination);
	}

	private play(data: string, rate: number): void {
		const context = this.context; if (!context || ![16000, 24000, 48000].includes(rate)) return;
		const bytes = Uint8Array.from(atob(data), character => character.charCodeAt(0));
		if (!bytes.length || bytes.length % 2) return;
		const view = new DataView(bytes.buffer), buffer = context.createBuffer(1, bytes.length / 2, rate), channel = buffer.getChannelData(0);
		let energy = 0; for (let i = 0; i < channel.length; i++) { channel[i] = view.getInt16(i * 2, true) / 32768; energy += channel[i] * channel[i]; }
		if (this.nextOutputAt - context.currentTime > 10) { this.fail('تأخر تشغيل الرد الصوتي. ابدأ جلسة جديدة.'); return; }
		const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination);
		this.outputs.add(source); this.callbacks.state('speaking'); this.callbacks.level(Math.min(1, Math.sqrt(energy / channel.length) * 7));
		source.onended = () => { this.outputs.delete(source); source.disconnect(); if (!this.stopped && !this.outputs.size) { this.callbacks.level(null); this.callbacks.state('listening'); } };
		const start = Math.max(context.currentTime, this.nextOutputAt); source.start(start); this.nextOutputAt = start + buffer.duration;
	}

	private interrupt(): void { for (const output of this.outputs) { output.onended = null; try { output.stop(); output.disconnect(); } catch { /* finished */ } } this.outputs.clear(); this.nextOutputAt = 0; this.callbacks.level(null); }
	private flushText(): void { if (this.inputText.trim()) this.callbacks.transcript('user', this.inputText, true); if (this.outputText.trim()) this.callbacks.transcript('assistant', this.outputText, true); this.inputText = this.outputText = ''; }
	private fail(message: string): void { if (!this.stopped) { this.callbacks.error(message); this.stop(); } }
	private after(ms: number, action: () => void): void { const timer = setTimeout(() => { this.timers.delete(timer); if (!this.stopped) action(); }, ms); this.timers.add(timer); }
}
