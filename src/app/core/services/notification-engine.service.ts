import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { NotificationSoundService } from './notification-sound.service';

export interface NotificationEvent {
	id?: string;
	title: string;
	message: string;
	type?: string;
	category?: string;
	actionUrl?: string;
	actionText?: string;
	createdAt?: string | Date;
	metadata?: any;
	time?: string;
	dateCategory?: 'اليوم' | 'أمس' | 'أقدم';
	iconColorClass?: string;
	iconBgClass?: string;
	svgIcon?: string;
}

@Injectable({
	providedIn: 'root'
})
export class NotificationEngineService {
	private http = inject(HttpClient);
	private soundService = inject(NotificationSoundService);
	private socket: Socket | null = null;

	unreadCount = signal<number>(0);
	latestNotification = signal<NotificationEvent | null>(null);
	latestModelStatusUpdate = signal<any | null>(null);
	showToast = signal<boolean>(false);

	// Real-time event emitters for UI reactivity
	realtimeNewNotification = signal<any | null>(null);
	realtimeReadNotification = signal<string | null>(null);
	realtimeReadAll = signal<boolean>(false);

	private toastTimer: any = null;

	constructor() {
		this.initSocket('ba85ed18-656e-4b66-a99d-463bfdbb1963'); // Default test room joining
	}

	initSocket(userId?: string): void {
		if (!this.socket) {
			this.socket = io(environment.socketUrl, {
				withCredentials: true,
				reconnection: true
			});

			console.log('🔌 NotificationEngine connected to WebSocket');

			const handleNewNotification = (notif: any) => {
				console.log('📬 Real-time notification received:', notif);
				this.unreadCount.update(c => c + 1);
				this.realtimeNewNotification.set(notif);
				this.soundService.playPopSound();
				this.triggerToast(notif);
			};

			this.socket.on('notification:new', handleNewNotification);
			this.socket.on('new_notification', handleNewNotification);

			this.socket.on('notification_read', (data: { id: string }) => {
				if (data && data.id) {
					this.realtimeReadNotification.set(data.id);
				}
			});

			this.socket.on('all_notifications_read', () => {
				this.unreadCount.set(0);
				this.realtimeReadAll.set(true);
			});

			const handleModelUpdate = (updateData: any) => {
				console.log('✨ Model Audit Status Update arrived:', updateData);
				this.latestModelStatusUpdate.set(updateData);
				if (updateData.notification && !updateData._notified) {
					updateData._notified = true;
					this.unreadCount.update(c => c + 1);
					this.soundService.playPopSound();
					this.triggerToast(updateData.notification);
				}
			};

			this.socket.on('model:status_updated', handleModelUpdate);
			this.socket.on('model_status_update', handleModelUpdate);
		}

		if (userId && this.socket) {
			this.socket.emit('join_user_room', userId);
			console.log(`📡 NotificationEngine subscribed to room for user: ${userId}`);
		}
	}

	fetchNotifications(category?: string): Observable<any> {
		const params: any = {};
		if (category && category !== 'all' && category !== 'ALL') {
			params.category = category;
		}
		return this.http.get<any>(`${environment.url_api}/notifications`, { params });
	}

	markNotificationAsRead(id: string): Observable<any> {
		return this.http.patch<any>(`${environment.url_api}/notifications/${id}/read`, {});
	}

	markAllNotificationsAsRead(): Observable<any> {
		return this.http.patch<any>(`${environment.url_api}/notifications/read-all`, {});
	}

	triggerToast(notif: NotificationEvent): void {
		this.latestNotification.set(notif);
		this.showToast.set(true);

		if (this.toastTimer) {
			clearTimeout(this.toastTimer);
		}

		this.toastTimer = setTimeout(() => {
			this.showToast.set(false);
		}, 7000);
	}

	closeToast(): void {
		this.showToast.set(false);
		if (this.toastTimer) {
			clearTimeout(this.toastTimer);
		}
	}

	resetUnread(): void {
		this.unreadCount.set(0);
	}

	disconnect(): void {
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
		}
	}
}
