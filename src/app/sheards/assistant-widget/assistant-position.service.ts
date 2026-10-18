import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AssistantPositionPreferences, DEFAULT_ASSISTANT_POSITION, cleanAssistantPosition } from './assistant-position';

const POSITION_PREF_KEY = 'waseet_assistant_position';

@Injectable({ providedIn: 'root' })
export class AssistantPositionService {
	private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	readonly preferences = signal<AssistantPositionPreferences>(this.read());
	readonly resetTick = signal(0);

	preview(field: keyof AssistantPositionPreferences, value: number): void {
		const next = cleanAssistantPosition({ ...this.preferences(), [field]: value });
		if (next[field] !== this.preferences()[field]) this.preferences.set(next);
	}

	/** Save at the end of a slider gesture, rather than writing on every input event. */
	save(): void {
		if (!this.isBrowser) return;
		try { localStorage.setItem(POSITION_PREF_KEY, JSON.stringify(this.preferences())); } catch { /* storage unavailable */ }
	}

	reset(): void {
		this.preferences.set({ ...DEFAULT_ASSISTANT_POSITION });
		this.resetTick.update(tick => tick + 1);
		this.save();
	}

	private read(): AssistantPositionPreferences {
		if (this.isBrowser) {
			try { return cleanAssistantPosition(JSON.parse(localStorage.getItem(POSITION_PREF_KEY) || 'null')); } catch { /* malformed or unavailable storage */ }
		}
		return { ...DEFAULT_ASSISTANT_POSITION };
	}
}
