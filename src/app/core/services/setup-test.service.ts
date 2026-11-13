import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { SKIP_LOADING } from '../interceptors/loading.interceptor';
import { ExamEnvironmentService } from './exam-environment.service';
import { io, Socket } from 'socket.io-client';
import { SOCKET_BACKOFF } from '../utils/socket-backoff';
import { environment } from '../../../environments/environment';

/** Single frontend source for the calibration test's limits. Mirrors the backend constants SETUP_TEST_QUESTION_COUNT and
 *  SETUP_TEST_TIME_LIMIT_MINUTES (setup-test.gateway.ts:21-22, both 15). The `setup_test:ready` event only carries
 *  totalQuestions — no expiry or duration — so the duration cannot be read from the backend yet. */
export const SETUP_TEST_QUESTION_COUNT = 15;
export const SETUP_TEST_TIME_LIMIT_MINUTES = 15;

// Onboarding calibration test — no code path gates anything on a pass/fail
// outcome, so the contract never claims a `passed` verdict that doesn't
// exist. See setup-test.gateway.ts for the backend side of this fix.
export interface SetupTestResult {
  score: number;
  message: string;
  total: number;
  /** Only when the backend really counted correct answers; WaseetAI-graded tests report a score only. */
  correct?: number;
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
  private cachedQuestions: SetupTestQuestion[] = [];
  private nextQuestionIndex = 0;

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

  private readonly http = inject(HttpClient);
  private readonly examEnv = inject(ExamEnvironmentService);
  /** Restricted exam mode and this browser is not a verified Safe Exam Browser: the page shows the instructions, nothing is generated. */
  readonly needsExamEnvironment = signal(false);

  startTest() {
    this.isGenerating.set(true);
    this.errorMsg.set(null);
    this.bannedMsg.set(null);
    this.warningMsg.set(null);
    this.result.set(null);
    this.currentQuestion.set(null);
    this.cachedQuestions = [];
    this.nextQuestionIndex = 0;
    this.needsExamEnvironment.set(false);
    // The test itself, its scoring and what its result does are unchanged. Only in the server's restricted exam mode does it first ask WHERE it may start: a verified Safe Exam Browser
    // gets a short-lived ticket on the verified HTTP route, and the server refuses to start (and to generate any question) without it.
    this.examEnv.load(env => {
      if (!env?.restricted) { this.openSocket(); return; }
      if (!this.examEnv.satisfied()) { this.isGenerating.set(false); this.needsExamEnvironment.set(true); return; }
      this.http.post<{ data?: { ticket?: string } }>(`${environment.url_api}/exam-environment/ticket`, {}, { context: new HttpContext().set(SKIP_LOADING, true) }).subscribe({
        next: r => this.openSocket(r?.data?.ticket),
        error: () => { this.isGenerating.set(false); this.errorMsg.set('تعذر التحقق من بيئة الاختبار. أعد المحاولة من داخل Safe Exam Browser.'); }
      });
    });
  }

  private openSocket(examTicket?: string) {
    const socketUrl = environment.url_api.includes('/api') 
      ? environment.url_api.replace('/api', '') 
      : environment.url_api;

    const token = this.getToken();
    this.socket = io(socketUrl, {
      ...SOCKET_BACKOFF,
      transports: ['websocket'],
      auth: { token }
    });
    this.socket.emit('setup_test:init', { token, ...(examTicket ? { examTicket } : {}) });

    this.socket.on('setup_test:generating', (data: any) => {
      this.statusMsg.set(data.message);
    });

    this.socket.on('setup_test:ready', (data: any) => {
      this.isGenerating.set(false);
      this.totalQuestions.set(data.totalQuestions);
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        this.cachedQuestions = data.questions;
        this.currentQuestion.set(this.cachedQuestions[0]);
      } else {
        this.socket?.emit('setup_test:get_question', { token: this.getToken() });
      }
    });

    this.socket.on('setup_test:question', (data: SetupTestQuestion) => {
      if (this.cachedQuestions.length && data.index < this.nextQuestionIndex) return;
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
    if (this.cachedQuestions.length && this.currentQuestion()?.id !== questionId) return;
    const currentIdx = this.cachedQuestions.findIndex(q => q.id === questionId);
    if (currentIdx >= 0) {
      const question = this.cachedQuestions[currentIdx];
      if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= question.options.length) return;
      this.nextQuestionIndex = currentIdx + 1;
    }
    const token = this.getToken();
    if (currentIdx >= 0 && currentIdx + 1 < this.cachedQuestions.length) {
      this.currentQuestion.set(this.cachedQuestions[currentIdx + 1]);
    } else {
      this.currentQuestion.set(null);
    }
    this.socket?.emit('setup_test:answer', {
      token,
      questionId,
      selectedIndex
    });
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
