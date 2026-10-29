import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	HostListener,
	ViewChild,
	ViewEncapsulation,
	afterNextRender,
	computed,
	effect,
	inject,
	signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssistantStore } from '../../core/store/assistant.store';
import { AuthStore } from '../../core/store/auth.store';
import { resolveActiveRole, roleLinks } from '../../core/routing/role-routes';
import { ThemeService } from '../../core/services/theme.service';
import { AssistantSettingsComponent } from '../../sheards/assistant-chat/assistant-settings';
import { assistantMarkdown, safeAssistantUrl } from '../../core/help/assistant-content';
import { AssistantReplyAudioComponent } from '../../sheards/assistant-chat/assistant-reply-audio';
import { IdentityImgDirective } from '../../core/identity/identity-img.directive';

@Component({
	selector: 'app-assistant-page',
	standalone: true,
	imports: [IdentityImgDirective, FormsModule, RouterLink, AssistantSettingsComponent, AssistantReplyAudioComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	encapsulation: ViewEncapsulation.None,
	styleUrl: './assistant-page.css',
	template: `
	<div class="chat-page chatgpt-shell workspace" [class.workspace--dark]="theme.theme() === 'dark'" [class.dark]="theme.theme() === 'dark'">
		@if (mobileOpen()) {
			<button type="button" class="tc-sidebar-scrim" (click)="mobileOpen.set(false)" aria-label="إغلاق الشريط الجانبي"></button>
		}

		<aside
			id="chat-session-sidebar"
			class="chat-sidebar tc-sidebar"
			[class.is-open]="mobileOpen()"
			[class.is-desktop-collapsed]="desktopCollapsed()"
			aria-label="المحادثات السابقة"
			dir="rtl"
		>
			<!-- Head: Brand & collapse toggles -->
			<div class="tc-sidebar-head">
				<div class="tc-rail-entry tc-brand-entry">
					<button
						type="button"
						class="tc-sidebar-brand"
						(click)="toggleDesktopCollapse()"
						aria-keyshortcuts="Control+Shift+S"
						[attr.aria-label]="desktopCollapsed() ? 'فتح قائمة المحادثات' : 'طي قائمة المحادثات'"
					>
						<img [wsIdentityImg]="'logo.mark'" src="/images/waseet-mark.png" alt="وسيط" />
						<svg data-ws-icon="pl-assistant-sidebar-collapse" class="tc-brand-toggle" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect width="18" height="18" x="3" y="3" rx="2" />
							<path d="M9 3v18M16 15l-3-3 3-3" />
						</svg>
						<strong>وسيط</strong>
					</button>
					<div class="tc-rail-tooltip" role="tooltip">الشريط الجانبي <kbd dir="ltr">Ctrl+Shift+S</kbd></div>
				</div>

				<button
					type="button"
					class="tc-icon-button tc-desktop-collapse"
					(click)="toggleDesktopCollapse()"
					aria-label="طي الشريط الجانبي"
				>
					<svg data-ws-icon="pl-assistant-sidebar-collapse" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<rect width="18" height="18" x="3" y="3" rx="2" />
						<path d="M9 3v18M16 15l-3-3 3-3" />
					</svg>
				</button>
				<button
					type="button"
					class="tc-icon-button tc-mobile-close"
					(click)="mobileOpen.set(false)"
					aria-label="إغلاق الشريط الجانبي"
				>
					<svg data-ws-icon="pl-assistant-x" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Navigation: New chat, Search, Pinned flyout, Recent flyout -->
			<nav class="tc-sidebar-nav" aria-label="أدوات المحادثة">
				<div class="tc-rail-entry">
					<button
						type="button"
						class="tc-nav-row"
						(click)="newConversation()"
						aria-keyshortcuts="Control+Shift+O"
						aria-label="محادثة جديدة"
					>
						<svg data-ws-icon="pl-assistant-edit-square" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
							<path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" />
						</svg>
						<span>محادثة جديدة</span>
					</button>
					<div class="tc-rail-tooltip" role="tooltip">محادثة جديدة <kbd dir="ltr">Ctrl+Shift+O</kbd></div>
				</div>

				<div class="tc-rail-entry">
					<button
						type="button"
						class="tc-nav-row"
						(click)="focusSearch()"
						aria-keyshortcuts="Control+K"
						aria-label="البحث في المحادثات"
					>
						<svg data-ws-icon="pl-assistant-search" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="11" cy="11" r="8" />
							<path d="m21 21-4.3-4.3" />
						</svg>
						<span>البحث في المحادثات</span>
					</button>
					<div class="tc-rail-tooltip" role="tooltip">بحث <kbd dir="ltr">Ctrl+K</kbd></div>
				</div>

				<div class="tc-rail-entry tc-rail-only" (mouseleave)="leaveRailPopover()">
					<button
						type="button"
						class="tc-nav-row"
						[class.is-active]="railPopover()?.kind === 'pinned'"
						aria-label="المحادثات المثبتة"
						aria-haspopup="menu"
						[attr.aria-expanded]="railPopover()?.kind === 'pinned'"
						(mouseenter)="openRailPopover('pinned', $event.currentTarget)"
						(click)="toggleRailPopover('pinned', $event.currentTarget)"
						(keydown.arrowDown)="openRailPopover('pinned', $event.currentTarget, true, true, $event)"
					>
						<svg data-ws-icon="pl-assistant-pin" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<line x1="12" x2="12" y1="17" y2="22" />
							<path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
						</svg>
						<span>المثبتة</span>
					</button>
					<div class="tc-rail-tooltip" role="tooltip">المثبتة</div>
				</div>

				<div class="tc-rail-entry tc-rail-only" (mouseleave)="leaveRailPopover()">
					<button
						type="button"
						class="tc-nav-row"
						[class.is-active]="railPopover()?.kind === 'recent'"
						aria-label="المحادثات الأخيرة"
						aria-haspopup="menu"
						[attr.aria-expanded]="railPopover()?.kind === 'recent'"
						(mouseenter)="openRailPopover('recent', $event.currentTarget)"
						(click)="toggleRailPopover('recent', $event.currentTarget)"
						(keydown.arrowDown)="openRailPopover('recent', $event.currentTarget, true, true, $event)"
					>
						<svg data-ws-icon="pl-assistant-chat-bubble" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
						</svg>
						<span>الأخيرة</span>
					</button>
					<div class="tc-rail-tooltip" role="tooltip">الأخيرة</div>
				</div>
			</nav>

			<!-- History expanded: Heading, filter input, list -->
			<div class="tc-history-head">
				<span>المحادثات</span>
				<button
					type="button"
					class="tc-icon-button"
					(click)="toggleSort()"
					[attr.aria-label]="sortOrder() === 'newest' ? 'ترتيب من الأقدم' : 'ترتيب من الأحدث'"
					[title]="sortOrder() === 'newest' ? 'الأحدث أولًا' : 'الأقدم أولًا'"
				>
					<svg data-ws-icon="pl-assistant-arrows-up-down" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="m3 16 4 4 4-4M7 20V4M21 8l-4-4-4 4M17 4v16" />
					</svg>
				</button>
			</div>

			<div class="tc-sidebar-filter">
				<svg data-ws-icon="pl-assistant-search" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="11" cy="11" r="8" />
					<path d="m21 21-4.3-4.3" />
				</svg>
				<input #searchInput [(ngModel)]="query" placeholder="تصفية المحادثات" aria-label="تصفية المحادثات" />
			</div>

			<div class="tc-history-list" tabindex="0">
				@for (conversation of filteredConversations(); track conversation.id) {
					<div class="tc-history-row" [class.is-active]="store.activeConversationId() === conversation.id">
						@if (renamingId() === conversation.id) {
							<form (ngSubmit)="saveRename(conversation.id)" class="rename">
								<input name="title" [(ngModel)]="renameDraft" maxlength="70" aria-label="اسم المحادثة" />
								<button type="submit">حفظ</button>
								<button type="button" (click)="renamingId.set(null)">إلغاء</button>
							</form>
						} @else {
							<button
								type="button"
								class="tc-history-select history-title"
								(click)="selectConversation(conversation.id)"
								[attr.aria-current]="store.activeConversationId() === conversation.id ? 'true' : null"
							>
								@if (conversation.pinned) {
									<svg data-ws-icon="pl-assistant-pin" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
									</svg>
								}
								<span>{{ conversation.title }}</span>
							</button>

							<button
								type="button"
								class="tc-icon-button tc-history-options"
								(click)="toggleSessionMenu(conversation.id, $event)"
								[attr.aria-label]="'خيارات المحادثة: ' + conversation.title"
								aria-haspopup="menu"
								[attr.aria-expanded]="menuSessionId() === conversation.id"
							>
								<svg data-ws-icon="pl-assistant-more-dots" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
								</svg>
							</button>
						}
					</div>
				} @empty {
					<p class="tc-history-empty empty-history">{{ query() ? 'لا توجد محادثات مطابقة.' : 'ستظهر محادثاتك هنا.' }}</p>
				}
			</div>

			<!-- Session Context Menu Popover -->
			@if (menuSessionId(); as sid) {
				<div
					class="tc-popover tc-history-menu"
					[style.top.px]="menuPos().top"
					[style.left.px]="menuPos().left"
					role="menu"
					aria-label="خيارات المحادثة"
				>
					<button type="button" role="menuitem" (click)="togglePin(sid); menuSessionId.set(null)">
						<svg data-ws-icon="pl-assistant-pin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
						</svg>
						<span>{{ isPinned(sid) ? 'إلغاء التثبيت' : 'تثبيت المحادثة' }}</span>
					</button>
					<button type="button" role="menuitem" (click)="promptRename(sid, currentSessionTitle(sid)); menuSessionId.set(null)">
						<svg data-ws-icon="pl-assistant-pencil" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
						</svg>
						<span>إعادة التسمية</span>
					</button>
					<button type="button" class="tc-danger" role="menuitem" (click)="confirmDelete(sid); menuSessionId.set(null)">
						<svg data-ws-icon="pl-assistant-trash" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />
						</svg>
						<span>حذف المحادثة</span>
					</button>
				</div>
			}

			<!-- Floating Rail Session Popover (Pinned / Recent in collapsed mode) -->
			@if (desktopCollapsed() && railPopover(); as pop) {
				<div
					#railPopoverElement
					class="tc-rail-session-popover"
					[style.top.px]="pop.top"
					role="menu"
					[attr.aria-label]="pop.kind === 'pinned' ? 'المحادثات المثبتة' : 'المحادثات الأخيرة'"
					(mouseenter)="keepRailPopover()"
					(mouseleave)="leaveRailPopover()"
					(keydown)="onRailPopoverKeydown($event)"
				>
					<span class="tc-rail-popover-caption">{{ pop.kind === 'pinned' ? 'المثبتة' : 'الأخيرة' }}</span>
					<div class="tc-rail-session-list">
						@for (session of railSessions(pop.kind); track session.id) {
							<button
								type="button"
								role="menuitem"
								[attr.aria-current]="session.id === store.activeConversationId() ? 'page' : null"
								(click)="selectConversation(session.id); closeRailPopover()"
							>
								{{ session.title }}
							</button>
						} @empty {
							<p>لا توجد محادثات {{ pop.kind === 'pinned' ? 'مثبتة' : 'محفوظة' }} بعد.</p>
						}
					</div>
				</div>
			}

			<!-- Footer: Data Actions & User Account -->
			<div class="tc-sidebar-footer sidebar-footer">
				<div class="tc-data-actions">
					<button type="button" (click)="exportHistory()" aria-label="تصدير نسخة من المحادثات">
						<svg data-ws-icon="pl-assistant-download-tray" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
						</svg>
						تصدير
					</button>
					<button type="button" (click)="importFileInput.click()" aria-label="استيراد المحادثات">
						<svg data-ws-icon="pl-assistant-upload-tray" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
						</svg>
						استيراد
					</button>
					<input #importFileInput type="file" hidden accept=".json,application/json" (change)="importHistory($event)" />
				</div>

				<button
					type="button"
					class="tc-profile-button"
					(click)="accountMenuOpen.set(!accountMenuOpen())"
					aria-label="الحساب والإعدادات"
					aria-haspopup="menu"
					[attr.aria-expanded]="accountMenuOpen()"
				>
					<span class="tc-avatar">{{ userInitial() }}</span>
					<span class="tc-profile-name">{{ userName() }}</span>
					<svg data-ws-icon="pl-assistant-more-dots" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
					</svg>
				</button>

				@if (accountMenuOpen()) {
					<button type="button" class="tc-menu-scrim" (click)="accountMenuOpen.set(false)" aria-label="إغلاق قائمة الحساب"></button>
					<div class="tc-popover tc-account-menu" role="menu" aria-label="قائمة الحساب">
						<div class="tc-account-heading">
							<span class="tc-avatar">{{ userInitial() }}</span>
							<div>
								<strong>{{ userName() }}</strong>
								<small>{{ userEmail() }}</small>
							</div>
						</div>
						<div class="tc-account-section">
							<button type="button" role="menuitem" (click)="settingsOpen.set(true); accountMenuOpen.set(false)">
								<svg data-ws-icon="pl-assistant-gear" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="3" />
									<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
								</svg>
								<span>الإعدادات</span>
							</button>
							<button type="button" role="menuitem" (click)="theme.toggleTheme()">
								<svg data-ws-icon="pl-assistant-sun" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="4" />
									<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
								</svg>
								<span>{{ theme.theme() === 'dark' ? 'مظهر فاتح' : 'مظهر داكن' }}</span>
							</button>
							<a [routerLink]="links().home" role="menuitem" (click)="accountMenuOpen.set(false)">
								<svg data-ws-icon="ud-home" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
									<polyline points="9 22 9 12 15 12 15 22" />
								</svg>
								<span>لوحة التحكم ↗</span>
							</a>
						</div>
					</div>
				}
			</div>
		</aside>

		<!-- Main Workspace Area -->
		<main class="tc-main main" dir="rtl">
			<!-- Topbar: Hamburger toggle, single central tab «المحادثة · نديم», share button, ⋯ menu -->
			<header class="tc-topbar">
				<div class="tc-topbar-start">
					<button
						type="button"
						class="tc-icon-button tc-sidebar-open"
						(click)="mobileOpen.set(true)"
						aria-label="فتح قائمة المحادثات"
					>
						<svg data-ws-icon="i-menu" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<line x1="3" y1="12" x2="21" y2="12" />
							<line x1="3" y1="6" x2="21" y2="6" />
							<line x1="3" y1="18" x2="21" y2="18" />
						</svg>
					</button>
				</div>

				<nav class="tc-workspace-tabs" aria-label="مساحة المساعد">
					<button type="button" class="is-selected" aria-current="page">{{ 'المحادثة · ' + store.characterName() }}</button>
				</nav>

				<div class="tc-topbar-actions">
					<button
						type="button"
						class="tc-share-button"
						(click)="shareConversation()"
						[disabled]="!store.messages().length"
						aria-label="مشاركة المحادثة"
					>
						<svg data-ws-icon="ws-share" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
							<line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
						</svg>
						<span>مشاركة</span>
					</button>

					<div class="tc-header-menu">
						<button
							type="button"
							class="tc-icon-button"
							(click)="topbarMenuOpen.set(!topbarMenuOpen())"
							aria-label="خيارات المحادثة"
							aria-haspopup="menu"
							[attr.aria-expanded]="topbarMenuOpen()"
						>
							<svg data-ws-icon="pl-assistant-more-dots" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
								<circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
							</svg>
						</button>

						@if (topbarMenuOpen()) {
							<button type="button" class="tc-menu-scrim" (click)="topbarMenuOpen.set(false)" aria-label="إغلاق قائمة الخيارات"></button>
							<div class="tc-popover tc-model-menu" role="menu" aria-label="أدوات المحادثة">
								<div class="tc-menu-caption">{{ currentTitle() }}</div>
								<button role="menuitem" type="button" (click)="printConversation(); topbarMenuOpen.set(false)" [disabled]="!store.messages().length">
									<svg data-ws-icon="pl-assistant-printer" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="6 9 6 2 18 2 18 9" />
										<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
										<rect x="6" y="14" width="12" height="8" />
									</svg>
									<span>طباعة المحادثة</span>
								</button>
								<button role="menuitem" type="button" (click)="saveText(); topbarMenuOpen.set(false)" [disabled]="!store.messages().length">
									<svg data-ws-icon="pl-assistant-download-tray" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
									</svg>
									<span>حفظ TXT</span>
								</button>
								<button role="menuitem" type="button" (click)="shareConversation(); topbarMenuOpen.set(false)" [disabled]="!store.messages().length">
									<svg data-ws-icon="ws-share" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
										<line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
									</svg>
									<span>مشاركة المحادثة</span>
								</button>
								<button role="menuitem" type="button" (click)="settingsOpen.set(true); topbarMenuOpen.set(false)">
									<svg data-ws-icon="pl-assistant-gear" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<circle cx="12" cy="12" r="3" />
										<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
									</svg>
									<span>إعدادات المحادثة</span>
								</button>
							</div>
						}
					</div>
				</div>
			</header>

			<!-- Chat Column: Message list & empty welcome screen -->
			<div class="tc-chat-column" [class.is-empty]="isEmpty()">
				<div class="tc-conversation-area" [class.is-empty]="isEmpty()">
					<div #messagesBox class="tc-messages" role="log" aria-label="سجل المحادثة" tabindex="0" aria-live="off" (scroll)="onMessagesScroll()">
						<div class="tc-message-column">
							@if (isEmpty()) {
								<section class="tc-welcome" aria-labelledby="assistant-welcome">
									<h1 id="assistant-welcome">أهلًا بك، كيف يمكنني مساعدتك؟</h1>
								</section>
							} @else {
								<div class="tc-turns">
									@for (m of store.messages(); track $index) {
										@if (m.role === 'user') {
											<div class="tc-user-turn">
												<div class="tc-user-turn-inner">
													<div class="tc-user-bubble" dir="auto">{{ m.text }}</div>
													<div class="tc-user-actions">
														<button type="button" (click)="copy(m.text)">نسخ</button>
														<button type="button" (click)="beginEdit($index, m.text)" [disabled]="store.busy()">تعديل</button>
													</div>
													@if (editingIndex() === $index) {
														<div class="tc-user-edit">
															<div class="tc-edit-card">
																<textarea [(ngModel)]="editDraft" rows="3" aria-label="تعديل رسالتك"></textarea>
																<div class="dialog-actions">
																	<button type="button" (click)="submitEdit()" [disabled]="!editDraft.trim() || store.busy()">حفظ وإعادة الإرسال</button>
																	<button type="button" (click)="editingIndex.set(-1)">إلغاء</button>
																</div>
															</div>
														</div>
													}
												</div>
											</div>
										} @else {
											<div class="tc-assistant-turn">
												<div class="tc-assistant-content">
													<div class="tc-markdown" [innerHTML]="formatAssistantMarkdown(m.text)"></div>
													@if (m.streaming) { <span class="ac__cursor" aria-hidden="true"></span> }
												</div>
												<app-assistant-reply-audio [text]="m.text" [complete]="!m.streaming" />
												@if (m.citations?.length) {
													<div class="tc-artifacts">
														<div class="tc-artifact-heading"><span>المصادر:</span></div>
														<div class="tc-artifact-buttons">
															@for (c of m.citations; track c.docId + c.title) {
																@if (sourceUrl(c.url); as url) {
																	<a [href]="url" target="_blank" rel="noopener noreferrer">{{ c.title }}{{ c.section ? ' · ' + c.section : '' }}</a>
																} @else {
																	<span>{{ c.title }}</span>
																}
															}
														</div>
													</div>
												}
												@if (!m.streaming) {
													<div class="tc-assistant-actions">
														<button type="button" (click)="copy(m.text)">نسخ الرد</button>
														@if ($last) {
															<button type="button" (click)="store.regenerate()" [disabled]="store.busy()">إعادة الرد</button>
														}
													</div>
												}
											</div>
										}
									}

									@if (store.busy() && !store.streaming()) {
										<div class="tc-assistant-turn">
											<div class="ac__typing" aria-label="المساعد يفكر">
												<span></span><span></span><span></span>
											</div>
										</div>
									}

									@if (store.errorMessage()) {
										<div class="tc-assistant-turn tc-error-turn" role="alert">
											<div class="tc-error-content">
												<svg data-ws-icon="pl-assistant-alert-circle" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" class="tc-error-icon" aria-hidden="true">
													<circle cx="12" cy="12" r="10" />
													<line x1="12" y1="8" x2="12" y2="12" />
													<line x1="12" y1="16" x2="12.01" y2="16" />
												</svg>
												<span class="tc-error-text">{{ store.errorMessage() }}</span>
											</div>
											<div class="tc-assistant-actions tc-error-actions">
												@if (store.lastQuestion()) {
													<button type="button" (click)="store.retry()">إعادة المحاولة</button>
												}
												@if (store.humanSupportFallback() && store.supportRoute()) {
													<a [routerLink]="store.supportRoute()" class="tc-support-link">التواصل مع الدعم البشري</a>
												}
											</div>
										</div>
									}
								</div>
							}
						</div>
					</div>
				</div>

				@if (showJumpToLatest()) {
					<button type="button" class="tc-jump-latest" (click)="scrollToLatest()" aria-label="الانتقال إلى أحدث رسالة">↓ أحدث رسالة</button>
				}

				<!-- Docked rounded composer container with 3-column Grid LTR -->
				<div class="chat-composer-wrap tc-composer-dock">
					<div class="tc-composer">
						<div class="tc-composer-controls">
							<!-- Column 1: + tools menu with ONLY File Attachment and Web Search -->
							<div class="tc-composer-tools">
								<div class="tc-tools-anchor">
									<button
										type="button"
										class="tc-icon-button"
										[class.is-active]="toolsOpen()"
										(click)="toolsOpen.set(!toolsOpen())"
										aria-label="إرفاق ملفات وأدوات"
										aria-haspopup="menu"
										[attr.aria-expanded]="toolsOpen()"
									>
										<svg data-ws-icon="pl-assistant-plus" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M5 12h14M12 5v14" />
										</svg>
									</button>

									@if (toolsOpen()) {
										<div class="tc-popover tc-tools-menu" role="menu" aria-label="أدوات المساعد">
											<button type="button" role="menuitem" (click)="fileInput.click(); toolsOpen.set(false)" [disabled]="store.busy()">
												<svg data-ws-icon="pl-assistant-paperclip" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
													<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
												</svg>
												<span>إرفاق ملف</span>
											</button>
											<button type="button" role="menuitem" (click)="toggleWebSearch(); toolsOpen.set(false)">
												<svg data-ws-icon="pl-assistant-globe" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
													<circle cx="12" cy="12" r="10" />
													<path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" />
												</svg>
												<span>بحث مباشر في الإنترنت</span>
											</button>
										</div>
									}
									<input #fileInput type="file" hidden accept=".csv,.xlsx,.pdf,.docx,.txt" (change)="onFileSelected($event)" />
								</div>
							</div>

							<!-- Column 2: Auto-expanding textarea -->
							<textarea
								#composerTextarea
								id="user-input"
								[ngModel]="promptText()"
								(ngModelChange)="promptText.set($event)"
								(input)="resizeComposer()"
								(keydown)="onKeydown($event)"
								rows="1"
								placeholder="اسأل نديم عن خدمات وسيط أو استفسر عن مشروعك..."
								dir="auto"
								aria-label="اكتب رسالتك"
								[disabled]="store.busy()"
							></textarea>

							<!-- Column 3: Microphone & circular send button -->
							<div class="tc-composer-actions">
								<button
									type="button"
									class="tc-icon-button"
									[class.is-recording]="store.micActive()"
									(click)="store.toggleListening()"
									[attr.aria-pressed]="store.micActive()"
									aria-label="إملاء صوتي"
								>
									<svg data-ws-icon="pl-assistant-mic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
										<path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
									</svg>
								</button>

								@if (store.busy()) {
									<button type="button" class="tc-send-button" (click)="store.cancel()" aria-label="إيقاف التوليد">
										<svg data-ws-icon="pl-assistant-square" viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
											<rect width="18" height="18" x="3" y="3" rx="2" />
										</svg>
									</button>
								} @else if (!promptText().trim() && store.micActive()) {
									<button type="button" class="tc-send-button" (click)="store.toggleListening()" aria-label="إنهاء المحادثة الصوتية">
										<svg data-ws-icon="pl-assistant-waveform" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M2 10v3M6 6v11M10 3v18M14 8v7M18 5v13M22 10v3" />
										</svg>
									</button>
								} @else {
									<button
										type="button"
										class="tc-send-button"
										(click)="sendPrompt()"
										[disabled]="!promptText().trim()"
										aria-label="إرسال الرسالة"
									>
										<svg data-ws-icon="pl-assistant-arrow-up" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="m5 12 7-7 7 7M12 19V5" />
										</svg>
									</button>
								}
							</div>
						</div>
					</div>

					<p class="tc-composer-caption">قد يخطئ المساعد. راجع المعلومات قبل اتخاذ القرار.</p>
				</div>

				<!-- 3 Waseet suggestion cards directly beneath composer dock when empty -->
				@if (isEmpty()) {
					<div class="tc-welcome-suggestions">
						<button type="button" (click)="sendSuggestion('ما الفرق بين العربون وحساب الضمان في منصة وسيط؟')" [disabled]="store.busy()">
							<span class="icon">🛡️</span>
							<span>ما الفرق بين العربون وحساب الضمان في منصة وسيط؟</span>
						</button>
						<button type="button" (click)="sendSuggestion('ساعدني أكتب طلب خدمة واضح لمقدمي الخدمات في وسيط')" [disabled]="store.busy()">
							<span class="icon">📄</span>
							<span>ساعدني أكتب طلب خدمة واضح لمقدمي الخدمات في وسيط</span>
						</button>
						<button type="button" (click)="sendSuggestion('ما خطوات توثيق الحساب وضمان حقوق الطرفين في المنصة؟')" [disabled]="store.busy()">
							<span class="icon">✅</span>
							<span>ما خطوات توثيق الحساب وضمان حقوق الطرفين في المنصة؟</span>
						</button>
					</div>
				}
			</div>

			@if (notice()) {
				<p class="page-notice" role="status">{{ notice() }}</p>
			}
		</main>

		<!-- Dialogs: Assistant Settings Modal & Delete Confirmation Dialog -->
		@if (settingsOpen()) {
			<div class="modal-backdrop tc-settings-backdrop" (click)="settingsOpen.set(false)">
				<section class="modal tc-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title" dir="rtl" (click)="$event.stopPropagation()">
					<header>
						<h2 id="settings-dialog-title">إعدادات المساعد</h2>
						<button type="button" class="icon" (click)="settingsOpen.set(false)" aria-label="إغلاق">×</button>
					</header>
					<app-assistant-settings />
				</section>
			</div>
		}

		@if (deletingId()) {
			<div class="modal-backdrop" (click)="deletingId.set(null)">
				<section class="modal" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" dir="rtl" (click)="$event.stopPropagation()">
					<header>
						<h2 id="delete-dialog-title">حذف المحادثة</h2>
						<button type="button" class="icon" (click)="deletingId.set(null)" aria-label="إغلاق">×</button>
					</header>
					<p>سيُحذف سجل هذه المحادثة من هذا الجهاز.</p>
					<div class="dialog-actions">
						<button type="button" (click)="executeDelete()">حذف المحادثة</button>
						<button type="button" (click)="deletingId.set(null)">إلغاء</button>
					</div>
				</section>
			</div>
		}
	</div>
	`
})
export class AssistantPageComponent {
	readonly store = inject(AssistantStore);
	readonly auth = inject(AuthStore);
	readonly theme = inject(ThemeService);

	// Layout & view signals
	readonly desktopCollapsed = signal(false);
	readonly mobileOpen = signal(false);
	readonly settingsOpen = signal(false);
	readonly deletingId = signal<string | null>(null);
	readonly renamingId = signal<string | null>(null);
	readonly menuSessionId = signal<string | null>(null);
	readonly menuPos = signal<{ top: number; left: number }>({ top: 0, left: 0 });
	readonly accountMenuOpen = signal(false);
	readonly topbarMenuOpen = signal(false);
	readonly toolsOpen = signal(false);
	readonly notice = signal('');

	// Rail popover state with 180ms hover grace period
	readonly railPopover = signal<{
		kind: 'pinned' | 'recent';
		top: number;
		sticky: boolean;
	} | null>(null);
	private railCloseTimer: ReturnType<typeof setTimeout> | null = null;

	// Conversation filtering & sorting
	readonly query = signal('');
	readonly sortOrder = signal<'newest' | 'oldest'>('newest');
	renameDraft = '';

	// Composer state
	readonly promptText = signal('');
	readonly editingIndex = signal(-1);
	readonly showJumpToLatest = signal(false);
	private followingLatest = true;
	editDraft = '';

	// Computed properties
	readonly isEmpty = computed(() => this.store.messages().length === 0 && !this.store.busy());
	readonly currentTitle = computed(() => this.store.activeConversation()?.title || 'محادثة جديدة');
	readonly userInitial = computed(() => (this.auth.currentUser()?.firstName || 'ح')[0].toUpperCase());
	readonly userName = computed(() => this.auth.currentUser()?.firstName || 'حسابك');
	readonly userEmail = computed(() => this.auth.currentUser()?.email || '');
	readonly links = computed(() => roleLinks(resolveActiveRole(this.auth.currentUser())));

	readonly filteredConversations = computed(() => {
		const q = this.query().trim().toLocaleLowerCase();
		return this.store.conversations()
			.filter(c => !q || c.title.toLocaleLowerCase().includes(q) || c.messages.some(m => m.text.toLocaleLowerCase().includes(q)))
			.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (this.sortOrder() === 'oldest' ? a.updatedAt - b.updatedAt : b.updatedAt - a.updatedAt));
	});

	@ViewChild('composerTextarea') composerTextarea?: ElementRef<HTMLTextAreaElement>;
	@ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
	@ViewChild('messagesBox') messagesBox?: ElementRef<HTMLDivElement>;
	@ViewChild('railPopoverElement') railPopoverElement?: ElementRef<HTMLDivElement>;

	constructor() {
		this.store.panelOpen.set(false);
		this.store.loadCapabilities();
		let conversationId = this.store.activeConversationId();
		let userMessageCount = this.store.messages().filter(message => message.role === 'user').length;
		effect(() => {
			const messages = this.store.messages();
			this.store.errorMessage();
			this.store.busy();
			const id = this.store.activeConversationId();
			const count = messages.filter(message => message.role === 'user').length;
			if (id !== conversationId || count > userMessageCount) {
				this.followingLatest = true;
				this.showJumpToLatest.set(false);
			}
			conversationId = id;
			userMessageCount = count;
			queueMicrotask(() => {
				const box = this.messagesBox?.nativeElement;
				if (box && this.followingLatest) {
					box.scrollTop = box.scrollHeight;
				}
			});
		});
		afterNextRender(() => {
			if (typeof window !== 'undefined' && window.innerWidth < 768) {
				this.mobileOpen.set(false);
			}
		});
	}

	@HostListener('window:keydown', ['$event'])
	onGlobalKeydown(event: KeyboardEvent): void {
		const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
		const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

		// Ctrl+Shift+S (or Cmd+Shift+S): toggle desktop collapse
		if (cmdOrCtrl && event.shiftKey && event.key.toLowerCase() === 's') {
			event.preventDefault();
			this.toggleDesktopCollapse();
			return;
		}

		// Ctrl+Shift+O (or Cmd+Shift+O): new conversation
		if (cmdOrCtrl && event.shiftKey && event.key.toLowerCase() === 'o') {
			event.preventDefault();
			this.newConversation();
			return;
		}

		// Ctrl+K (or Cmd+K): focus search
		if (cmdOrCtrl && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			this.focusSearch();
			return;
		}

		// Escape: close open popovers, context menus, and dialogs
		if (event.key === 'Escape') {
			this.closeAllDialogs();
			return;
		}
	}

	toggleDesktopCollapse(): void {
		this.closeRailPopover();
		this.desktopCollapsed.update(v => !v);
	}

	newConversation(): void {
		this.store.newConversation();
		this.promptText.set('');
		this.resizeComposer();
		if (typeof window !== 'undefined' && window.innerWidth <= 767) {
			this.mobileOpen.set(false);
		}
		setTimeout(() => this.composerTextarea?.nativeElement?.focus(), 50);
	}

	selectConversation(id: string): void {
		if (this.store.selectConversation(id)) {
			if (typeof window !== 'undefined' && window.innerWidth <= 767) {
				this.mobileOpen.set(false);
			}
		}
	}

	focusSearch(): void {
		if (this.desktopCollapsed()) {
			this.desktopCollapsed.set(false);
		}
		setTimeout(() => {
			this.searchInput?.nativeElement?.focus();
			this.searchInput?.nativeElement?.select();
		}, 60);
	}

	toggleSort(): void {
		this.sortOrder.update(s => s === 'newest' ? 'oldest' : 'newest');
	}

	// ── Rail Popover Management (Pinned / Recent with 180ms hover grace timer) ──
	openRailPopover(kind: 'pinned' | 'recent', trigger: EventTarget | HTMLElement | null, keyboard = false, sticky = false, event?: Event): void {
		if (event) event.preventDefault();
		if (!this.desktopCollapsed() || (typeof window !== 'undefined' && window.innerWidth < 768)) return;
		this.keepRailPopover();
		const el = trigger as HTMLElement;
		const rect = el ? el.getBoundingClientRect() : { top: 100 };
		const windowH = typeof window !== 'undefined' ? window.innerHeight : 800;
		const top = Math.max(12, Math.min(rect.top - 5, windowH - 400));
		this.railPopover.set({ kind, top, sticky });

		if (keyboard) {
			setTimeout(() => {
				const firstBtn = this.railPopoverElement?.nativeElement?.querySelector<HTMLButtonElement>('button');
				firstBtn?.focus();
			}, 30);
		}
	}

	toggleRailPopover(kind: 'pinned' | 'recent', trigger: EventTarget | HTMLElement | null): void {
		const current = this.railPopover();
		if (current?.kind === kind && current.sticky) {
			this.closeRailPopover();
		} else {
			this.openRailPopover(kind, trigger, true, true);
		}
	}

	keepRailPopover(): void {
		if (this.railCloseTimer) {
			clearTimeout(this.railCloseTimer);
			this.railCloseTimer = null;
		}
	}

	leaveRailPopover(): void {
		if (!this.railPopover()?.sticky) {
			this.railCloseTimer = setTimeout(() => this.closeRailPopover(), 180);
		}
	}

	closeRailPopover(): void {
		if (this.railCloseTimer) {
			clearTimeout(this.railCloseTimer);
			this.railCloseTimer = null;
		}
		this.railPopover.set(null);
	}

	railSessions(kind: 'pinned' | 'recent'): any[] {
		if (kind === 'pinned') {
			return this.store.conversations().filter(c => c.pinned);
		}
		return [...this.store.conversations()].sort((a, b) => b.updatedAt - a.updatedAt);
	}

	onRailPopoverKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			this.closeRailPopover();
			return;
		}
		const el = this.railPopoverElement?.nativeElement;
		if (!el) return;
		const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('button'));
		if (!buttons.length) return;
		const index = buttons.indexOf(document.activeElement as HTMLButtonElement);

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			const next = buttons[(index + 1) % buttons.length];
			next?.focus();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			const prev = buttons[(index - 1 + buttons.length) % buttons.length];
			prev?.focus();
		} else if (event.key === 'Home') {
			event.preventDefault();
			buttons[0]?.focus();
		} else if (event.key === 'End') {
			event.preventDefault();
			buttons[buttons.length - 1]?.focus();
		}
	}

	// ── Session Context Menu (Pin / Rename / Delete) ──────────────────────────
	toggleSessionMenu(sessionId: string, event: MouseEvent): void {
		event.stopPropagation();
		if (this.menuSessionId() === sessionId) {
			this.menuSessionId.set(null);
		} else {
			const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
			const windowW = typeof window !== 'undefined' ? window.innerWidth : 1200;
			const windowH = typeof window !== 'undefined' ? window.innerHeight : 800;
			this.menuPos.set({
				top: Math.min(rect.bottom + 6, windowH - 170),
				left: Math.min(windowW - 224, Math.max(12, rect.left - 188))
			});
			this.menuSessionId.set(sessionId);
		}
	}

	isPinned(sessionId: string): boolean {
		return !!this.store.conversations().find(c => c.id === sessionId)?.pinned;
	}

	currentSessionTitle(sessionId: string): string {
		return this.store.conversations().find(c => c.id === sessionId)?.title || '';
	}

	togglePin(sessionId: string): void {
		this.store.pinConversation(sessionId);
	}

	promptRename(id: string, currentTitle = ''): void {
		this.renamingId.set(id);
		this.renameDraft = currentTitle || this.currentSessionTitle(id);
	}

	startRename(id: string, currentTitle = ''): void {
		this.promptRename(id, currentTitle);
	}

	saveRename(id: string): void {
		if (this.renameDraft.trim()) {
			this.store.renameConversation(id, this.renameDraft.trim());
			this.renamingId.set(null);
		}
	}

	rename(id: string): void {
		this.saveRename(id);
	}

	confirmDelete(id: string): void {
		this.deletingId.set(id);
	}

	executeDelete(): void {
		const id = this.deletingId();
		if (id) {
			this.store.deleteConversation(id);
			this.deletingId.set(null);
		}
	}

	deleteConversation(): void {
		this.executeDelete();
	}

	// ── Composer & Messaging ──────────────────────────────────────────────────
	onMessagesScroll(): void {
		const box = this.messagesBox?.nativeElement;
		this.followingLatest = !box || box.scrollHeight - box.scrollTop - box.clientHeight < 64;
		this.showJumpToLatest.set(!this.followingLatest);
	}

	scrollToLatest(): void {
		this.followingLatest = true;
		this.showJumpToLatest.set(false);
		const box = this.messagesBox?.nativeElement;
		if (box) box.scrollTop = box.scrollHeight;
	}

	sendPrompt(): void {
		const text = this.promptText().trim();
		if (!text || this.store.busy()) return;
		if (!this.store.ask(text)) return;
		this.promptText.set('');
		this.resizeComposer();
		this.scrollToLatest();
	}

	sendSuggestion(text: string): void {
		if (this.store.busy()) return;
		if (this.store.ask(text)) this.scrollToLatest();
	}

	resizeComposer(): void {
		const ta = this.composerTextarea?.nativeElement;
		if (!ta) return;
		ta.style.height = '0px';
		ta.style.height = `${Math.min(Math.max(ta.scrollHeight, 28), 190)}px`;
	}

	onKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter' && !event.shiftKey) {
			if ((event as any).isComposing) return;
			event.preventDefault();
			this.sendPrompt();
		}
	}

	toggleWebSearch(): void {
		this.store.webSearchEnabled.update(v => !v);
		this.showNotice(this.store.webSearchEnabled() ? 'تم تفعيل البحث المباشر في الويب.' : 'تم إيقاف البحث المباشر في الويب.');
	}

	onFileSelected(event: Event): void {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		this.showNotice(`تم إرفاق الملف: ${file.name}`);
		input.value = '';
	}

	beginEdit(index: number, text: string): void {
		this.editingIndex.set(index);
		this.editDraft = text;
	}

	submitEdit(): void {
		const idx = this.editingIndex();
		const text = this.editDraft.trim();
		if (idx >= 0 && text && !this.store.busy()) {
			if (this.store.editMessage(idx, text)) {
				this.editingIndex.set(-1);
				this.scrollToLatest();
			}
		}
	}

	copy(text: string): void {
		if (typeof navigator !== 'undefined' && navigator.clipboard) {
			void navigator.clipboard.writeText(text).then(() => {
				this.showNotice('تم النسخ إلى الحافظة.');
			});
		}
	}

	formatAssistantMarkdown(text: string): string {
		return assistantMarkdown(text);
	}

	sourceUrl(url: string | undefined): string | null {
		return url ? safeAssistantUrl(url) : null;
	}

	// ── Topbar Actions ────────────────────────────────────────────────────────
	private textConversation(): string {
		return this.store.messages()
			.filter(m => !m.streaming)
			.map(m => `${m.role === 'user' ? 'أنت' : this.store.characterName()}:\n${m.text}`)
			.join('\n\n');
	}

	async shareConversation(): Promise<void> {
		try {
			if (typeof navigator !== 'undefined' && navigator.clipboard) {
				await navigator.clipboard.writeText(this.textConversation());
				this.showNotice('تم نسخ المحادثة؛ يمكنك مشاركتها.');
			}
		} catch {
			this.showNotice('تعذر النسخ. استخدم حفظ TXT.');
		}
	}

	private download(content: string, filename: string, type: string): void {
		const url = URL.createObjectURL(new Blob([content], { type }));
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	saveText(): void {
		this.download(this.textConversation(), 'waseet-chat.txt', 'text/plain;charset=utf-8');
	}

	printConversation(): void {
		if (typeof window !== 'undefined') {
			window.print();
		}
	}

	exportHistory(): void {
		this.download(JSON.stringify(this.store.exportHistory(), null, 2), 'waseet-assistant-history.json', 'application/json');
	}

	async importHistory(event: Event): Promise<void> {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			if (file.size > 3_000_000) throw new Error('large');
			const value = JSON.parse(await file.text());
			this.showNotice(this.store.importHistory(value) ? 'تم استيراد المحادثات.' : 'لا توجد محادثات صالحة في الملف.');
		} catch {
			this.showNotice('تعذر استيراد الملف. اختر سجل محادثات JSON صالحًا أصغر من 3 ميجابايت.');
		} finally {
			input.value = '';
		}
	}

	private showNotice(msg: string): void {
		this.notice.set(msg);
		setTimeout(() => {
			if (this.notice() === msg) this.notice.set('');
		}, 3500);
	}

	closeAllDialogs(): void {
		this.closeRailPopover();
		this.menuSessionId.set(null);
		this.accountMenuOpen.set(false);
		this.topbarMenuOpen.set(false);
		this.toolsOpen.set(false);
		this.settingsOpen.set(false);
		this.deletingId.set(null);
		this.renamingId.set(null);
	}

	closeDialogs(): void {
		this.closeAllDialogs();
	}
}
