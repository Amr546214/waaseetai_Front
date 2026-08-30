import { Injectable, signal } from '@angular/core';
import { Subject, Observable } from 'rxjs';

/**
 * Robot Message Interface
 */
export interface RobotMessage {
	text: string;
	timestamp: Date;
	type: 'greeting' | 'info' | 'warning' | 'success' | 'error';
	duration?: number; // Optional custom duration in ms
}

/**
 * Robot Avatar Service
 *
 * Centralized service for managing robot interactions across the application.
 * Allows components to trigger robot speech and animations without direct component references.
 *
 * Usage:
 * ```typescript
 * constructor(private robotService: RobotAvatarService) {}
 *
 * greetUser() {
 *   this.robotService.speak('مرحباً بك!');
 * }
 * ```
 */
@Injectable({
	providedIn: 'root'
})
export class RobotAvatarService {
	// Observable stream of messages for robot to speak
	private messageSubject = new Subject<RobotMessage>();
	public messages$: Observable<RobotMessage> = this.messageSubject.asObservable();

	// Track if robot is currently speaking
	public isSpeaking = signal(false);

	// Track if robot is initialized and ready
	public isReady = signal(false);

	// Message queue for sequential speaking
	private messageQueue: RobotMessage[] = [];
	private isProcessingQueue = false;

	constructor() { }

	/**
	 * Make robot speak a message
	 * If robot is currently speaking, message will be queued
	 */
	speak(text: string, type: RobotMessage['type'] = 'info', duration?: number): void {
		const message: RobotMessage = {
			text,
			type,
			timestamp: new Date(),
			duration,
		};

		this.messageQueue.push(message);
		this.processQueue();
	}

	/**
	 * Process message queue sequentially
	 */
	private processQueue(): void {
		if (this.isProcessingQueue || this.messageQueue.length === 0) {
			return;
		}

		this.isProcessingQueue = true;
		const message = this.messageQueue.shift()!;

		this.isSpeaking.set(true);
		this.messageSubject.next(message);

		// Calculate duration if not provided
		const duration = message.duration || this.calculateSpeechDuration(message.text);

		// Wait for speech to complete before processing next message
		setTimeout(() => {
			this.isSpeaking.set(false);
			this.isProcessingQueue = false;

			// Process next message in queue
			if (this.messageQueue.length > 0) {
				this.processQueue();
			}
		}, duration);
	}

	/**
	 * Calculate speech duration based on text length
	 * Average: 150 words per minute = 2.5 words per second
	 */
	private calculateSpeechDuration(text: string): number {
		const words = text.split(/\s+/).length;
		const wordsPerSecond = 2.5;
		const baseDuration = (words / wordsPerSecond) * 1000;

		// Add padding (500ms at start, 300ms at end)
		return baseDuration + 800;
	}

	/**
	 * Clear all pending messages
	 */
	clearQueue(): void {
		this.messageQueue = [];
	}

	/**
	 * Set robot ready state
	 */
	setReady(ready: boolean): void {
		this.isReady.set(ready);
	}

	/**
	 * Predefined greeting messages
	 */
	greetUser(userName?: string): void {
		const greetings = [
			'مرحباً بك في وسيط AI!',
			'أهلاً وسهلاً! كيف يمكنني مساعدتك؟',
			'مرحباً! أنا مساعدك الذكي في وسيط AI',
		];

		const greeting = userName
			? `مرحباً ${userName}! كيف يمكنني مساعدتك اليوم؟`
			: greetings[Math.floor(Math.random() * greetings.length)];

		this.speak(greeting, 'greeting');
	}

	/**
	 * Error message
	 */
	showError(message: string): void {
		this.speak(message, 'error');
	}

	/**
	 * Success message
	 */
	showSuccess(message: string): void {
		this.speak(message, 'success');
	}

	/**
	 * Warning message
	 */
	showWarning(message: string): void {
		this.speak(message, 'warning');
	}

	/**
	 * Info message
	 */
	showInfo(message: string): void {
		this.speak(message, 'info');
	}

	/**
	 * Common messages for the platform
	 */

	welcomeMessage(): void {
		this.speak('مرحباً بك في وسيط AI! نحن هنا لمساعدتك في إيجاد أفضل مقدمي الخدمات', 'greeting');
	}

	explainAI(): void {
		this.speak('نظامنا المدعوم بالذكاء الاصطناعي يحلل العروض ويكشف التلاعب ويساعدك في اختيار أفضل مقدم خدمة', 'info');
	}

	helpWithRequest(): void {
		this.speak('يمكنني مساعدتك في صياغة طلبك وتقدير الميزانية المناسبة واختيار أفضل العروض', 'info');
	}

	thankYou(): void {
		this.speak('شكراً لاستخدامك وسيط AI! نتمنى لك تجربة ممتعة', 'success');
	}

	loadingMessage(): void {
		this.speak('جاري تحميل البيانات، يرجى الانتظار...', 'info');
	}

	errorOccurred(): void {
		this.speak('عذراً، حدث خطأ ما. يرجى المحاولة مرة أخرى', 'error');
	}

	formValidation(field: string): void {
		this.speak(`يرجى التحقق من ${field}`, 'warning');
	}

	serviceSelected(serviceName: string): void {
		this.speak(`ممتاز! لقد اخترت خدمة ${serviceName}`, 'success');
	}

	budgetSuggestion(amount: number): void {
		this.speak(`بناءً على تحليل السوق، الميزانية المقترحة هي ${amount} ريال`, 'info');
	}

	offerAnalysis(offersCount: number): void {
		this.speak(`تم تحليل ${offersCount} عرض. سأساعدك في اختيار الأفضل`, 'info');
	}

	bestOfferFound(): void {
		this.speak('وجدت أفضل عرض يناسب متطلباتك!', 'success');
	}
}
