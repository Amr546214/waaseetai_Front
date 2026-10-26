import { WsBasePipe } from '../../../../shared/money/money.pipe';
import { MarketerLevelTagComponent } from '../../../../shared/levels/marketer-level-tag.component';
import { Component, ElementRef, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarketerOverviewService, RefLinksData, ReferralCustomLink, MarketerSummary } from '../../../../core/services/marketer-overview.service';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { copyText } from '../../../../core/utils/marketer-labels.util';
import { buildReferralUrl } from '../../../../core/utils/referral-link.util';
import { handleLoadError } from '../../../../core/utils/rate-limit.util';
import { mapHttpError } from '../../../../core/forms/http-error';
import { FieldProblem, reportBackendError, reportProblems, SubmitGuard } from '../../../../shared/forms/form-error-focus';
import { genericBanner } from '../../../../shared/forms/submit-feedback';
import { LoadRetryComponent } from '../../../../sheards/load-retry/load-retry';

@Component({
  selector: 'app-ref-links',
  standalone: true,
  imports: [WsBasePipe, MarketerLevelTagComponent, CommonModule, FormsModule, LoadRetryComponent],
  templateUrl: './ref-links.html',
  styleUrl: './ref-links.css',
})
export class RefLinks implements OnInit {
  private service = inject(MarketerOverviewService);
  private notify = inject(UiNotificationService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private guard = new SubmitGuard();
  savingChannel = signal(false);

  data = signal<RefLinksData | null>(null);
  summary = signal<MarketerSummary | null>(null);
  /** 429 with nothing loaded yet: retry state instead of an empty page. */
  loadTemporaryError = signal(false);
  isLoading = signal(true);
  
  newChannelName = signal('');
  newUtmSource = signal('');
  showNewChannelForm = signal(false);

  // The backend's own `primaryLink` field is hardcoded to the production
  // domain (https://waseet.ai/ref/...) regardless of which environment the
  // request came from — correct on production, wrong on DEV/local. Built
  // client-side instead via the same environment-derived helper already
  // used by the marketer profile page's own full-link field.
  fullReferralLink = computed(() => buildReferralUrl(this.data()?.primarySlug));

  channelLink(utmSource: string): string {
    const base = this.fullReferralLink();
    if (!base) return '';
    return `${base}?utm_source=${utmSource}`;
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    this.loadTemporaryError.set(false);
    
    this.service.getSummary().subscribe({
      next: (res) => {
        if (res.success) {
          this.summary.set(res.data);
        }
      }
    });

    this.service.getRefLinks().subscribe({
      next: (res) => {
        if (res.success) {
          this.data.set(res.data);
        }
        this.isLoading.set(false);
      },
      error: (err) => handleLoadError(err, {
        hasData: () => this.data() != null,
        onKeep: () => this.isLoading.set(false),
        onRateLimit: () => { this.loadTemporaryError.set(true); this.isLoading.set(false); },
        onOtherError: () => this.isLoading.set(false),
      })
    });
  }

  async copyToClipboard(url: string) {
    if (!url) return;
    const ok = await copyText(url);
    if (ok) this.notify.success('تم نسخ الرابط بنجاح');
    else this.notify.error('تعذر النسخ تلقائياً، انسخ الرابط يدوياً');
  }

  /** Web Share when the browser has it; otherwise falls back to copying the link. A cancelled share sheet is not an error. */
  async shareLink(url: string, title = 'رابط الإحالة في وسيط') {
    if (!url) return;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
      }
    }
    await this.copyToClipboard(url);
  }

  removeCustomLink(id: string) {
    this.service.deleteCustomLink(id).subscribe({
      next: () => {
        this.data.update(d => (d ? { ...d, customLinks: d.customLinks.filter(l => l.id !== id) } : d));
        this.notify.success('تم حذف رابط القناة');
      },
      error: () => this.notify.error('تعذر حذف الرابط، حاول مرة أخرى'),
    });
  }

  toggleNewChannelForm() {
    this.showNewChannelForm.update(v => !v);
  }

  addCustomLink() {
    if (this.guard.busy) return;
    const channelName = this.newChannelName().trim();
    const utmSource = this.newUtmSource().trim();
    const problems: FieldProblem[] = [];
    if (!channelName) problems.push({ field: 'new-channel-name', message: 'أدخل اسم القناة' });
    if (!utmSource) problems.push({ field: 'new-channel-utm', message: 'أدخل مصدر الرابط (utm_source)' });
    if (problems.length) { void reportProblems(this.host.nativeElement, problems); return; }

    if (!this.guard.enter()) return;
    this.savingChannel.set(true);
    this.service.createCustomLink({ channelName, utmSource }).subscribe({
      next: (res) => {
        this.guard.release(); this.savingChannel.set(false);
        if (res.success) {
          this.data.update(d => {
            if (!d) return d;
            return {
              ...d,
              customLinks: [res.data, ...d.customLinks]
            };
          });
          this.newChannelName.set('');
          this.newUtmSource.set('');
          this.showNewChannelForm.set(false);
          this.notify.success('تمت إضافة القناة بنجاح');
        }
      },
      error: async (err) => {
        this.guard.release(); this.savingChannel.set(false);
        const mapped = mapHttpError(err, { fallback: 'تعذر إضافة القناة، تحقق من البيانات وحاول مرة أخرى' });
        const gen = genericBanner(mapped);
        if (gen !== null) { this.notify.error(gen); return; }
        const res = await reportBackendError(this.host.nativeElement, mapped, { resolve: { channelName: 'new-channel-name', utmSource: 'new-channel-utm' } });
        if (!res.handled) this.notify.error(mapped.message);
      },
    });
  }

  toggleSetting(setting: 'notifyOnNewReferral' | 'sharePerformanceStats') {
    const currentData = this.data();
    if (!currentData) return;

    const newValue = !currentData.settings[setting];
    
    // Optimistic update
    this.data.update(d => {
      if (!d) return d;
      return {
        ...d,
        settings: {
          ...d.settings,
          [setting]: newValue
        }
      };
    });

    this.service.updateSettings({ [setting]: newValue }).subscribe({
      error: () => {
        // roll the optimistic toggle back: the setting was not saved
        this.data.update(d => (d ? { ...d, settings: { ...d.settings, [setting]: !newValue } } : d));
        this.notify.error('تعذر حفظ الإعداد، حاول مرة أخرى');
      },
    });
  }
}
