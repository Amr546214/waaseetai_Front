import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import io, { Socket } from 'socket.io-client';

// Implementation Batch 2, Part A — wires the previously-static "Help AI
// Assistant" placeholder to the real backend gateway
// (waseetai-backend/src/sockets/help-assistant-chat.gateway.ts), using the
// same connection pattern already established in new-project.service.ts
// (io(environment.socketUrl, { auth: { token } })). Soft-auth: works for
// both guests (token null) and authenticated users.

export interface HelpChatHistoryTurn {
	question: string;
	answer: string;
}

export interface HelpErrorPayload {
	message: string;
	humanSupportFallback?: boolean;
}

@Injectable({
	providedIn: 'root',
})
export class HelpAssistantSocketService {
	private socket: Socket | null = null;

	private initSocket(): Socket {
		if (!this.socket) {
			let token: string | null = null;
			if (typeof window !== 'undefined') {
				token = localStorage.getItem('waseet_token') || localStorage.getItem('access_token') || localStorage.getItem('token');
				if (!token && typeof document !== 'undefined') {
					token = document.cookie.match(/(?:^|;\s*)waseet_token=([^;]+)/)?.[1] || null;
				}
			}
			this.socket = io(environment.socketUrl, {
				withCredentials: true,
				reconnection: true,
				auth: { token },
			});
		}
		return this.socket;
	}

	ask(question: string, history: HelpChatHistoryTurn[] = []): void {
		const s = this.initSocket();
		s.emit('help:ask', { question, history });
	}

	onAnswerStart(callback: () => void): void {
		const s = this.initSocket();
		s.off('help:answer_start');
		s.on('help:answer_start', callback);
	}

	onAnswerChunk(callback: (data: { chunk: string }) => void): void {
		const s = this.initSocket();
		s.off('help:answer_chunk');
		s.on('help:answer_chunk', callback);
	}

	onAnswerComplete(callback: () => void): void {
		const s = this.initSocket();
		s.off('help:answer_complete');
		s.on('help:answer_complete', callback);
	}

	onError(callback: (data: HelpErrorPayload) => void): void {
		const s = this.initSocket();
		s.off('help:error');
		s.on('help:error', callback);
	}

	disconnect(): void {
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
		}
	}
}
