import { Injectable, NgZone, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { SOCKET_BACKOFF } from '../utils/socket-backoff';
import { AuthStore } from '../store/auth.store';
import { AdminAccessService } from './admin-access.service';

export interface MsgPerson { userId: string; name: string; role: string }
export interface MsgLast { body: string; at: string; mine: boolean }
export interface MsgConversation { id: string; counterpart: MsgPerson; lastMessage: MsgLast | null; lastMessageAt: string | null; unread: number }
export interface MsgItem { id: string; conversationId: string; senderId: string; clientMessageId: string; body: string; seq: string; createdAt: string }
/** a message of the open thread: `saved` rows come from the server; `sending` / `failed` exist only on this device until the server confirms them */
export interface ThreadItem { key: string; clientMessageId: string; body: string; createdAt: string; mine: boolean; state: 'saved' | 'sending' | 'failed'; seq?: string; error?: string }
interface Envelope<T> { success: boolean; data: T; message?: string }

const base = () => `${environment.url_api}/admin/messages`;
export const newClientMessageId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`);
const seqNum = (s?: string) => (s ? BigInt(s) : BigInt(0));

/** HTTP side of the admin team messaging + the live push. Nothing is "sent" until the server answers 2xx; the live socket only brings events, the saved rows stay the truth (refetched on reconnect). */
@Injectable({ providedIn: 'root' })
export class AdminMessagesApi {
	private http = inject(HttpClient);
	directory(q?: string): Observable<Envelope<MsgPerson[]>> { return this.http.get<Envelope<MsgPerson[]>>(`${base()}/directory`, { params: q ? new HttpParams().set('q', q) : undefined }); }
	conversations(q?: string): Observable<Envelope<MsgConversation[]>> { return this.http.get<Envelope<MsgConversation[]>>(`${base()}/conversations`, { params: q ? new HttpParams().set('q', q) : undefined }); }
	start(userId: string): Observable<Envelope<MsgConversation>> { return this.http.post<Envelope<MsgConversation>>(`${base()}/conversations`, { userId }); }
	messages(id: string, before?: string): Observable<Envelope<{ messages: MsgItem[]; hasMore: boolean }>> { let p = new HttpParams().set('limit', '50'); if (before) p = p.set('before', before); return this.http.get<Envelope<{ messages: MsgItem[]; hasMore: boolean }>>(`${base()}/conversations/${id}/messages`, { params: p }); }
	send(id: string, body: string, clientMessageId: string): Observable<Envelope<{ message: MsgItem; duplicate: boolean }>> { return this.http.post<Envelope<{ message: MsgItem; duplicate: boolean }>>(`${base()}/conversations/${id}/messages`, { body, clientMessageId }); }
	read(id: string, upToSeq: string): Observable<Envelope<{ conversationId: string; unread: number }>> { return this.http.post<Envelope<{ conversationId: string; unread: number }>>(`${base()}/conversations/${id}/read`, { upToSeq }); }
}

/** The page's live connection: its own socket, subscribed to the account's own message room after the server re-checks the permission; reconnects re-subscribe and tell the page to refetch. */
@Injectable({ providedIn: 'root' })
export class AdminMessagesLive {
	private zone = inject(NgZone); private auth = inject(AuthStore); private access = inject(AdminAccessService); private platform = inject(PLATFORM_ID);
	private socket: Socket | null = null;
	readonly state = signal<'off' | 'connecting' | 'live' | 'denied'>('off');
	readonly isLive = computed(() => this.state() === 'live');
	onMessage: (p: { conversationId: string; message: MsgItem }) => void = () => undefined;
	onReadSync: (p: { conversationId: string; unread: number; total: number }) => void = () => undefined;
	onResync: () => void = () => undefined;

	open(): void {
		if (!isPlatformBrowser(this.platform) || this.socket) return;
		const token = this.auth.token();
		this.state.set('connecting');
		const s = io(environment.socketUrl, { withCredentials: true, ...SOCKET_BACKOFF, transports: ['websocket', 'polling'], auth: token ? { token } : {} });
		this.socket = s;
		let first = true;
		const subscribe = () => s.emit('admin_messages_subscribe', {}, (r: { ok: boolean; code?: string }) => this.zone.run(() => {
			if (r?.ok) { this.state.set('live'); if (!first) this.onResync(); first = false; } else { this.state.set('denied'); }
		}));
		s.on('connect', subscribe);
		s.on('disconnect', () => this.zone.run(() => { if (this.state() !== 'denied') this.state.set('connecting'); }));
		s.on('admin_message_new', (p: { conversationId: string; message: MsgItem }) => this.zone.run(() => this.onMessage(p)));
		s.on('admin_read_sync', (p: { conversationId: string; unread: number; total: number }) => this.zone.run(() => this.onReadSync(p)));
		// the server cut this connection on purpose (access changed): read the access again - an open page leaves at once if it is no longer allowed - and try again with what is held now
		s.on('admin_access_changed', () => this.zone.run(() => { void this.access.refresh(); setTimeout(() => { try { s.connect(); } catch { /* offline */ } }, 500); }));
	}
	close(): void { try { this.socket?.emit('admin_messages_unsubscribe'); this.socket?.close(); } catch { /* already closed */ } this.socket = null; this.state.set('off'); }
}
export { seqNum };
