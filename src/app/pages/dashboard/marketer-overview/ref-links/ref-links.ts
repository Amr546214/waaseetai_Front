import { MarketerLevelTagComponent } from '../../../../shared/levels/marketer-level-tag.component';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarketerOverviewService, RefLinksData, ReferralCustomLink, MarketerSummary } from '../../../../core/services/marketer-overview.service';
import { buildReferralUrl } from '../../../../core/utils/referral-link.util';

@Component({
  selector: 'app-ref-links',
  standalone: true,
  imports: [MarketerLevelTagComponent, CommonModule, FormsModule],
  templateUrl: './ref-links.html',
  styleUrl: './ref-links.css',
})
export class RefLinks implements OnInit {
  private service = inject(MarketerOverviewService);

  data = signal<RefLinksData | null>(null);
  summary = signal<MarketerSummary | null>(null);
  isLoading = signal(true);
  
  newChannelName = signal('');
  newUtmSource = signal('');
  showNewChannelForm = signal(false);

  toastMessage = signal<string | null>(null);

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
      error: () => this.isLoading.set(false)
    });
  }

  copyToClipboard(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      this.showToast('تم نسخ الرابط بنجاح');
    });
  }

  showToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 3000);
  }

  toggleNewChannelForm() {
    this.showNewChannelForm.update(v => !v);
  }

  addCustomLink() {
    const channelName = this.newChannelName();
    const utmSource = this.newUtmSource();
    if (!channelName || !utmSource) return;

    this.service.createCustomLink({ channelName, utmSource }).subscribe({
      next: (res) => {
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
          this.showToast('تمت إضافة القناة بنجاح');
        }
      }
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

    this.service.updateSettings({ [setting]: newValue }).subscribe();
  }
}
