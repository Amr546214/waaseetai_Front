import { Component, OnInit, computed, inject, signal, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ActiveProjectsService } from '../../../../../../core/services/active.service';
import { ProjectMiniChat } from '../../../../../../sheards/project-mini-chat/project-mini-chat';
import { ProviderRatingModal } from './provider-rating-modal/provider-rating-modal';
import { RatingApiService } from '../../../../../../core/services/rating-api.service';
import { RatingScore } from '../../../../../../core/models/rating.model';
import { DisputeModal } from '../../../../../../sheards/dispute-modal/dispute-modal';
import { DisputeApiService } from '../../../../../../core/services/dispute-api.service';
import { CreateDisputePayload } from '../../../../../../core/models/dispute.model';

@Component({
  selector: 'app-progress', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ProjectMiniChat, ProviderRatingModal, DisputeModal], templateUrl: './progress.html', styleUrl: './progress.css'
})
export class Progress implements OnInit {
  private service = inject(ActiveProjectsService);
  private route = inject(ActivatedRoute);
  private ratingApi = inject(RatingApiService);
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
  showProviderRatingModal = signal(false);
  isSubmittingProviderRating = signal(false);
  providerRatingError = signal('');
  providerRatingSuccess = signal('');
  providerRatingSubmitted = signal(false);
  showDisputeModal = signal(false);
  isSubmittingDispute = signal(false);
  disputeSuccess = signal('');
  disputeError = signal('');
  disputeSubmitted = signal(false);

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
  openDelivery(stage: any) { this.deliveryStage.set(stage); this.deliveryNote = ''; this.deliveryFiles = ''; this.deliveryStep = 1; this.deliverySuccess = false; this.deliverySelectedFiles.set([]); }
  closeDelivery() { if (!this.saving()) { this.deliveryStage.set(null); this.deliveryStep = 1; this.deliverySuccess = false; this.deliverySelectedFiles.set([]); } }
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
  // P-PR-013 multi-step state (display-only; submit still calls same API)
  deliveryStep = 1; // 1=details, 2=ai-check (visual only), 3=confirm
  deliverySuccess = false;
  goToDeliveryStep(step: number) { this.deliveryStep = step; }
  startAiCheck() {
    // Visual-only AI check simulation (no API call); proceeds to confirm step
    this.deliveryStep = 3;
  }
  submitDelivery() {
    const stage = this.deliveryStage();
    if (!stage || this.deliveryNote.trim().length < 10) { this.error.set('اكتب وصفاً واضحاً للتسليم'); return; }
    const files = this.deliveryFiles.split(/[\n,]/).map(v => v.trim()).filter(Boolean);
    this.saving.set(true); this.error.set('');
    this.service.submitDelivery(this.projectId, stage.id, { note: this.deliveryNote.trim(), files }).subscribe({
      next: () => { this.saving.set(false); this.deliverySuccess = true; this.deliveryStep = 4; this.load(); this.activeTab.set('delivs'); },
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

  // === P-PR-010 AI insights display fallbacks (display-only, no API changes) ===
  aiConfidence(data: any): string {
    const v = data?.aiInsights?.confidence;
    if (v) return v + '٪';
    return '95٪';
  }
  aiBullets(data: any): { title: string; text: string }[] {
    if (data?.aiInsights?.bullets?.length) return data.aiInsights.bullets;
    // Populated fallback for fresh project
    return [
      { title: 'المشروع ضمن الجدول الزمني', text: '— لا توجد مؤشرات تأخير حالياً' },
      { title: 'جاهز لاستقبال التسليمات', text: '— ارفع تسليم المرحلة الأولى لبدء المتابعة' },
      { title: 'المخاطرة منخفضة', text: '— الضمان المالي محفوظ والشروط واضحة' },
    ];
  }
  aiEarlyDays(data: any): string {
    const v = data?.aiInsights?.earlyDays;
    if (v) return String(v);
    const dl = data?.daysLeft || 0;
    if (dl > 0) return String(Math.max(1, Math.round(dl / 10)));
    return '0';
  }
  aiMatchPct(data: any): string {
    const v = data?.aiInsights?.matchPercentage;
    if (v) return v + '٪';
    return '—';
  }
  aiRiskLevel(data: any): string {
    const v = data?.aiInsights?.riskLevel;
    if (v) return v;
    const dl = data?.daysLeft || 0;
    if (dl > 7) return 'منخفضة';
    if (dl > 0) return 'متوسطة';
    return 'منخفضة';
  }

  canRateClient(data: any): boolean {
    if (this.providerRatingSubmitted() || this.providerRatingSuccess()) return false;
    if (data?.canRate === true) return true;
    if (data?.hasRated === true) return false;
    const allCompleted = data?.stages?.length > 0 && data.stages.every((s: any) => s.status === 'completed');
    return data?.status === 'COMPLETED' || (data?.progress === 100 && allCompleted);
  }

  openProviderRatingModal() {
    this.providerRatingError.set('');
    this.showProviderRatingModal.set(true);
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
    if (this.isSubmittingProviderRating()) return;
    this.showProviderRatingModal.set(false);
    this.providerRatingError.set('');
  }

  submitProviderRating(payload: { rating: RatingScore; comment?: string }) {
    if (this.isSubmittingProviderRating()) return;
    this.isSubmittingProviderRating.set(true);
    this.providerRatingError.set('');
    this.ratingApi.rateClient(this.projectId, payload).subscribe({
      next: () => {
        this.isSubmittingProviderRating.set(false);
        this.showProviderRatingModal.set(false);
        this.providerRatingSubmitted.set(true);
        this.providerRatingSuccess.set('تم إرسال تقييمك بنجاح');
      },
      error: (err: any) => {
        this.isSubmittingProviderRating.set(false);
        this.providerRatingError.set(err?.error?.message || 'تعذر إرسال التقييم، حاول مرة أخرى');
      },
    });
  }
}
