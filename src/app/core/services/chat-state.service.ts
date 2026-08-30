import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ChatStateService {
  // Dictionary mapping conversationId -> unread message count
  private unreadMap = signal<Record<string, number>>({});

  // Active open conversation ID in UI right now (so we know not to increment unread if user is watching)
  public activeConversationId = signal<string | null>(null);

  // Computed total unread message count across all conversations
  public totalUnreadCount = computed(() => {
    const map = this.unreadMap();
    return Object.values(map).reduce((sum, val) => sum + (val > 0 ? val : 0), 0);
  });

  /**
   * Initialize unread counts from an API conversation list
   */
  public initFromConversations(conversations: any[]): void {
    if (!Array.isArray(conversations)) return;
    const newMap: Record<string, number> = {};
    conversations.forEach(conv => {
      if (conv?.id) {
        const count = typeof conv.unreadCount === 'number' ? conv.unreadCount : 
                      (conv._count?.messages || 0);
        newMap[conv.id] = count;
      }
    });
    this.unreadMap.set(newMap);
  }

  /**
   * Increment unread count for a specific conversation
   */
  public incrementUnread(conversationId: string): void {
    if (!conversationId) return;
    // Don't increment if user is actively viewing this exact conversation
    if (this.activeConversationId() === conversationId) return;

    this.unreadMap.update(map => ({
      ...map,
      [conversationId]: (map[conversationId] || 0) + 1
    }));
  }

  /**
   * Set specific unread count for a conversation
   */
  public setUnreadCount(conversationId: string, count: number): void {
    if (!conversationId) return;
    this.unreadMap.update(map => ({
      ...map,
      [conversationId]: Math.max(0, count)
    }));
  }

  /**
   * Mark a conversation as read (reset count to 0)
   */
  public markAsRead(conversationId: string): void {
    if (!conversationId) return;
    this.unreadMap.update(map => ({
      ...map,
      [conversationId]: 0
    }));
  }
}
