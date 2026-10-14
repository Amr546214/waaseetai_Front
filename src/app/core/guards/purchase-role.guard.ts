import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../store/auth.store';
import { NotificationEngineService } from '../services/notification-engine.service';

/**
 * Cart, checkout and payment belong to the CLIENT role: a user who is ACTING as a provider can browse the marketplace but never reaches these pages (nor the client wallet balance used for paying).
 * Guests pass (the auth guard / login handles them); the server answers 403 as well.
 */
export const purchaseRoleGuard: CanActivateFn = () => {
	const auth = inject(AuthStore);
	if (auth.canPurchase()) return true;
	inject(NotificationEngineService).triggerToast({ title: 'الشراء من حساب طالب الخدمة', message: 'بدّل إلى حساب طالب الخدمة لإتمام الشراء.' });
	return inject(Router).createUrlTree(['/marketplace']);
};
