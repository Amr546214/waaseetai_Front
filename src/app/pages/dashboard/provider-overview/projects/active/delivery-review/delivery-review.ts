import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ActiveProjectsService } from '../../../../../../core/services/active.service';
import { AuthStore } from '../../../../../../core/store/auth.store';
import { AccountType } from '../../../../../../core/models/auth.model';
import { MessageContext } from '../../../../../../core/services/chat.service';
import { UiNotificationService } from '../../../../../../core/services/ui-notification.service';
import { formatMoney } from '../../../../../../core/utils/money.util';
import { stageHeading } from '../../../../../../core/utils/stage-title.util';
import { deliveryFileOpenUrl, deliveryFileDownloadUrl, LEGACY_FILE_NOTE } from '../../../../../../core/utils/delivery-file.util';

/**
 * Final delivery & project closure review.
 *
 * For an individual provider this is a read-only summary of the whole
 * project's stages/payments plus the final stage's delivery — the provider
 * waits for the client's approval to release the last payment and close
 * the project (there is no dedicated "approve" action here; that belongs
 * to the client).
 *
 * For a provider COMPANY user this instead renders a manager-oversight
 * view of the same final delivery: who on the team submitted it directly
 * to the client, plus manager-only follow-up actions (message the client,
 * or return the delivery to the team member with notes). No backend
 * endpoint exists yet for the "return to team member" action, so it is
 * handled as a local, display-only confirmation.
 */
@Component({
	selector: 'app-delivery-review',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './delivery-review.html',
	styleUrl: './delivery-review.css',
})
export class DeliveryReview implements OnInit {
	private service = inject(ActiveProjectsService);
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private authStore = inject(AuthStore);
	private notify = inject(UiNotificationService);

	isCompanyMode = computed<boolean>(() => {
		const user = this.authStore.currentUser();
		return user?.accountType === AccountType.PROVIDER_COMPANY;
	});

	projectId = signal<string>('');
	projectData = signal<any>(null);
	loading = signal<boolean>(true);
	error = signal<string>('');

	returnNote = signal<string>('');
	returnPriority = signal<'normal' | 'urgent'>('normal');
	showReturnModal = signal<boolean>(false);
	returnError = signal<string>('');

	stages = computed<any[]>(() => this.projectData()?.stages || []);
	finalStage = computed<any>(() => {
		const list = this.stages();
		return list.length ? list[list.length - 1] : null;
	});
	completedStages = computed<any[]>(() => this.stages().filter(s => s.isDone || s.status === 'completed'));

	// === Server lifecycle (single source of truth: state, closure, per-action eligibility, financial summary) ===
	lifecycle = computed<any>(() => this.projectData()?.lifecycle ?? null);
	financial = computed<any>(() => this.projectData()?.financial ?? null);
	/** Closed by a dispute settlement: not completed, not waiting for the client, nothing to deliver. */
	settled = computed<boolean>(() => this.projectData()?.closedBySettlement === true);
	/** Completed by delivery approval (all stages approved) as the server reports it; an older backend falls back to the stage list. */
	completedByDelivery = computed<boolean>(() => {
		const d = this.projectData();
		if (d && typeof d.completedByDelivery === 'boolean') return d.completedByDelivery;
		return this.stages().length > 0 && this.stages().every(s => s.isDone || s.status === 'completed');
	});
	canUpload = computed<boolean>(() => { const e = this.projectData()?.eligibility?.upload; return e ? e.allowed === true : !this.settled(); });
	uploadBlockedReason = computed<string | null>(() => this.projectData()?.eligibility?.upload?.reason ?? this.projectData()?.uploadBlockedReason ?? null);
	/** The final stage's delivery is really waiting for the client's decision. */
	finalAwaitingClient = computed<boolean>(() => {
		const s = this.finalStage();
		if (!s || this.settled()) return false;
		return s.lifecycle ? s.lifecycle.awaitingClientReview === true : s.status === 'submitted';
	});
	settlement = computed<any>(() => this.financial()?.settlement ?? null);
	badge = computed<{ text: string; ok: boolean }>(() => {
		if (this.settled()) return { text: this.projectData()?.statusLabel || 'أُغلق بتسوية نزاع', ok: false };
		if (this.completedByDelivery()) return { text: 'المشروع مكتمل', ok: true };
		if (this.isFinalStageDone()) return { text: 'اعتُمد التسليم النهائي', ok: true };
		if (this.finalAwaitingClient()) return { text: 'بانتظار اعتماد العميل', ok: false };
		return { text: 'قيد التنفيذ', ok: false };
	});
	heading(stage: any): string { return stageHeading(stage?.stageNumber, stage?.title); }
	openUrl(file: any): string | null { return deliveryFileOpenUrl(file); }
	downloadUrl(file: any): string | null { return deliveryFileDownloadUrl(file); }
	readonly legacyFileNote = LEGACY_FILE_NOTE;
	stageMoney(stage: any): string {
		const amount = `${formatMoney(stage?.amount || 0)} $`;
		const st = stage?.lifecycle?.amountState;
		if (st === 'RELEASED' || stage?.isDone || stage?.status === 'completed') return `أُفرِج ${amount}`;
		if (st === 'HISTORICAL') return `قيمة المرحلة ${amount} (تعاقدية سابقة، وليست مبلغًا ينتظر الإفراج)`;
		if (st === 'NONE') return `قيمة المرحلة ${amount}`;
		return `محتجز ${amount}`;
	}

	totalContractValue = computed<number>(() => this.financial() ? Number(this.financial().contractValue || 0) : this.stages().reduce((sum, s) => sum + (Number(s.amount) || 0), 0));
	releasedValue = computed<number>(() => this.financial() ? Number(this.financial().releasedByStageApprovals || 0) : this.completedStages().reduce((sum, s) => sum + (Number(s.amount) || 0), 0));
	heldValue = computed<number>(() => this.financial() ? Number(this.financial().heldNow || 0) : Math.max(0, this.totalContractValue() - this.releasedValue()));
	releasedPct = computed<number>(() => {
		const total = this.totalContractValue();
		return total > 0 ? Math.min(100, Math.max(0, (this.releasedValue() / total) * 100)) : 0;
	});

	isFinalStageDone = computed<boolean>(() => !!this.finalStage()?.isDone || this.finalStage()?.status === 'completed');
	isProjectClosed = computed<boolean>(() => this.completedByDelivery());

	latestDelivery = computed<any>(() => {
		const stage = this.finalStage();
		return stage?.threads?.length ? stage.threads[stage.threads.length - 1] : null;
	});

	deliveryFiles = computed<any[]>(() => this.latestDelivery()?.files || []);


	ngOnInit(): void {
		const id = this.route.snapshot.paramMap.get('id') || '';
		this.projectId.set(id);
		if (!id) {
			this.error.set('لا يوجد معرّف مشروع صالح');
			this.loading.set(false);
			return;
		}
		this.load();
	}

	load() {
		this.loading.set(true);
		this.error.set('');
		this.service.getProjectProgress(this.projectId()).subscribe({
			next: (res) => {
				this.projectData.set(res.data);
				this.loading.set(false);
			},
			error: (err) => {
				this.error.set(err.error?.message || 'تعذر تحميل مراجعة التسليم');
				this.loading.set(false);
			}
		});
	}

	formatMoney(v: number): string {
		return formatMoney(v || 0);
	}

	goToWorkspace() {
		this.router.navigate(['/provider-overview/projects/active/progress', this.projectId()]);
	}

	goToRating() {
		this.router.navigate(['/provider-overview/projects', this.projectId(), 'rating']);
	}

	openConversation() {
		const data = this.projectData();
		const stage = this.finalStage();
		const ctx: MessageContext = {
			type: 'DELIVERY',
			projectId: data?.projectId || this.projectId(),
			projectTitle: data?.title || data?.project || undefined,
			stageId: stage?.id || undefined,
			stageTitle: stage?.title || undefined,
			stageNumber: stage?.stageNumber || undefined,
			amount: stage?.amount || undefined,
		};
		this.router.navigate(['/provider-overview/messages'], {
			queryParams: data?.conversationId ? { conversationId: data.conversationId } : undefined,
			state: { messageContext: ctx }
		});
	}

	openReturnModal() {
		this.returnNote.set('');
		this.returnError.set('');
		this.returnPriority.set('normal');
		this.showReturnModal.set(true);
	}

	closeReturnModal() {
		this.showReturnModal.set(false);
	}

	// No backend endpoint exists yet for "return delivery to team member" —
	// this is a local, display-only confirmation (no fake HTTP call).
	confirmReturnToMember() {
		if (this.returnNote().trim().length < 5) {
			this.returnError.set('اكتب ملاحظة واضحة لعضو الفريق');
			return;
		}
		this.showReturnModal.set(false);
		const memberName = this.latestDelivery()?.author || 'عضو الفريق';
		this.notify.success(`تم إرجاع التسليم لـ${memberName} مع ملاحظاتك`);
	}
}
