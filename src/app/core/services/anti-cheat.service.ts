import { Injectable, inject, signal, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { Subject } from 'rxjs';

export interface StreamedQuestionPayload {
  sessionId: string;
  question: {
    id: string;
    subSpecialtyTag: string;
    text: string;
    options: string[];
  };
  index: number;
  total: number;
  isLast: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AntiCheatService implements OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private socket: Socket | null = null;

  // Reactive State Signals
  public isMonitoring = signal<boolean>(false);

  // Event subjects for component reactive overlays and streaming
  public questionStreamed$ = new Subject<StreamedQuestionPayload>();
  public assessmentReady$ = new Subject<{ attemptId: string; totalQuestions: number; timeLimitMinutes: number; generationSource?: 'GEMINI' | 'STATIC_FALLBACK' }>();
  public evaluationComplete$ = new Subject<any>();
  // Batch 3D-2: real backend failures for the primary assessment socket flow
  // (auth/rate-limit/ownership/generation/submission exceptions) — previously
  // emitted by the backend but never listened for anywhere on the frontend.
  // Batch 3D-3: submission-phase emissions now also carry a structured `code`
  // (assessment.gateway.ts's handleSubmission) so callers can distinguish a
  // genuine retryable transport failure from a terminal business outcome
  // without parsing the Arabic message. Generation-phase emissions
  // (start_assessment) have no `code` — untouched, out of this batch's scope.
  public assessmentError$ = new Subject<{ message: string; code?: string }>();
  // Batch 3D-3: a real socket.io 'disconnect' occurring mid-flight — lets a
  // pending submission detect a genuine transport failure immediately instead
  // of waiting for a bounded timeout.
  public socketDisconnected$ = new Subject<void>();

  /**
   * Establishes the assessment socket transport for the live quiz/assessment session.
   */
  public startMonitoring(): void {
    if (!this.isBrowser || this.isMonitoring()) return;

    this.initSocket();
    this.isMonitoring.set(true);
    console.log('[AntiCheatService] Assessment socket transport activated');
  }

  /**
   * Tears down the assessment socket transport upon test submission or termination.
   */
  public stopMonitoring(): void {
    if (!this.isBrowser) return;

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isMonitoring.set(false);
    console.log('[AntiCheatService] Assessment socket transport deactivated');
  }

  private initSocket(): void {
    if (!this.isBrowser || this.socket?.connected) return;

    // The backend's main socket namespace only recognizes a JWT passed via
    // the handshake `auth.token` (or an Authorization header) — it never
    // reads cookies. Without this, `socket.userId` never gets set
    // server-side and every assessment event (start_assessment,
    // submit_answer/submit_assessment) would be rejected as unauthenticated
    // for every real user. Same token-lookup pattern already used by
    // new-project.service.ts / setup-test.service.ts.
    let token: string | null = null;
    if (typeof window !== 'undefined') {
      token = localStorage.getItem('waseet_token') || localStorage.getItem('access_token') || localStorage.getItem('token');
      if (!token && typeof document !== 'undefined') {
        token = document.cookie.match(/(?:^|;\s*)waseet_token=([^;]+)/)?.[1] || null;
      }
    }

    this.socket = io(environment.socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: { token }
    });

    this.socket.on('question_streamed', (payload: any) => {
      const formatted: StreamedQuestionPayload = {
        sessionId: payload.attemptId,
        question: {
          id: String(payload.question.id),
          subSpecialtyTag: payload.question.difficulty || 'سؤال فني',
          text: payload.question.textAr || payload.question.text,
          options: payload.question.options
        },
        index: payload.questionIndex - 1,
        total: payload.totalQuestions,
        isLast: payload.questionIndex >= payload.totalQuestions
      };
      this.questionStreamed$.next(formatted);
    });

    this.socket.on('assessment_ready', (payload: any) => {
      this.assessmentReady$.next(payload);
    });

    this.socket.on('evaluation_complete', (payload: any) => {
      this.evaluationComplete$.next(payload);
    });

    // Batch 3D-2: registered exactly once per socket instance, alongside the
    // other assessment events above — `initSocket()` itself is guarded
    // against re-entry (`if (!this.isBrowser || this.socket?.connected) return;`),
    // and `stopMonitoring()` disconnects and nulls out `this.socket`, which
    // tears down this listener along with all the others. No separate
    // unsubscribe bookkeeping is needed beyond that existing pattern.
    this.socket.on('assessment_error', (payload: any) => {
      const message = typeof payload?.message === 'string' && payload.message.trim().length > 0
        ? payload.message
        : 'حدث خطأ أثناء معالجة التقييم الفني.';
      const code = typeof payload?.code === 'string' ? payload.code : undefined;
      this.assessmentError$.next({ message, code });
    });

    // Batch 3D-3: a real transport failure signal a pending submission can
    // react to immediately instead of waiting for the bounded fallback timer.
    this.socket.on('disconnect', () => {
      this.socketDisconnected$.next();
    });
  }

  public startAssessmentStream(payload: {
    providerSpecialtyId?: string;
    specialtyId?: string;
    subSpecialtyIds?: string[];
    portfolioFileUrls?: string[];
    categoryName?: string;
    specialtyName?: string;
    providerProfileId?: string;
  }): void {
    if (!this.isBrowser) return;

    if (!this.socket) this.initSocket();

    if (this.socket?.connected) {
      this.socket.emit('start_assessment', payload);
    } else {
      // Emit as soon as the WebSocket handshake completes. A fixed timeout could
      // fire too early on a slow connection and silently lose the assessment request.
      this.socket?.once('connect', () => this.socket?.emit('start_assessment', payload));
    }
  }

  // Batch 3D-3: returns whether the socket actually emitted, so the caller
  // (specialties.ts's submission coordinator) can detect synchronously that
  // the primary transport was never viable (e.g. socket disconnected) instead
  // of silently no-op'ing and waiting forever for a response that will never
  // arrive — this was the exact bug that made socket submission dead in
  // practice (see the Batch 3D-3 report for the call-order root cause).
  public submitAssessmentAnswers(attemptId: string, answers: Record<string, string>): boolean {
    if (this.socket?.connected) {
      this.socket.emit('submit_answer', { attemptId, answers });
      return true;
    }
    return false;
  }

  ngOnDestroy(): void {
    this.stopMonitoring();
  }
}
