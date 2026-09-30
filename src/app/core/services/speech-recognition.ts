import { InjectionToken, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

// Browser speech-to-text (Web Speech API) for the Help Assistant microphone,
// as in the Bebo v4 handoff (bebo-chat.js `listen()`): the browser's own
// SpeechRecognition / webkitSpeechRecognition. No audio is sent to any new
// Waseet/WaseetAI STT service. (Note: some browsers — e.g. Chrome — perform
// this recognition with their vendor's own speech service; that is the
// browser's built-in behavior, identical to the handoff.)

/** Minimal typing of the parts of SpeechRecognition the assistant uses. */
export interface SpeechRecognitionLike {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	maxAlternatives: number;
	onstart: (() => void) | null;
	onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
	onerror: ((event: { error: string }) => void) | null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
	abort(): void;
}

export interface SpeechRecognitionResultEventLike {
	resultIndex: number;
	results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/** The browser's SpeechRecognition constructor, or null (SSR / unsupported). */
export const SPEECH_RECOGNITION = new InjectionToken<SpeechRecognitionCtor | null>('SPEECH_RECOGNITION', {
	providedIn: 'root',
	factory: () => {
		if (!isPlatformBrowser(inject(PLATFORM_ID))) return null;
		const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
		return w.SpeechRecognition || w.webkitSpeechRecognition || null;
	},
});

/** Whether the page is a secure context (mic needs HTTPS or localhost). */
export const SECURE_CONTEXT = new InjectionToken<() => boolean>('SECURE_CONTEXT', {
	providedIn: 'root',
	factory: () => () => typeof window !== 'undefined' && window.isSecureContext === true,
});

/** Handoff messages (bebo-chat.js `listen()` error map), verbatim. */
export const SPEECH_ERROR_MESSAGES: Record<string, string> = {
	'not-allowed': 'اسمح بالمايك من إعدادات المتصفح، وبعدها اضغط المايك تاني.',
	'service-not-allowed': 'خدمة التعرّف الصوتي غير متاحة هنا. جرّب Chrome أو Edge.',
	'audio-capture': 'مش لاقي مايك متاح. وصّله وجرّب تاني.',
	'no-speech': 'ما سمعتش كلام. اضغط المايك وجرّب تاني.',
	network: 'خدمة التعرّف الصوتي محتاجة اتصال. تقدر تكتب رسالتك دلوقتي.',
	'language-not-supported': 'لغة الإملاء غير مدعومة في المتصفح. اختار لغة تانية أو اكتب رسالتك.',
};
export const SPEECH_GENERIC_ERROR = 'التسجيل وقف. تقدر تجرّب تاني أو تكتب رسالتك.';
export const SPEECH_UNSUPPORTED = 'التعرّف على الكلام مش مدعوم في المتصفح ده. افتح نفس الرابط في Chrome أو Edge، أو اكتب رسالتك.';
export const SPEECH_INSECURE = 'المايك محتاج HTTPS أو localhost. الكتابة متاحة.';
export const SPEECH_START_FAILED = 'مش قادر أفتح المايك. جرّب تاني من متصفح بيدعم الإملاء.';
