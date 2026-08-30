import { Injectable, inject, signal, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { Subject } from 'rxjs';

export interface AntiCheatWarningPayload {
  sessionId: string;
  violationCount: number;
  maxAllowed: number;
  violationType: string;
  message: string;
}

export interface AntiCheatLockdownPayload {
  sessionId: string;
  invalidated: boolean;
  reason: string;
  violationCount: number;
  lockoutUntil: string | Date;
  message: string;
}

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
  private currentSessionId: string | null = null;
  private currentSpecialtyId: string | null = null;
  private shouldRequestStream = false;

  // Reactive State Signals
  public isMonitoring = signal<boolean>(false);
  public violationCount = signal<number>(0);
  public isInvalidated = signal<boolean>(false);
  public latestWarning = signal<string | null>(null);
  public lockoutMessage = signal<string | null>(null);
  public isLockedOut = signal<boolean>(false);
  public lockoutUntil = signal<Date | null>(null);

  // Event subjects for component reactive overlays and streaming
  public warningTriggered$ = new Subject<AntiCheatWarningPayload>();
  public lockdownTriggered$ = new Subject<AntiCheatLockdownPayload>();
  public questionStreamed$ = new Subject<StreamedQuestionPayload>();
  public assessmentReady$ = new Subject<{ attemptId: string; totalQuestions: number; timeLimitMinutes: number }>();
  public evaluationComplete$ = new Subject<any>();

  // Bound event listener references for clean removal
  private boundVisibilityChange: any;
  private boundWindowBlur: any;
  private boundBeforeUnload: any;
  private boundCopyPaste: any;
  private boundContextMenu: any;
  private boundKeyDown: any;

  constructor() {
    if (this.isBrowser) {
      this.boundVisibilityChange = this.handleVisibilityChange.bind(this);
      this.boundWindowBlur = this.handleWindowBlur.bind(this);
      this.boundBeforeUnload = this.handleBeforeUnload.bind(this);
      this.boundCopyPaste = this.handleCopyPaste.bind(this);
      this.boundContextMenu = this.handleContextMenu.bind(this);
      this.boundKeyDown = this.handleKeyDown.bind(this);
    }
  }

  /**
   * Initializes real-time socket connection and binds browser lockdown listeners
   */
  public startMonitoring(sessionId: string, providerSpecialtyId: string, requestStream = false): void {
    if (!this.isBrowser) return;

    this.currentSessionId = sessionId;
    this.currentSpecialtyId = providerSpecialtyId;
    this.shouldRequestStream = requestStream;

    if (this.isMonitoring()) {
      if (requestStream && this.socket?.connected) {
        this.socket.emit('quiz:request_stream', { sessionId });
      }
      return;
    }

    // Reset session signals
    this.violationCount.set(0);
    this.isInvalidated.set(false);
    this.latestWarning.set(null);
    this.lockoutMessage.set(null);

    // Initialize socket connection for anti-cheat sync & question streaming
    this.initSocket();

    // Attach strict browser lockdown listeners
    document.addEventListener('visibilitychange', this.boundVisibilityChange);
    window.addEventListener('blur', this.boundWindowBlur);
    window.addEventListener('beforeunload', this.boundBeforeUnload);
    document.addEventListener('copy', this.boundCopyPaste);
    document.addEventListener('paste', this.boundCopyPaste);
    document.addEventListener('cut', this.boundCopyPaste);
    document.addEventListener('contextmenu', this.boundContextMenu);
    document.addEventListener('keydown', this.boundKeyDown);

    this.isMonitoring.set(true);
    console.log(`[AntiCheatService] 🛡️ Secure test environment activated for session ${sessionId}`);
  }

  /**
   * Terminates surveillance and unbinds browser listeners upon test submission or termination
   */
  public stopMonitoring(): void {
    if (!this.isBrowser) return;

    document.removeEventListener('visibilitychange', this.boundVisibilityChange);
    window.removeEventListener('blur', this.boundWindowBlur);
    window.removeEventListener('beforeunload', this.boundBeforeUnload);
    document.removeEventListener('copy', this.boundCopyPaste);
    document.removeEventListener('paste', this.boundCopyPaste);
    document.removeEventListener('cut', this.boundCopyPaste);
    document.removeEventListener('contextmenu', this.boundContextMenu);
    document.removeEventListener('keydown', this.boundKeyDown);

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isMonitoring.set(false);
    this.currentSessionId = null;
    this.currentSpecialtyId = null;
    this.shouldRequestStream = false;
    console.log('[AntiCheatService] 🔓 Secure test environment deactivated');
  }

  private initSocket(): void {
    if (!this.isBrowser || this.socket?.connected) return;

    this.socket = io(environment.socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      if (this.currentSessionId && this.currentSpecialtyId) {
        this.socket?.emit('quiz:start', {
          sessionId: this.currentSessionId,
          providerSpecialtyId: this.currentSpecialtyId,
          requestStream: this.shouldRequestStream
        });
      }
    });

    this.socket.on('quiz:stream_question', (payload: StreamedQuestionPayload) => {
      this.questionStreamed$.next(payload);
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

    this.socket.on('quiz:anti_cheat_warning', (payload: AntiCheatWarningPayload) => {
      this.violationCount.set(payload.violationCount);
      this.latestWarning.set(payload.message);
      this.warningTriggered$.next(payload);
    });

    this.socket.on('quiz:anti_cheat_lockdown', (payload: AntiCheatLockdownPayload) => {
      this.violationCount.set(payload.violationCount);
      this.isInvalidated.set(true);
      this.isLockedOut.set(true);
      this.lockoutMessage.set(payload.message);
      if (payload.lockoutUntil) {
        this.lockoutUntil.set(new Date(payload.lockoutUntil));
      }
      this.lockdownTriggered$.next(payload);
      this.stopMonitoring();
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

  public submitAssessmentAnswers(attemptId: string, answers: Record<string, string>): void {
    if (this.socket?.connected) {
      this.socket.emit('submit_answer', { attemptId, answers });
    }
  }

  /**
   * Request manual stream trigger via Socket
   */
  public requestQuestionStream(sessionId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('quiz:request_stream', { sessionId });
    }
  }

  /**
   * Transmits anti-cheat infraction to the server and triggers client alert
   */
  public reportViolation(violationType: string): void {
    if (!this.isMonitoring() || !this.currentSessionId) return;

    console.warn(`[AntiCheatService] Infraction detected: ${violationType}`);
    const newCount = this.violationCount() + 1;
    this.violationCount.set(newCount);

    if (this.socket?.connected) {
      this.socket.emit('quiz:anti_cheat_violation', {
        sessionId: this.currentSessionId,
        violationType,
        timestamp: Date.now()
      });
    } else {
      // Offline fallback alert
      this.latestWarning.set(`⚠️ تنبيه مكافحة الغش: تم كشف انتهاك (${violationType}). المحاولات المستمرة تؤدي لإلغاء الاختبار وحظره لمدة 24 ساعة.`);
    }
  }

  // --- Browser Event Handlers ---

  private handleVisibilityChange(): void {
    if (document.hidden && this.isMonitoring()) {
      this.reportViolation('TAB_SWITCH_OR_HIDE');
    }
  }

  private handleWindowBlur(): void {
    if (this.isMonitoring()) {
      // Debounce slightly in case blur occurs together with visibilitychange
      setTimeout(() => {
        if (this.isMonitoring() && !document.hasFocus()) {
          this.reportViolation('WINDOW_BLUR_LOST_FOCUS');
        }
      }, 300);
    }
  }

  private handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isMonitoring()) {
      this.reportViolation('PAGE_UNLOAD_OR_REFRESH');
      const confirmationMessage = 'هل أنت متأكد من مغادرة شاشة الاختبار؟ سيؤدي ذلك إلى إلغاء نتيجة الاختبار وتفعيل حظر إعادتها لمدة 24 ساعة!';
      event.returnValue = confirmationMessage;
      return confirmationMessage as any;
    }
  }

  private handleCopyPaste(event: Event): void {
    if (this.isMonitoring()) {
      event.preventDefault();
      this.latestWarning.set('🚫 أفعال النسخ والقص واللصق معطلة داخل بيئة الاختبار المؤمنة!');
    }
  }

  private handleContextMenu(event: MouseEvent): void {
    if (this.isMonitoring()) {
      event.preventDefault();
      this.latestWarning.set('🚫 القائمة الفرعية (زر الفأرة الأيمن) معطلة أثناء سير الاختبار الفوري.');
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.isMonitoring()) return;

    // Block F12 (DevTools), Ctrl+Shift+I / Ctrl+Shift+C / Ctrl+U (View Source), Ctrl+C / Ctrl+V / Ctrl+P
    if (
      event.key === 'F12' ||
      (event.ctrlKey && event.shiftKey && (event.key === 'I' || event.key === 'i' || event.key === 'C' || event.key === 'c' || event.key === 'J' || event.key === 'j')) ||
      (event.ctrlKey && (event.key === 'u' || event.key === 'U')) ||
      (event.ctrlKey && (event.key === 'c' || event.key === 'C' || event.key === 'v' || event.key === 'V' || event.key === 'p' || event.key === 'P'))
    ) {
      event.preventDefault();
      this.latestWarning.set('🚫 استخدام اختصارات المطورين والطباعة محمي وممنوع أثناء أداء الاختبار.');
    }
  }

  ngOnDestroy(): void {
    this.stopMonitoring();
  }
}
