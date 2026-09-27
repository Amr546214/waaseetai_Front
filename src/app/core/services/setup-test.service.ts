import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';

// Onboarding calibration test — no code path gates anything on a pass/fail
// outcome, so the contract never claims a `passed` verdict that doesn't
// exist. See setup-test.gateway.ts for the backend side of this fix.
export interface SetupTestResult {
  score: number;
  message: string;
  total: number;
  correct: number;
}

export interface SetupTestQuestion {
  id: string;
  text: string;
  options: string[];
  index: number;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class SetupTestService {
  private socket: Socket | null = null;

  isGenerating = signal<boolean>(false);
  statusMsg = signal<string>('');
  currentQuestion = signal<SetupTestQuestion | null>(null);
  result = signal<SetupTestResult | null>(null);
  totalQuestions = signal<number>(0);
  errorMsg = signal<string | null>(null);
  bannedMsg = signal<string | null>(null);
  warningMsg = signal<string | null>(null);

  private getToken(): string {
    if (typeof window !== 'undefined' && window.localStorage) {
      let token = localStorage.getItem('waseet_token') || localStorage.getItem('access_token') || localStorage.getItem('token');
      if (token) {
        if (token.startsWith('"') && token.endsWith('"')) {
          token = token.slice(1, -1);
        }
        return token;
      }
    }
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(new RegExp('(^| )waseet_token=([^;]+)'));
      if (match) {
        let token = decodeURIComponent(match[2]);
        if (token.startsWith('"') && token.endsWith('"')) {
          token = token.slice(1, -1);
        }
        return token;
      }
    }
    return '';
  }

  startTest() {
    this.isGenerating.set(true);
    this.errorMsg.set(null);
    this.bannedMsg.set(null);
    this.warningMsg.set(null);
    this.result.set(null);
    this.currentQuestion.set(null);

    const socketUrl = environment.url_api.includes('/api') 
      ? environment.url_api.replace('/api', '') 
      : environment.url_api;

    const token = this.getToken();
    this.socket = io(socketUrl, {
      transports: ['websocket'],
      auth: { token }
    });
    this.socket.emit('setup_test:init', { token });

    this.socket.on('setup_test:generating', (data: any) => {
      this.statusMsg.set(data.message);
    });

    this.socket.on('setup_test:ready', (data: any) => {
      this.isGenerating.set(false);
      this.totalQuestions.set(data.totalQuestions);
      this.socket?.emit('setup_test:get_question', { token: this.getToken() });
    });

    this.socket.on('setup_test:question', (data: SetupTestQuestion) => {
      this.currentQuestion.set(data);
    });

    this.socket.on('setup_test:result', (data: SetupTestResult) => {
      this.result.set(data);
      this.currentQuestion.set(null);
    });

    this.socket.on('setup_test:warning', (data: any) => {
      this.warningMsg.set(data.message);
    });

    this.socket.on('setup_test:banned', (data: any) => {
      this.bannedMsg.set(data.message);
      this.disconnect();
    });

    this.socket.on('setup_test:error', (data: any) => {
      this.errorMsg.set(data.message);
      this.disconnect();
    });
  }

  submitAnswer(questionId: string, selectedIndex: number) {
    const token = this.getToken();
    this.socket?.emit('setup_test:answer', {
      token,
      questionId,
      selectedIndex
    });
    this.currentQuestion.set(null);
  }

  triggerAntiCheat(type: string) {
    const token = this.getToken();
    this.socket?.emit('setup_test:anti_cheat', { token, type });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
