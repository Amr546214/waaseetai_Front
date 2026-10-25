import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { SaUnavailable } from '../shared/sa-unavailable/sa-unavailable';

/** The one clear place an admin account lands when it has no right to a page: it says WHY (not in the team, no permission given yet, suspended, this page not granted, cannot verify). */
@Component({
	selector: 'app-sa-no-access',
	standalone: true,
	imports: [SaUnavailable, RouterLink],
	template: `
		<app-sa-unavailable title="الوصول إلى لوحة الإدارة" [subtitle]="subtitle()" [heading]="text().heading" [reason]="text().reason">
			@if (reason() === 'unavailable') { <button type="button" class="sna-retry" data-testid="no-access-retry" (click)="retry()">إعادة المحاولة</button> }
			@if (canSeeHome()) { <a class="sna-home" routerLink="/supper-admin-overview" data-testid="no-access-home">العودة إلى لوحة التحكم</a> }
			<a class="sna-home" routerLink="/supper-admin-overview/my-account" data-testid="no-access-account">حسابي وأمان الدخول</a>
		</app-sa-unavailable>`,
	styles: [`.sna-retry,.sna-home{display:inline-flex;margin:14px 6px 0;padding:8px 18px;border-radius:999px;font-size:12.5px;font-weight:800;color:#2BD4C7;border:1px solid rgba(43,212,199,.3);background:transparent;text-decoration:none;font-family:inherit;cursor:pointer}`],
})
export class SaNoAccess {
	private route = inject(ActivatedRoute);
	private access = inject(AdminAccessService);
	reason = toSignal(this.route.queryParamMap.pipe(map(p => p.get('reason') ?? 'denied')), { initialValue: 'denied' });
	canSeeHome = computed(() => this.access.status() === 'ready' && (this.access.isOwner() || (this.access.access()?.permissions.length ?? 0) > 0));
	subtitle = computed(() => (this.access.displayRole() ? `دورك الحالي: ${this.access.displayRole()}` : ''));
	text = computed(() => {
		switch (this.reason()) {
			case 'SUSPENDED': return { heading: 'تم إيقاف وصولك إلى لوحة الإدارة', reason: 'أوقف مالك المنصة وصولك. لا تظهر لك بيانات الإدارة ولا يمكنك تنفيذ إجراءات فيها حتى يُعاد تفعيله. تواصل مع مالك المنصة.' };
			case 'NOT_IN_TEAM': return { heading: 'حسابك ليس ضمن فريق الإدارة بعد', reason: 'حسابك إداري لكن مالك المنصة لم يضمّه إلى الفريق ولم يمنحه دورًا. لا تظهر لك بيانات الإدارة قبل ذلك. تواصل مع مالك المنصة.' };
			case 'NO_PERMISSIONS': return { heading: 'لم تُمنح أي صلاحية بعد', reason: 'أنت ضمن الفريق لكن الدور المسند إليك لا يتضمن أي صلاحية حاليًا. يحدد مالك المنصة صلاحيات الدور وحده.' };
			case 'unavailable': return { heading: 'تعذّر التحقق من صلاحياتك الآن', reason: 'لم نتمكن من قراءة صلاحياتك من الخادم، فلم نعرض أي بيانات إدارية ولم يُنفَّذ أي إجراء. أعد المحاولة بعد قليل.' };
			default: return { heading: 'ليست لديك صلاحية لهذه الصفحة', reason: 'هذه الصفحة تحتاج صلاحية لم تُمنح لدورك. إن كنت تحتاجها فاطلبها من مالك المنصة؛ منح الصلاحيات حصري له.' };
		}
	});
	async retry() { await this.access.refresh(); }
}
