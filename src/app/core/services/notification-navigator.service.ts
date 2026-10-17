import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../store/auth.store';
import { AccountService } from './account.service';
import { NotificationEngineService } from './notification-engine.service';
import { UiNotificationService } from './ui-notification.service';
import { AccountType, UserRole } from '../models/auth.model';
import { resolveActiveRole } from '../routing/role-routes';

export type NotificationOpenResult = 'navigated' | 'role-switched' | 'no-destination' | 'role-unavailable' | 'blocked' | 'failed';

interface Openable { id: string; isUnread: boolean; actionUrl?: string | null }

const AREAS: Array<{ prefix: string; role: UserRole; label: string }> = [
	{ prefix: '/client-overview', role: UserRole.CLIENT, label: 'العميل' },
	{ prefix: '/provider-overview', role: UserRole.PROVIDER, label: 'مقدم الخدمة' },
	{ prefix: '/marketer-overview', role: UserRole.AFFILIATE, label: 'المسوّق' },
	{ prefix: '/supper-admin-overview', role: UserRole.SUPER_ADMIN, label: 'الإدارة' },
];
const areaOf = (url: string) => AREAS.find(a => url === a.prefix || url.startsWith(`${a.prefix}/`) || url.startsWith(`${a.prefix}?`));

/**
 * The ONE click behaviour of every notification surface (bell, toast, provider / client / marketer pages):
 *  - the destination opens EVERY time, read or unread, and the second click on the same notification opens it again;
 *  - marking it read happens only once the navigation succeeded, and is fire-and-forget: its failure (or slowness) never blocks or delays navigation;
 *  - clicking while already on that route re-runs the navigation (onSameUrlNavigation: 'reload') so the intended item / tab / query is applied; it only reads;
 *  - a destination in another role's area opens only if THIS account owns that role (the real switch API is called, no guard is bypassed); otherwise an honest reason;
 *  - a destination the router refuses (guard) or cannot open shows the reason instead of doing nothing.
 */
@Injectable({ providedIn: 'root' })
export class NotificationNavigator {
	private router = inject(Router);
	private auth = inject(AuthStore);
	private account = inject(AccountService);
	private engine = inject(NotificationEngineService);
	private ui = inject(UiNotificationService);

	async open(nt: Openable, hooks: { onMarkedRead?: () => void } = {}): Promise<NotificationOpenResult> {
		// Read only AFTER the destination really opened: a refused / failed / abandoned navigation leaves the row unread. Fire-and-forget (never delays the page).
		const markRead = () => {
			if (nt.isUnread && nt.id) {
				this.engine.markNotificationAsRead(nt.id).subscribe({ next: () => hooks.onMarkedRead?.(), error: () => { /* the destination is already open; the row stays unread */ } });
			}
		};
		const url = nt.actionUrl;
		if (!url) { this.ui.info('هذا الإشعار للاطلاع فقط ولا توجد صفحة مرتبطة به'); markRead(); return 'no-destination'; }

		const user = this.auth.currentUser();
		const target = areaOf(url);
		const activeRole = resolveActiveRole(user);
		const here = user?.accountType === AccountType.SUPER_ADMIN ? UserRole.SUPER_ADMIN : activeRole;
		// no signed-in user in this context: the route guards alone decide (nothing to compare a role against)
		if (user && target && target.role !== here) {
			const owned = (user?.roles ?? []).includes(target.role);
			if (!owned || target.role === UserRole.SUPER_ADMIN) {
				this.ui.warning(`هذا الإشعار يخص حساب ${target.label} وهو غير مفعّل لديك، لذلك لا يمكن فتحه.`);
				return 'role-unavailable';
			}
			this.ui.info(`سيتم التبديل إلى حساب ${target.label} لفتح هذا الإشعار`);
			return new Promise<NotificationOpenResult>(resolve => {
				this.account.switchActiveRole(target.role).subscribe({
					next: async () => {
						const ok = await this.go(url) === 'navigated';
						if (ok) markRead();
						resolve(ok ? 'role-switched' : 'blocked');
					},
					error: (err: any) => { this.ui.error(err?.error?.message || 'تعذر تبديل الحساب لفتح الإشعار'); resolve('failed'); }
				});
			});
		}
		const result = await this.go(url);
		if (result === 'navigated') markRead();
		return result;
	}

	private async go(url: string): Promise<NotificationOpenResult> {
		try {
			const ok = await this.router.navigateByUrl(url, { onSameUrlNavigation: 'reload' });
			if (ok === false) { this.ui.warning('لا يمكن فتح هذه الصفحة الآن: غير متاحة لحسابك أو لم تعد موجودة.'); return 'blocked'; }
			return 'navigated';
		} catch {
			this.ui.error('تعذر فتح الصفحة المرتبطة بهذا الإشعار.');
			return 'failed';
		}
	}
}
