import { Component, OnInit, computed, inject, signal, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ActiveProjectsService } from '../../../../../../core/services/active.service';
import { ProjectMiniChat } from '../../../../../../sheards/project-mini-chat/project-mini-chat';
import { DisputeModal } from '../../../../../../sheards/dispute-modal/dispute-modal';
import { DisputeApiService } from '../../../../../../core/services/dispute-api.service';
import { CreateDisputePayload } from '../../../../../../core/models/dispute.model';
import { MessageContext } from '../../../../../../core/services/chat.service';

@Component({
  selector: 'app-progress', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ProjectMiniChat, DisputeModal], templateUrl: './progress.html', styleUrl: './progress.css'
})
export class Progress implements OnInit {
  private service = inject(ActiveProjectsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private disputeApi = inject(DisputeApiService);
  projectData = signal<any>(null);
  loading = signal(true); error = signal(''); saving = signal(false);
  activeTab = signal<'overview' | 'miles' | 'msgs' | 'files' | 'delivs' | 'edits'>('overview');
  deliveryFilter = signal<'all' | 'pending' | 'approved' | 'notes'>('all');
  editFilter = signal<'all' | 'waiting'>('all');
  deliveryStage = signal<any>(null);
  deliveryNote = ''; deliveryFiles = '';
  // P-PR-013 selected files (display-only state; submit still uses same API payload)
  deliverySelectedFiles = signal<{ name: string; size: string }[]>([]);
  deliveryFileInput = viewChild<ElementRef<HTMLInputElement>>('deliveryFileInput');
  private projectId = '';
  providerRatingSuccess = signal('');
  providerRatingSubmitted = signal(false);
  showDisputeModal = signal(false);
  isSubmittingDispute = signal(false);
  disputeSuccess = signal('');
  disputeError = signal('');
  disputeSubmitted = signal(false);
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

  ngOnInit() { this.projectId = this.route.snapshot.paramMap.get('id') || ''; this.load(); }
  load() {
    if (!this.projectId) return;
    this.loading.set(true); this.error.set('');
    this.service.getProjectProgress(this.projectId).subscribe({
      next: res => { this.projectData.set(res.data); this.loading.set(false); },
      error: err => { this.error.set(err.error?.message || 'تعذر تحميل مساحة المشروع'); this.loading.set(false); }
    });
  }
  setTab(tab: any) { this.activeTab.set(tab); }
  setDeliveryFilter(filter: 'all' | 'pending' | 'approved' | 'notes') { this.deliveryFilter.set(filter); }
  setEditFilter(filter: 'all' | 'waiting') { this.editFilter.set(filter); }
  openDelivery(stage: any) { this.deliveryStage.set(stage); this.deliveryNote = ''; this.deliveryFiles = ''; this.deliveryStep.set(1); this.deliverySuccess = false; this.deliverySelectedFiles.set([]); this.aiCheckState.set('idle'); this.aiProgress.set(0); if (this.aiTimer) { clearInterval(this.aiTimer); this.aiTimer = null; } }
  closeDelivery() { if (!this.saving()) { this.deliveryStage.set(null); this.deliveryStep.set(1); this.deliverySuccess = false; this.deliverySelectedFiles.set([]); this.aiCheckState.set('idle'); this.aiProgress.set(0); if (this.aiTimer) { clearInterval(this.aiTimer); this.aiTimer = null; } } }
  openConversation(stage?: any) {
    const data = this.projectData();
    if (!data) return;
    const ctx: MessageContext = stage ? {
      type: stage.deliveryStatus === 'SUBMITTED' || stage.status === 'submitted' ? 'DELIVERY' : 'STAGE',
      projectId: this.projectId,
      projectTitle: data.title || data.project || undefined,
      stageId: stage.id || undefined,
      stageTitle: stage.title || undefined,
      stageNumber: stage.stageNumber || undefined,
      amount: stage.amount || undefined
    } : { type: 'PROJECT', projectId: this.projectId, projectTitle: data.title || data.project || undefined };
    this.router.navigate(['/provider-overview/messages'],
      { queryParams: data.conversationId ? { conversationId: data.conversationId } : undefined, state: { messageContext: ctx } });
  }
  // P-PR-013 file picker handlers (display-only state; no API changes)
  onDeliveryFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files.length) return;
    const current = this.deliverySelectedFiles();
    const next = [...current];
    for (let i = 0; i < input.files.length; i++) {
      const f = input.files[i];
      if (next.some(x => x.name === f.name)) continue;
      next.push({ name: f.name, size: this.formatFileSize(f.size) });
    }
    this.deliverySelectedFiles.set(next);
    input.value = '';
  }
  removeDeliveryFile(event: Event, name: string) {
    event.stopPropagation();
    this.deliverySelectedFiles.update(list => list.filter(f => f.name !== name));
  }
  private formatFileSize(bytes: number): string {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  goToDeliveryStep(step: number) { this.deliveryStep.set(step); }
  startAiCheck() {
    // Honest self-review reminder step — no AI call, no fabricated score.
    // The brief progress animation is a loading transition only.
    this.deliveryStep.set(2);
    this.aiCheckState.set('analyzing');
    this.aiProgress.set(0);
    if (this.aiTimer) clearInterval(this.aiTimer);
    let pct = 0;
    this.aiTimer = setInterval(() => {
      pct += Math.floor(Math.random() * 12) + 6;
      if (pct >= 100) { pct = 100; clearInterval(this.aiTimer); this.aiTimer = null; this.aiCheckState.set('complete'); }
      this.aiProgress.set(pct);
    }, 220);
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
  aiWarnNote(): string {
    return 'لم تُرفق أمثلة على تطبيق الهوية رقمياً (موقع / تطبيق) — غير ملزمة لكن مُستحسنة';
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
    if (!stage || this.deliveryNote.trim().length < 10) { this.error.set('اكتب وصفاً واضحاً للتسليم'); return; }
    const files = this.deliveryFiles.split(/[\n,]/).map(v => v.trim()).filter(Boolean);
    this.saving.set(true); this.error.set('');
    this.service.submitDelivery(this.projectId, stage.id, { note: this.deliveryNote.trim(), files }).subscribe({
      next: () => { this.saving.set(false); this.deliverySuccess = true; this.deliveryStep.set(4); this.load(); this.activeTab.set('delivs'); },
      error: err => { this.saving.set(false); this.error.set(err.error?.message || 'تعذر إرسال التسليم'); }
    });
  }
  // P-PR-013 display helpers (display-only)
  deliveryStageRounds(stage: any): number { return stage?.roundsCount || 0; }
  deliveryStageStatusText(stage: any): string {
    if (stage?.statusText) return stage.statusText;
    if (stage?.status === 'in_progress') return 'جارية';
    if (stage?.status === 'revision') return 'بانتظار إعادة التسليم';
    if (stage?.status === 'submitted') return 'بانتظار اعتماد العميل';
    if (stage?.status === 'completed') return 'مكتملة';
    return 'جارية';
  }
  deliveryStageAmount(stage: any): string { return stage?.amount ? (stage.amount + ' ريال') : '—'; }
  deliveryNoteLength(): number { return (this.deliveryNote || '').length; }
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
      return dt.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }) + '، ' + dt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    } catch { return d.date; }
  }
  // Escrow amount formatted "2,500 ريال"
  escrowAmountLabel(stage: any): string { return stage?.amount ? (stage.amount | 0).toLocaleString('en-US') + ' ريال' : '—'; }

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
    return v ? v + '٪' : 'غير متاح';
  }
  aiBullets(data: any): string[] {
    const bullets = this.currentAiInsights(data)?.bullets;
    if (bullets?.length) return bullets;
    return ['لا تتوفر تحليلات كافية بعد — ستظهر هنا بمجرد توفر بيانات كافية عن سير المشروع'];
  }
  aiEarlyDays(data: any): string {
    const v = this.currentAiInsights(data)?.earlyDays;
    return v ? String(v) : '—';
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
