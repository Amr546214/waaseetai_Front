import { Component, computed, inject, signal, effect, AfterViewInit, OnInit, OnDestroy, PLATFORM_ID, Renderer2 } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthStore } from '../../core/store/auth.store';
import { NavDashboard } from '../../sheards/dashboard/nav-dashboard/nav-dashboard';
import { Sidebar } from '../../sheards/dashboard/sidebar/sidebar';
import { ChatService } from '../../core/services/chat.service';
import { ChatStateService } from '../../core/services/chat-state.service';
import { NotificationSoundService } from '../../core/services/notification-sound.service';

import { VideoCallModalComponent } from '../../sheards/dashboard/video-call-modal/video-call-modal';
import { PageLoader } from '../../sheards/page-loader/page-loader';
import { AssistantWidgetComponent } from '../../sheards/assistant-widget/assistant-widget';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, NavDashboard, Sidebar, VideoCallModalComponent, PageLoader, AssistantWidgetComponent],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css'
})
export class DashboardLayoutComponent implements AfterViewInit, OnInit, OnDestroy {
  private authStore = inject(AuthStore);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private renderer = inject(Renderer2);
  private chatService = inject(ChatService);
  public chatStateService = inject(ChatStateService);
  private notificationSoundService = inject(NotificationSoundService);
  private sub = new Subscription();

  // App Info
  currentYear = new Date().getFullYear();
  appVersion = '1.0.0';

  // Responsive Sidebar Toggle
  isSidebarOpen = signal(false);
  isProfileDropdownOpen = signal(false);

  // User details
  currentUser = this.authStore.currentUser;
  
  userFullName = computed(() => {
    const user = this.currentUser();
    return user ? `${user.firstName} ${user.lastName}` : 'مستخدم';
  });

  // Real-time Chat Floating Toast
  chatToast = signal<{
    visible: boolean;
    senderName: string;
    text: string;
    conversationId: string;
    targetRoute: string;
  }>({
    visible: false,
    senderName: '',
    text: '',
    conversationId: '',
    targetRoute: '/client-overview/messages'
  });

  constructor() {
    effect(() => {
      if (isPlatformBrowser(this.platformId)) {
        const user = this.currentUser();
        let userId = user?.id;
        if (!userId) {
          const url = this.router.url;
          if (url.includes('/provider-overview')) userId = 'provider_001';
          else if (url.includes('/marketer-overview')) userId = 'marketer_001';
          else userId = 'client_001';
        }
        if (userId) {
          this.chatService.connect(userId);
        }
      }
    });
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const user = this.currentUser();
      let userId = user?.id;
      if (!userId) {
        const url = this.router.url;
        if (url.includes('/provider-overview')) userId = 'provider_001';
        else if (url.includes('/marketer-overview')) userId = 'marketer_001';
        else userId = 'client_001';
      }

      // Connect WebSocket globally as soon as dashboard layout is active
      this.chatService.connect(userId);

      // Fetch initial conversation list to set unread counters across sidebar globally
      this.sub.add(
        this.chatService.getConversations().subscribe({
          next: (res) => {
            if (res?.success && res?.data) {
              this.chatStateService.initFromConversations(res.data);
            }
          },
          error: (err) => console.warn('[DashboardLayout] Failed to load chat conversations:', err)
        })
      );

      // Listen globally for incoming messages
      this.sub.add(
        this.chatService.newMessage$.subscribe((msg) => {
          if (!msg) return;

          const activeUser = this.currentUser();
          let activeUserId = activeUser?.id;
          if (!activeUserId) {
            const url = this.router.url;
            if (url.includes('/provider-overview')) activeUserId = 'provider_001';
            else if (url.includes('/marketer-overview')) activeUserId = 'marketer_001';
            else activeUserId = 'client_001';
          }

          // Check strictly by senderId matching current active user
          const isFromMe = msg.senderId ? (msg.senderId === activeUserId) : false;
          if (isFromMe) return;

          const currentUrl = this.router.url;
          const isMessagesPage = currentUrl.includes('/messages');
          const activeConvId = this.chatStateService.activeConversationId();
          const isCurrentActive = isMessagesPage && activeConvId === msg.conversationId;

          // Increment unread count in global chat state if not watching this exact conversation
          if (!isCurrentActive && msg.conversationId) {
            this.chatStateService.incrementUnread(msg.conversationId);
          }

          // Trigger toast notification if user is NOT on the active conversation
          if (!isCurrentActive) {
            let targetRoute = '/client-overview/messages';
            if (currentUrl.includes('/provider-overview')) targetRoute = '/provider-overview/messages';
            else if (currentUrl.includes('/marketer-overview')) targetRoute = '/marketer-overview/messages';

            let bodyText = msg.text || msg.content || 'رسالة جديدة';
            if (msg.type === 'AUDIO') bodyText = '🎤 أرسل لك مقطعاً صوتياً';
            else if (msg.type === 'IMAGE') bodyText = '📷 أرسل لك صورة مرفقة';
            else if (msg.type === 'FILE') bodyText = `📁 أرسل لك ملفاً: ${msg.fileName || 'مستند'}`;

            this.chatToast.set({
              visible: true,
              senderName: msg.senderName || msg.senderInitials || 'مستخدم',
              text: bodyText,
              conversationId: msg.conversationId,
              targetRoute
            });

            // Play pop sound
            this.notificationSoundService.playPopSound();

            // Automatically hide toast after 6 seconds
            setTimeout(() => {
              this.chatToast.update(t => ({ ...t, visible: false }));
            }, 6000);
          }
        })
      );
    }
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  closeChatToast() {
    this.chatToast.update(t => ({ ...t, visible: false }));
  }

  goToMessageFromToast() {
    const toast = this.chatToast();
    this.closeChatToast();
    if (toast.targetRoute) {
      this.router.navigate([toast.targetRoute]);
    }
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.initParticles();
    }
  }

  private initParticles() {
    const pc = document.getElementById('particles-container');
    if (pc) {
      const isMob = window.innerWidth < 768;
      const count = isMob ? 11 : 25;
      for (let i = 0; i < count; i++) {
        const p = this.renderer.createElement('div');
        this.renderer.addClass(p, 'particle');
        const sz = (Math.random() * 2.5 + 2).toFixed(1) + 'px';
        
        this.renderer.setStyle(p, 'left', (Math.random() * 100) + '%');
        this.renderer.setStyle(p, 'width', sz);
        this.renderer.setStyle(p, 'height', sz);
        this.renderer.setStyle(p, 'animation-duration', (Math.random() * 9 + 5).toFixed(1) + 's');
        this.renderer.setStyle(p, 'animation-delay', (Math.random() * -12).toFixed(1) + 's');
        this.renderer.setStyle(p, 'opacity', (Math.random() * 0.5 + 0.1).toFixed(2));
        
        this.renderer.appendChild(pc, p);
      }
    }
  }

  toggleSidebar() {
    this.isSidebarOpen.update(v => !v);
  }

  closeSidebar() {
    this.isSidebarOpen.set(false);
  }

  toggleProfileDropdown() {
    this.isProfileDropdownOpen.update(v => !v);
  }

  logout() {
    this.authStore.logout('/auth/login');
  }

  navLinks = [
    { label: 'لوحة التحكم', icon: 'home', route: '/client-overview' },
    { label: 'إنشاء طلب', icon: 'plus-circle', route: '/client-overview/create-request' },
    { label: 'طلباتي', icon: 'document-text', route: '/client-overview/my-requests' },
    { label: 'الرسائل', icon: 'chat-bubble-left-ellipsis', route: '/client-overview/messages' },
    { label: 'المشاريع', icon: 'briefcase', route: '/client-overview/projects' },
    { label: 'السوق', icon: 'shopping-cart', route: '/client-overview/market' },
    { label: 'المالية', icon: 'currency-dollar', route: '/client-overview/finance' },
    { label: 'النزاعات', icon: 'exclamation-triangle', route: '/client-overview/disputes' }
  ];

  accountLinks = [
    { label: 'الملف الشخصي', icon: 'user', route: '/client-overview/profile' },
    { label: 'الإشعارات', icon: 'bell', route: '/client-overview/notifications' },
    { label: 'الإعدادات', icon: 'cog-6-tooth', route: '/client-overview/settings' },
    { label: 'المساعدة والدعم', icon: 'question-mark-circle', route: '/client-overview/support' }
  ];

  getIconSvg(iconName: string): string {
    // Custom SVG paths for Heroicons (Outline) mapping
    const icons: Record<string, string> = {
      'home': 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
      'plus-circle': 'M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z',
      'document-text': 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
      'chat-bubble-left-ellipsis': 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z',
      'briefcase': 'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z',
      'shopping-cart': 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z',
      'currency-dollar': 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      'exclamation-triangle': 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      'user': 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
      'bell': 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
      'cog-6-tooth': 'M10.342 3.84c.48-1.077 2.054-1.077 2.534 0l.163.366a2.25 2.25 0 001.996 1.312h.16c1.171 0 1.884 1.196 1.488 2.258l-.16.425a2.25 2.25 0 00.566 2.37l.322.308c.854.819.854 2.146 0 2.965l-.322.308a2.25 2.25 0 00-.566 2.37l.16.425c.396 1.062-.317 2.258-1.488 2.258h-.16a2.25 2.25 0 00-1.996 1.312l-.163.366c-.48 1.077-2.054 1.077-2.534 0l-.163-.366a2.25 2.25 0 00-1.996-1.312h-.16c-1.171 0-1.884-1.196-1.488-2.258l.16-.425a2.25 2.25 0 00-.566-2.37l-.322-.308c-.854-.819-.854-2.146 0-2.965l.322-.308a2.25 2.25 0 00.566-2.37l-.16-.425c-.396-1.062.317-2.258 1.488-2.258h.16a2.25 2.25 0 001.996-1.312l.163-.366z M12 15a3 3 0 100-6 3 3 0 000 6z',
      'question-mark-circle': 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z'
    };
    return icons[iconName] || '';
  }
}
