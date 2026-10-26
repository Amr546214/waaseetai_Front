import { WsAmountPipe } from '../../../../../../shared/money/money.pipe';
import { providerTimeZone } from '../../../../../../core/services/provider-prefs.store';
import { Component, DestroyRef, OnInit, computed, inject, signal, ElementRef, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RatingSummary } from '../../../../../../sheards/rating-summary/rating-summary.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpEventType } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { ActiveProjectsService, DeliveryFileDescriptor, ProviderAmendment, CreateAmendmentPayload } from '../../../../../../core/services/active.service';
import { ProjectMiniChat } from '../../../../../../sheards/project-mini-chat/project-mini-chat';
import { DisputeModal } from '../../../../../../sheards/dispute-modal/dispute-modal';
import { DisputeApiService } from '../../../../../../core/services/dispute-api.service';
import { CreateDisputePayload } from '../../../../../../core/models/dispute.model';
import { ChatService, MessageContext } from '../../../../../../core/services/chat.service';
import { sortAmendments, upsertAmendment } from '../../../../../../core/utils/amendment-list';
import { AuthStore } from '../../../../../../core/store/auth.store';
import { AccountType } from '../../../../../../core/models/auth.model';
import { formatMoney } from '../../../../../../core/utils/money.util';
import { stageHeading } from '../../../../../../core/utils/stage-title.util';
import { deliveryFileOpenUrl } from '../../../../../../core/utils/delivery-file.util';
import { AMENDMENT_PROPOSED_CHANGE_LABEL, AMENDMENT_REJECT_CONFIRM_TEXT, amendmentApproveText, amendmentApprovedBadge, amendmentEffectLines, amendmentEffectNote, amendmentNeedsPayment, amendmentActionBlockedReason } from '../../../../../../core/constants/amendment-effect';

export type AmendKind = 'SCOPE' | 'BUDGET' | 'DURATION';

export const AMENDMENT_SUCCESS_TEXT = 'تم إرسال طلب التعديل وهو بانتظار رد العميل. لا يتغير السعر أو المدة أو الضمان قبل موافقته، وعند موافقته يُطبَّق التعديل فورًا.';
export const AMENDMENT_STATUS_LABEL: Record<string, string> = { PENDING_OTHER_PARTY: 'بانتظار رد العميل', APPROVED: 'وافق العميل', REJECTED: 'رفضه العميل', CANCELLED: 'أُلغي' };
/** Status wording depends on WHO raised the request: my own (waiting for the client) or the client's (waiting for me). */
export const CLIENT_REQUEST_STATUS_LABEL: Record<string, string> = { PENDING_OTHER_PARTY: 'بانتظار ردك', APPROVED: 'وافقت عليه', REJECTED: 'رفضته', CANCELLED: 'أُلغي' };
export const AMENDMENT_TYPE_LABEL: Record<string, string> = { SCOPE: 'تغيير النطاق', BUDGET: 'تعديل الميزانية', DURATION: 'تعديل المدة', MIXED: 'تعديل متعدد' };

export const DELIVERY_LIMITS = { maxFileBytes: 25 * 1024 * 1024, maxFiles: 5, maxLinks: 5 } as const;
const DELIVERY_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'txt', 'csv', 'mp4', 'webm', 'mp3', 'wav']);

export interface DeliveryUpload {
  id: string; name: string; size: number; sizeLabel: string;
  status: 'uploading' | 'done' | 'error'; progress: number; error: string;
  stored?: DeliveryFileDescriptor;
}

/** Client-side mirror of the server rules (the server re-checks): size <= 25MB, allowed types. null = fine. */
export function deliveryFileProblem(file: { name: string; size: number }): string | null {
  if (file.size <= 0) return 'الملف فارغ';
  if (file.size > DELIVERY_LIMITS.maxFileBytes) return 'يتجاوز 25MB';
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!DELIVERY_EXTENSIONS.has(ext)) return 'نوع الملف غير مدعوم (ضع ملفات PSD/AI/الملفات المصدرية داخل ZIP)';
  return null;
}

export function isHttpsLink(value: string): boolean {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && u.hostname.includes('.'); } catch { return false; }
}

@Component({
  selector: 'app-progress', standalone: true,
  imports: [WsAmountPipe, CommonModule, FormsModule, RouterLink, RatingSummary, ProjectMiniChat, DisputeModal], templateUrl: './progress.html', styleUrl: './progress.css'
})
export class Progress implements OnInit {
  private service = inject(ActiveProjectsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private chatService = inject(ChatService);
  private destroyRef = inject(DestroyRef);
  private disputeApi = inject(DisputeApiService);
  private authStore = inject(AuthStore);

  // Company-mode branching (same pattern as delivery-review.ts): for a
  // PROVIDER_COMPANY account this workspace renders as manager/admin
  // follow-up on the assigned team member's work, rather than the
  // individual provider's own first-person delivery workflow.
  isCompanyMode = computed<boolean>(() => {
    const user = this.authStore.currentUser();
    return user?.accountType === AccountType.PROVIDER_COMPANY;
  });

  // The team member actively working this project, derived from real
  // delivery-thread data (author/authorInitial already returned by the
  // workspace API) — the most recent submitted thread across all stages.
  // No fabricated job title/specialty is attached (none exists in the
  // backend's data model), mirroring delivery-review.ts's "from-member"
  // badge which shows only name + a static descriptive tag.
  assignedProvider = computed<{ name: string; initial: string } | null>(() => {
    const data = this.projectData();
    if (!data?.stages?.length) return null;
    let latest: any = null;
    for (const s of data.stages) {
      for (const t of (s.threads || [])) {
        if (!t?.author) continue;
        if (!latest || (t.date && (!latest.date || new Date(t.date).getTime() > new Date(latest.date).getTime()))) latest = t;
      }
    }
    if (!latest?.author) return null;
    return { name: latest.author, initial: latest.authorInitial || latest.author.charAt(0) };
  });

  projectData = signal<any>(null);
  loading = signal(true); error = signal(''); saving = signal(false);
  activeTab = signal<'overview' | 'miles' | 'msgs' | 'files' | 'delivs' | 'edits'>('overview');
  deliveryFilter = signal<'all' | 'pending' | 'approved' | 'notes'>('all');
  editFilter = signal<'all' | 'waiting'>('all');
  deliveryStage = signal<any>(null);
  deliveryNote = ''; deliveryLinks = '';
  // Real delivery uploads: a picked file is uploaded at once and only counts as an artifact once the server has stored it (status 'done').
  deliveryUploads = signal<DeliveryUpload[]>([]);
  deliveryFileError = signal('');
  readonly deliveryLimits = DELIVERY_LIMITS;
  private uploadSubs = new Map<string, Subscription>();
  private uploadSeq = 0;
  deliveryFileInput = viewChild<ElementRef<HTMLInputElement>>('deliveryFileInput');
  private projectId = '';
  providerRatingSuccess = signal('');
  providerRatingSubmitted = signal(false);
  showDisputeModal = signal(false);
  isSubmittingDispute = signal(false);
  disputeSuccess = signal('');
  disputeError = signal('');
  disputeSubmitted = signal(false);
  // P-PR-009 change-order request / mutual-cancellation modal state.
  // NOTE (anti-fabrication): there is no backend endpoint anywhere in this
  // app for creating a project change-order or a mutual-cancellation request
  // (grepped ActiveProjectsService, ProjectApiService and every service under
  // core/services for changeOrder/modification/cancelProject/mutualCancel —
  // none exist; the client-side project-details.ts's identical 'edit'/'cancel'
  // flow has the same gap and resolves it the same way: submit routes the
  // request into the real conversation thread with the client instead of
  // claiming a fake success). See BACKEND_BLOCKED_ISSUES.md for the tracked gap.
  // Formal change request ("طلب تعديل"): recorded for the client to answer; it never changes the contract by itself.
  amendOpen = signal(false);
  amendKind: AmendKind = 'SCOPE'; amendTitle = ''; amendDescription = ''; amendBudget: number | null = null; amendDays: number | null = null;
  amendSaving = signal(false); amendError = signal(''); amendSuccess = signal(false);
  amendments = signal<ProviderAmendment[]>([]); amendmentsLoading = signal(false); amendmentsError = signal('');
  readonly amendmentSuccessText = AMENDMENT_SUCCESS_TEXT;
  hasPendingAmendment = computed(() => this.amendments().some(a => a.requestedByRole === 'PROVIDER' && a.status === 'PENDING_OTHER_PARTY'));
  // P-PR-013 multi-step state (display-only; submit still calls same API)
  deliveryStep = signal(1); // 1=details, 2=review (preparing+result), 3=confirm, 4=success
  deliverySuccess = false;
  // Step 2 is an honest self-review reminder, NOT an AI analysis — there is
  // no AI quality-review backend for stage deliveries (same finding as the
  // client-side delivery-review.ts). The brief "preparing" animation is just
  // a loading transition, never a fabricated AI score/verdict.
  // sub-state: 'idle' | 'analyzing' | 'complete'
  aiCheckState = signal<'idle' | 'analyzing' | 'complete'>('idle');
  aiProgress = signal(0);
  private aiTimer: any = null;

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('id') || ''; this.load();
    this.route.queryParamMap.subscribe(q => { if (q.get('tab') === 'messages') this.activeTab.set('msgs'); });
    // a project event (amendment answered / applied by the client) refreshes the list; rows are keyed by id, never doubled
    this.chatService.projectEvent$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(e => { if (e?.amendmentId) this.loadAmendments(); });
  }
  load() {
    if (!this.projectId) return;
    this.loading.set(true); this.error.set('');
    this.service.getProjectProgress(this.projectId).subscribe({
      next: res => { this.projectData.set(res.data); this.loading.set(false); },
      error: err => { this.error.set(err.error?.message || 'تعذر تحميل مساحة المشروع'); this.loading.set(false); }
    });
  }
  // Revision / delivery / stage states are decided by the client's review on the other side, so opening these tabs re-reads them (no spinner).
  setTab(tab: any) { this.activeTab.set(tab); if (tab === 'edits' || tab === 'delivs' || tab === 'miles') this.refreshSilently(); }
  private refreshSilently() {
    if (!this.projectId || this.loading()) return;
    this.service.getProjectProgress(this.projectId).subscribe({ next: res => { if (res?.data) this.projectData.set(res.data); }, error: () => { /* keep what is shown */ } });
  }
  /** Why the upload button is not offered for this stage (server-provided reason), or null when there is nothing to say (done / already with the client). */
  uploadBlockedNote(stage: any): string | null {
    if (!stage || stage.canUploadDelivery || stage.status === 'completed' || stage.status === 'submitted') return null;
    return stage.uploadBlockedReason || null;
  }
  setDeliveryFilter(filter: 'all' | 'pending' | 'approved' | 'notes') { this.deliveryFilter.set(filter); }
  setEditFilter(filter: 'all' | 'waiting') { this.editFilter.set(filter); }
  openDelivery(stage: any) { if (stage?.canUploadDelivery === false) { this.error.set(stage.uploadBlockedReason || 'هذه المرحلة غير متاحة للتسليم حالياً'); return; } this.deliveryStage.set(stage); this.deliveryNote = ''; this.deliveryLinks = ''; this.cancelAllUploads(); this.deliveryFileError.set(''); this.deliveryStep.set(1); this.deliverySuccess = false; this.cancelAllUploads(); this.deliveryFileError.set(''); this.aiCheckState.set('idle'); this.aiProgress.set(0); if (this.aiTimer) { clearInterval(this.aiTimer); this.aiTimer = null; } }
  closeDelivery() { if (!this.saving()) { this.deliveryStage.set(null); this.deliveryStep.set(1); this.deliverySuccess = false; this.cancelAllUploads(); this.deliveryFileError.set(''); this.aiCheckState.set('idle'); this.aiProgress.set(0); if (this.aiTimer) { clearInterval(this.aiTimer); this.aiTimer = null; } } }
  openConversation(stage?: any) {
    const data = this.projectData();
    if (!data) return;
    const ctx: MessageContext = stage ? {
      type: stage.deliveryStatus === 'SUBMITTED' || stage.status === 'submitted' ? 'DELIVERY' : 'STAGE',
      projectId: data.projectId || this.projectId,
      projectTitle: data.title || data.project || undefined,
      stageId: stage.id || undefined,
      stageTitle: stage.title || undefined,
      stageNumber: stage.stageNumber || undefined,
      amount: stage.amount || undefined
    } : { type: 'PROJECT', projectId: data.projectId || this.projectId, projectTitle: data.title || data.project || undefined };
    // project discussion = the project's own messages tab
    this.activeTab.set('msgs');
    this.router.navigate(['/provider-overview/projects/active/progress', this.projectId], { queryParams: { tab: 'messages' }, state: { messageContext: ctx } });
  }
  // Delivery file picker: validates (count / 25MB / type), then uploads each file for real. Nothing is "attached" by name.
  onDeliveryFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const picked = input.files ? Array.from(input.files) : [];
    input.value = '';
    const stage = this.deliveryStage();
    if (!picked.length || !stage) return;
    this.deliveryFileError.set('');
    const problems: string[] = [];
    for (const file of picked) {
      const active = this.deliveryUploads().filter(u => u.status !== 'error').length;
      if (active >= DELIVERY_LIMITS.maxFiles) { problems.push(`الحد الأقصى ${DELIVERY_LIMITS.maxFiles} ملفات للتسليم الواحد`); break; }
      const problem = deliveryFileProblem(file);
      if (problem) { problems.push(`${file.name}: ${problem}`); continue; }
      this.startUpload(stage.id, file);
    }
    if (problems.length) this.deliveryFileError.set(problems.join(' · '));
  }
  private startUpload(stageId: string, file: File) {
    const id = `u${++this.uploadSeq}`;
    const entry: DeliveryUpload = { id, name: file.name, size: file.size, sizeLabel: this.formatFileSize(file.size), status: 'uploading', progress: 0, error: '' };
    this.deliveryUploads.update(list => [...list, entry]);
    const patch = (changes: Partial<DeliveryUpload>) => this.deliveryUploads.update(list => list.map(u => u.id === id ? { ...u, ...changes } : u));
    const sub = this.service.uploadDeliveryFile(this.projectId, stageId, file).subscribe({
      next: ev => {
        if (ev.type === HttpEventType.UploadProgress && ev.total) patch({ progress: Math.round((ev.loaded / ev.total) * 100) });
        if (ev.type === HttpEventType.Response) {
          const stored = ev.body?.data?.files?.[0];
          if (stored?.url) patch({ status: 'done', progress: 100, stored });
          else patch({ status: 'error', error: 'لم يؤكد الخادم حفظ الملف' });
          this.uploadSubs.delete(id);
        }
      },
      error: err => { patch({ status: 'error', error: err.error?.message || 'تعذر رفع الملف' }); this.uploadSubs.delete(id); }
    });
    this.uploadSubs.set(id, sub);
  }
  removeDeliveryFile(event: Event, id: string) {
    event.stopPropagation();
    this.uploadSubs.get(id)?.unsubscribe();
    this.uploadSubs.delete(id);
    this.deliveryUploads.update(list => list.filter(u => u.id !== id));
  }
  private cancelAllUploads() {
    this.uploadSubs.forEach(s => s.unsubscribe());
    this.uploadSubs.clear();
    this.deliveryUploads.set([]);
  }
  // The artifacts a delivery would carry right now: files the server stored + well-formed https links.
  deliveryArtifacts() {
    const files: DeliveryFileDescriptor[] = this.deliveryUploads().filter(u => u.status === 'done' && u.stored).map(u => u.stored!);
    const lines = (this.deliveryLinks || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean);
    const links: string[] = []; const invalid: string[] = [];
    for (const line of lines) (isHttpsLink(line) ? links : invalid).push(line);
    return { files, links: [...new Set(links)], invalid, uploading: this.deliveryUploads().some(u => u.status === 'uploading') };
  }
  // Why the delivery cannot go forward yet (null = ready). Shown under the form and re-checked on submit.
  deliveryBlocker(): string | null {
    const a = this.deliveryArtifacts();
    if (a.uploading) return 'انتظر اكتمال رفع الملفات';
    if (a.invalid.length) return 'كل رابط يجب أن يبدأ بـ https:// وأن يكون صحيحاً';
    if (a.links.length > DELIVERY_LIMITS.maxLinks) return `الحد الأقصى ${DELIVERY_LIMITS.maxLinks} روابط`;
    if (!a.files.length && !a.links.length) return 'ارفع ملفاً واحداً على الأقل أو أضف رابط تسليم https';
    if ((this.deliveryNote || '').trim().length < 10) return 'اكتب وصفاً واضحاً للتسليم (10 أحرف على الأقل)';
    return null;
  }
  /** The blocker text, once the provider started filling the form (not while a file is still uploading). */
  showDeliveryBlocker(): string | null {
    const b = this.deliveryBlocker();
    if (!b || this.deliveryArtifacts().uploading) return null;
    const touched = (this.deliveryNote || '').length > 0 || (this.deliveryLinks || '').trim().length > 0 || this.deliveryUploads().length > 0;
    return touched ? b : null;
  }
  deliveryReady() { return this.deliveryBlocker() === null; }
  private formatFileSize(bytes: number): string {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  goToDeliveryStep(step: number) { this.deliveryStep.set(step); }
  // Real, advisory-only AI review of a SUBMITTED delivery (POST .../stages/:stageId/ai-review). One state per stage.
  deliveryReviews = signal<Record<string, { loading: boolean; failed: boolean; data: any | null }>>({});
  deliveryReviewOf(stageId: string) { return this.deliveryReviews()[stageId]; }
  requestDeliveryReview(stageId: string): void {
    if (!stageId || this.deliveryReviews()[stageId]?.loading) return;
    const set = (v: { loading: boolean; failed: boolean; data: any | null }) => this.deliveryReviews.update(m => ({ ...m, [stageId]: v }));
    set({ loading: true, failed: false, data: null });
    this.service.getDeliveryAiReview(this.projectId, stageId).subscribe({
      next: (res: any) => (res?.success && res.data && typeof res.data === 'object') ? set({ loading: false, failed: false, data: res.data }) : set({ loading: false, failed: true, data: null }),
      error: () => set({ loading: false, failed: true, data: null })
    });
  }

  startAiCheck() {
    const blocker = this.deliveryBlocker();
    if (blocker) { this.error.set(blocker); return; }
    this.error.set('');
    // Plain self-review checklist: no AI call, no analysis animation, no fabricated score.
    this.deliveryStep.set(2);
    this.aiCheckState.set('complete');
    this.aiProgress.set(0);
  }
  cancelAiCheck() {
    if (this.aiTimer) { clearInterval(this.aiTimer); this.aiTimer = null; }
    this.aiCheckState.set('idle');
    this.aiProgress.set(0);
    this.deliveryStep.set(1);
  }
  // Honest self-review reminders — never claimed to be AI-verified. There is
  // no AI quality-review backend for stage deliveries (confirmed: no such
  // field/service exists anywhere in the backend).
  aiResultChecks(): { title: string; note: string; status: 'ok' | 'warn' }[] {
    return [
      { title: 'توافق مع متطلبات المرحلة', note: 'تأكد أن التسليم يغطي العناصر المطلوبة في العقد', status: 'ok' },
      { title: 'طلبات التعديل', note: 'تأكد من معالجة ملاحظات الجولات السابقة', status: 'ok' },
      { title: 'اكتمال الملفات', note: 'راجع أن الملفات المرفقة بالصيغ المطلوبة وجاهزة للاستخدام', status: 'ok' },
    ];
  }
  goToConfirmFromAi() {
    // Move from the self-review reminder (step 2) to confirm step (step 3)
    this.deliveryStep.set(3);
  }
  backToDetailsFromAi() {
    // "تعديل التسليم" → return to step 1, preserve files/note
    if (this.aiTimer) { clearInterval(this.aiTimer); this.aiTimer = null; }
    this.aiCheckState.set('idle');
    this.aiProgress.set(0);
    this.deliveryStep.set(1);
  }
  submitDelivery() {
    const stage = this.deliveryStage();
    if (!stage) return;
    // The server decides whether this stage can be submitted now (canSubmitDelivery + uploadBlockedReason): never recompute it here.
    if (stage.canSubmitDelivery === false) { this.error.set(stage.uploadBlockedReason || 'هذه المرحلة غير متاحة لإرسال التسليم حالياً'); return; }
    const blocker = this.deliveryBlocker();
    if (blocker) { this.error.set(blocker); return; }
    const a = this.deliveryArtifacts();
    const files: Array<DeliveryFileDescriptor | string> = [...a.files, ...a.links];
    this.saving.set(true); this.error.set('');
    this.service.submitDelivery(this.projectId, stage.id, { note: this.deliveryNote.trim(), files }).subscribe({
      next: () => { this.saving.set(false); this.deliverySuccess = true; this.deliveryStep.set(4); this.load(); this.activeTab.set('delivs'); },
      error: err => { this.saving.set(false); this.error.set(err.error?.message || 'تعذر إرسال التسليم'); }
    });
  }
  // P-PR-013 display helpers (display-only)
  deliveryStageRounds(stage: any): number { return stage?.roundsCount || 0; }
  heading(stage: any): string { return stageHeading(stage?.stageNumber, stage?.title); }
  openUrl(file: any): string | null { return deliveryFileOpenUrl(file); }
  /** The stage is waiting on someone (open, delivered, or sent back). Never for a stage a settlement closed, whatever its stored status. */
  stageWaiting(stage: any): boolean {
    if (this.stageClosedBySettlement(stage)) return false;
    return !!(stage?.isWait || stage?.status === 'submitted');
  }
  /** Money label of a stage from the server's amount state: released / held in the escrow / only its contractual value (historical after a settlement). */
  stageMoneyLabel(stage: any): string {
    const amount = `${formatMoney(stage?.amount || 0)} $`;
    if (this.stageClosedBySettlement(stage)) return `قيمة المرحلة ${amount} (تعاقدية سابقة، وليست مبلغًا ينتظر الإفراج)`;
    if (stage?.isDone) return `أُفرج ${amount}`;
    return stage?.amountHeld ? `محتجز ${amount}` : `قيمة المرحلة ${amount}`;
  }
  /** Unreleased stage of a project closed by a dispute settlement: displayed as such (derived by the server; nothing was approved). */
  stageClosedBySettlement(stage: any): boolean { return stage?.displayStatus === 'CLOSED_BY_SETTLEMENT'; }
  stageText(stage: any): string { return this.stageClosedBySettlement(stage) ? (stage.displayStatusLabel || 'أُغلقت بالتسوية') : stage?.statusText; }
  /** Why the amendment actions are disabled (its contract is closed); null when available. */
  amendmentClosedReason(a: any): string | null { return amendmentActionBlockedReason(a); }
  deliveryStageStatusText(stage: any): string {
    if (this.stageClosedBySettlement(stage)) return this.stageText(stage);
    if (stage?.statusText) return stage.statusText;
    if (stage?.status === 'in_progress') return 'جارية';
    if (stage?.status === 'revision') return 'بانتظار إعادة التسليم';
    if (stage?.status === 'submitted') return 'بانتظار اعتماد العميل';
    if (stage?.status === 'completed') return 'مكتملة';
    return 'جارية';
  }
  deliveryStageAmount(stage: any): string { return stage?.amount ? (stage.amount + ' $') : '—'; }
  deliveryNoteLength(): number { return (this.deliveryNote || '').length; }
  // Company-mode header copy for the top AI disclosure strip — same real
  // "متابعة المشروع" concept, reworded for the admin/oversight framing and
  // naming the real assigned team member when known (no fabricated data).
  workspaceDisclosureLabel(): string {
    return this.isCompanyMode() ? 'وسيط AI، متابعة الإدارة للمشروع' : 'وسيط، متابعة دورة حياة المشروع';
  }
  workspaceDisclosureText(): string {
    if (!this.isCompanyMode()) return 'تُتابَع المراحل تلقائياً وفق مواعيدها، ويُربط الإفراج المالي بالتسليمات الفعلية';
    const p = this.assignedProvider();
    return p
      ? `AI يتابع تسليمات ${p.name} ويربط الإفراج المالي بجودة العقد، وينبّه الإدارة عند الحاجة للتدخل قبل إرسال أي تسليم للعميل`
      : 'AI يتابع تسليمات فريق الشركة ويربط الإفراج المالي بجودة العقد، وينبّه الإدارة عند الحاجة للتدخل';
  }
  approvedCount(data: any) { return data.stages?.filter((s: any) => s.status === 'completed').length || 0; }
  pendingCount(data: any) { return data.deliveries?.filter((d: any) => d.status === 'pending').length || 0; }
  approvedDeliveryCount(data: any) { return data.deliveries?.filter((d: any) => d.status === 'approved').length || 0; }
  notesCount(data: any) { return data.deliveries?.filter((d: any) => d.status === 'notes').length || 0; }
  visibleDeliveries(data: any) { const f = this.deliveryFilter(); return f === 'all' ? data.deliveries : data.deliveries.filter((d: any) => d.status === f); }
  visibleEdits(data: any) { const f = this.editFilter(); return f === 'all' ? data.edits : data.edits.filter((e: any) => e.status === f); }
  moneyWidth(value: number, total: number) { return total > 0 ? Math.min(100, Math.max(0, value / total * 100)) : 0; }
  stageById(data: any, stageId: string) { return data.stages?.find((stage: any) => stage.id === stageId); }

  // === P-PR-009 submitted delivery card helpers (display-only, no API changes) ===
  // Latest delivery thread for a submitted stage (real data from workspace API)
  latestDelivery(stage: any): any { return stage?.threads?.length ? stage.threads[stage.threads.length - 1] : null; }
  // "آخر تسليم: [note]" — uses real delivery note from latest thread
  deliverySummary(stage: any): string {
    const d = this.latestDelivery(stage);
    return d?.note || d?.summary || 'لا يوجد وصف للتسليم';
  }
  // "تسليمات · تعديل واحد" chip — counts revision rounds from real threads
  deliveryRoundsLabel(stage: any): string {
    const rounds = stage?.roundsCount || stage?.threads?.length || 0;
    const revisions = stage?.threads?.filter((t: any) => t.isRedo || t.deliveryStatus === 'REVISION').length || 0;
    const roundsWord = rounds === 1 ? 'تسليم واحد' : (rounds === 2 ? 'تسليمان' : `${rounds} تسليم`);
    if (revisions > 0) {
      const revWord = revisions === 1 ? 'تعديل واحد' : `${revisions} تعديلات`;
      return `${roundsWord} · ${revWord}`;
    }
    return roundsWord;
  }
  // First file name from latest delivery (real data)
  latestDeliveryFileName(stage: any): string {
    const d = this.latestDelivery(stage);
    return d?.files?.length ? d.files[0].name : '';
  }
  latestDeliveryFileCount(stage: any): number {
    const d = this.latestDelivery(stage);
    return d?.files?.length || 0;
  }
  // AI match percentage for the stage — real value only; the backend
  // honestly signals "not computed" via a falsy value, so this must never
  // substitute a fabricated percentage for that.
  stageAiMatchPct(stage: any): string {
    const v = stage?.aiMatchPct || stage?.aiScore;
    if (v) return v + '٪';
    return 'غير متاح';
  }
  // Submitted date/time (real from latest thread)
  deliverySubmittedAt(stage: any): string {
    const d = this.latestDelivery(stage);
    if (!d?.date) return '';
    try {
      const dt = new Date(d.date);
      return dt.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: providerTimeZone() }) + '، ' + dt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', timeZone: providerTimeZone() });
    } catch { return d.date; }
  }
  // Escrow amount formatted "2,500 $" (active contract/escrow pricing is USD-canonical)
  escrowAmountLabel(stage: any): string { return stage?.amount ? formatMoney(stage.amount) + ' $' : '—'; }

  // === Batch 8 — real, on-demand Gemini project health analysis ===
  // Replaces the previously-permanent aiInsights placeholder. Not fetched
  // automatically on page load (mirrors the delivery-ai-review pattern
  // elsewhere in this codebase) — the user explicitly requests it via
  // analyzeProjectHealth(), and these helpers prefer that real result over
  // the honest static placeholder still returned inline on data.aiInsights.
  // On failure, healthAnalysisError is set and the placeholder is NOT
  // silently re-shown as if it were a real result — the template shows an
  // explicit "تعذر التحليل" state instead.
  healthAnalysis = signal<any>(null);
  healthAnalysisLoading = signal(false);
  healthAnalysisError = signal(false);

  analyzeProjectHealth(): void {
    if (!this.projectId || this.healthAnalysisLoading()) return;
    this.healthAnalysisLoading.set(true);
    this.healthAnalysisError.set(false);
    this.service.getProjectHealthAnalysis(this.projectId).subscribe({
      next: (res: any) => {
        this.healthAnalysisLoading.set(false);
        if (res?.success && res.data) {
          this.healthAnalysis.set(res.data);
        } else {
          this.healthAnalysisError.set(true);
        }
      },
      error: () => {
        this.healthAnalysisLoading.set(false);
        this.healthAnalysisError.set(true);
      }
    });
  }

  private currentAiInsights(data: any): any {
    return this.healthAnalysis() || data?.aiInsights;
  }
  aiConfidence(data: any): string {
    const v = this.currentAiInsights(data)?.confidence;
    return v != null ? v + '٪' : 'غير متاح';
  }
  aiBullets(data: any): string[] {
    const bullets = this.currentAiInsights(data)?.bullets;
    if (bullets?.length) return bullets;
    return ['لا تتوفر تحليلات كافية بعد — ستظهر هنا بمجرد توفر بيانات كافية عن سير المشروع'];
  }
  aiEarlyDays(data: any): string {
    const v = this.currentAiInsights(data)?.earlyDays;
    return v != null ? String(v) : '—';
  }
  aiMatchPct(data: any): string {
    const v = this.currentAiInsights(data)?.matchPercentage;
    if (v) return v + '٪';
    return '—';
  }
  aiRiskLevel(data: any): string {
    return this.currentAiInsights(data)?.riskLevel || 'غير محسوبة';
  }

  canRateClient(data: any): boolean {
    if (this.providerRatingSubmitted() || this.providerRatingSuccess()) return false;
    // a project closed by a dispute settlement offers no NEW rating (the server says so too: providerClientRating.canRate)
    if (data?.adminSettled) return false;
    // If backend reports the provider already rated this client, hide the CTA.
    if (data?.providerClientRating?.hasRated === true) return false;
    if (data?.canRate === true) return true;
    if (data?.hasRated === true) return false;
    const allCompleted = data?.stages?.length > 0 && data.stages.every((s: any) => s.status === 'completed');
    return data?.status === 'COMPLETED' || (data?.progress === 100 && allCompleted);
  }

  goToProviderRatingPage() {
    this.router.navigate(['/provider-overview/projects', this.projectId, 'rating']);
  }

  // ── Change request ("طلب تعديل") — a real request recorded by the backend (POST /provider/projects/:projectId/amendments); the chat is never a substitute.
  private amendmentProjectId() { return this.projectData()?.projectId || this.projectId; }
  openAmendments() {
    this.amendKind = 'SCOPE'; this.amendTitle = ''; this.amendDescription = ''; this.amendBudget = null; this.amendDays = null;
    this.amendError.set(''); this.amendSuccess.set(false); this.amendOpen.set(true);
    this.loadAmendments();
  }
  closeAmendments() { if (!this.amendSaving()) this.amendOpen.set(false); }
  loadAmendments() {
    this.amendmentsLoading.set(true); this.amendmentsError.set('');
    this.service.getAmendments(this.amendmentProjectId()).subscribe({
      next: res => { this.amendments.set(sortAmendments(Array.isArray(res?.data) ? res.data : [])); this.amendmentsLoading.set(false); },
      error: () => { this.amendmentsLoading.set(false); this.amendmentsError.set('تعذر تحميل طلباتك السابقة'); }
    });
  }
  /** Why the request cannot be sent yet (null = ready) — mirrors the server's rules; the server re-checks. */
  amendBlocker(): string | null {
    if (this.hasPendingAmendment()) return 'لديك طلب تعديل معلّق بانتظار رد العميل. لا يمكن إرسال طلب آخر قبل رده.';
    if (!this.amendTitle.trim()) return 'أضف عنوانًا لطلب التعديل';
    if (this.amendKind === 'SCOPE' && !this.amendDescription.trim()) return 'اشرح التغيير المطلوب في النطاق';
    if (this.amendKind === 'BUDGET' && !(typeof this.amendBudget === 'number' && Number.isFinite(this.amendBudget) && this.amendBudget !== 0)) return 'أدخل فرق الميزانية (قيمة غير صفرية، سالبة للتخفيض)';
    if (this.amendKind === 'DURATION' && !(typeof this.amendDays === 'number' && Number.isInteger(this.amendDays) && this.amendDays !== 0)) return 'أدخل عدد الأيام (عدد صحيح غير صفري، سالب للتقصير)';
    return null;
  }
  amendReady() { return this.amendBlocker() === null && !this.amendSaving(); }
  submitAmendment() {
    const blocker = this.amendBlocker();
    if (blocker) { this.amendError.set(blocker); return; }
    const payload: CreateAmendmentPayload = { type: this.amendKind, title: this.amendTitle.trim() };
    if (this.amendDescription.trim()) payload.description = this.amendDescription.trim();
    if (this.amendKind === 'BUDGET') payload.budgetDelta = this.amendBudget as number;
    if (this.amendKind === 'DURATION') payload.durationDeltaDays = this.amendDays as number;
    this.amendSaving.set(true); this.amendError.set('');
    this.service.createAmendment(this.amendmentProjectId(), payload).subscribe({
      next: (res: any) => { this.amendSaving.set(false); this.amendSuccess.set(true); this.amendments.update(list => upsertAmendment(list, res?.data)); this.loadAmendments(); },
      error: err => { this.amendSaving.set(false); this.amendError.set(err.error?.message || 'تعذر إرسال طلب التعديل'); }
    });
  }
  amendmentStatusLabel(s: string) { return AMENDMENT_STATUS_LABEL[s] || s; }
  amendmentStatusText(a: ProviderAmendment) { return a.requestedByRole === 'CLIENT' ? (CLIENT_REQUEST_STATUS_LABEL[a.status] || a.status) : this.amendmentStatusLabel(a.status); }
  isClientPending(a: ProviderAmendment) { return a.requestedByRole === 'CLIENT' && a.status === 'PENDING_OTHER_PARTY'; }

  // Answering a request the CLIENT raised: a real call (POST /provider/amendments/:id/respond). Approving APPLIES it to the contract in one step
  // (a client-raised increase needs the client's payment authorization first); rejecting changes nothing.
  respondingId = signal<string | null>(null); respondError = signal('');
  readonly amendmentProposedLabel = AMENDMENT_PROPOSED_CHANGE_LABEL;
  amendmentEffectNote(a: ProviderAmendment) { return amendmentEffectNote(a); }
  /** Badge of an approved row: "applied to the contract" for an effective one, the legacy wording only for a record-only row. Empty otherwise. */
  amendmentBadge(a: ProviderAmendment): string { return a.status === 'APPROVED' ? amendmentApprovedBadge(a) : ''; }
  amendmentConfirmText(a: ProviderAmendment, decision: 'approve' | 'reject') { return decision === 'approve' ? amendmentApproveText(a, 'provider') : AMENDMENT_REJECT_CONFIRM_TEXT; }
  amendmentEffectLines(a: ProviderAmendment) { return amendmentEffectLines(a); }
  /** A client-raised increase cannot be approved before the client authorized the payment: the button stays visible but disabled, with the reason. */
  awaitingClientPayment(a: ProviderAmendment) { return this.isClientPending(a) && amendmentNeedsPayment(a) && !a.fundingAuthorized; }
  isOwnPending(a: ProviderAmendment) { return a.requestedByRole === 'PROVIDER' && a.status === 'PENDING_OTHER_PARTY'; }
  pendingAmendDecision = signal<{ id: string; decision: 'approve' | 'reject' } | null>(null);
  askAmendDecision(a: ProviderAmendment, decision: 'approve' | 'reject') { if (this.respondingId() || this.amendmentClosedReason(a)) return; if (decision === 'approve' && this.awaitingClientPayment(a)) return; this.respondError.set(''); this.pendingAmendDecision.set({ id: a.id, decision }); }
  cancelAmendDecision() { this.pendingAmendDecision.set(null); }
  confirmAmendDecision(a: ProviderAmendment) { const p = this.pendingAmendDecision(); if (!p || p.id !== a.id) return; this.pendingAmendDecision.set(null); this.respondAmendment(a, p.decision); }
  respondAmendment(a: ProviderAmendment, decision: 'approve' | 'reject') {
    if (this.respondingId() || this.amendmentClosedReason(a) || !this.isClientPending(a) || (decision === 'approve' && this.awaitingClientPayment(a))) return;
    this.respondingId.set(a.id); this.respondError.set('');
    this.service.respondAmendment(a.id, decision).subscribe({
      next: () => { this.respondingId.set(null); this.loadAmendments(); },
      error: err => { this.respondingId.set(null); this.respondError.set(err.error?.message || 'تعذر حفظ قرارك'); }
    });
  }
  /** Withdraw my own pending request (POST /provider/amendments/:id/cancel). */
  cancelOwnAmendment(a: ProviderAmendment) {
    if (this.respondingId() || this.amendmentClosedReason(a) || !this.isOwnPending(a)) return;
    this.respondingId.set(a.id); this.respondError.set('');
    this.service.cancelAmendment(a.id).subscribe({
      next: () => { this.respondingId.set(null); this.loadAmendments(); },
      error: err => { this.respondingId.set(null); this.respondError.set(err.error?.message || 'تعذر إلغاء الطلب'); }
    });
  }
  amendmentTypeLabel(t: string) { return AMENDMENT_TYPE_LABEL[t] || t; }
  amendmentDeltas(a: ProviderAmendment): string {
    const parts: string[] = [];
    if (a.budgetDelta !== null && a.budgetDelta !== undefined) parts.push(`${a.budgetDelta > 0 ? '+' : ''}${formatMoney(a.budgetDelta)} $`);
    if (a.durationDeltaDays !== null && a.durationDeltaDays !== undefined) parts.push(`${a.durationDeltaDays > 0 ? '+' : ''}${a.durationDeltaDays} يوم`);
    return parts.join(' · ');
  }

  openDisputeModal() {
    if (this.disputeSubmitted()) return;
    this.disputeError.set('');
    this.showDisputeModal.set(true);
  }

  closeDisputeModal() {
    if (this.isSubmittingDispute()) return;
    this.showDisputeModal.set(false);
    this.disputeError.set('');
  }

  submitDispute(payload: CreateDisputePayload) {
    if (this.isSubmittingDispute()) return;
    this.isSubmittingDispute.set(true);
    this.disputeError.set('');
    this.disputeApi.createProviderDispute(this.projectId, payload).subscribe({
      next: () => {
        this.isSubmittingDispute.set(false);
        this.showDisputeModal.set(false);
        this.disputeSubmitted.set(true);
        this.disputeSuccess.set('تم فتح النزاع بنجاح، سيقوم فريق وسيط بمراجعة الحالة');
      },
      error: (err: any) => {
        this.isSubmittingDispute.set(false);
        this.disputeError.set(err?.error?.message || 'تعذر فتح النزاع، حاول مرة أخرى');
      },
    });
  }

  closeProviderRatingModal() {
    // Kept for compatibility; modal removed — rating now uses full page.
  }

  submitProviderRating(_payload: { rating: any; comment?: string }) {
    // Kept for compatibility; rating now submitted via provider rating page route.
  }
}
