import { WsBasePipe } from '../../../../../shared/money/money.pipe';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MarketerLevelTagComponent } from '../../../../../shared/levels/marketer-level-tag.component';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MarketerOverviewService, MarketerSummary } from '../../../../../core/services/marketer-overview.service';
import { MarketerProfileService, MarketerProfile, AffiliateChannelHandle } from '../../../../../core/services/marketer-profile.service';

@Component({
  selector: 'app-public',
  standalone: true,
  imports: [WsBasePipe, MarketerLevelTagComponent, CommonModule, RouterModule],
  templateUrl: './public.html',
  styleUrl: './public.css',
})
export class Public implements OnInit {
  private overviewService = inject(MarketerOverviewService);
  private profileService = inject(MarketerProfileService);

  summary = signal<MarketerSummary | null>(null);
  profile = signal<MarketerProfile | null>(null);
  channels = signal<AffiliateChannelHandle[]>([]);

  /** The year the marketer really joined (from the profile's createdAt); empty until the profile loads, never a made-up year. */
  memberSince(): string {
    const y = new Date(this.profile()?.createdAt ?? '').getFullYear();
    return Number.isFinite(y) ? ` · منذ ${y}` : '';
  }

  ngOnInit() {
    this.overviewService.getSummary().subscribe(res => {
      if (res.success) {
        this.summary.set(res.data);
      }
    });

    this.profileService.getProfile().subscribe(res => {
      if (res.success && res.data) {
        this.profile.set(res.data);
        this.channels.set(res.data.marketingChannels || []);
      }
    });
  }

  // No backend field tracks per-channel review or ownership verification, so the page states only what is true: the channel was added.
  // It must not claim "under review" or "verified" until a real verification pipeline exists.
  getChannelStatus(platform: string): string {
    return 'قناة مضافة';
  }

  getChannelStatusClass(platform: string): string {
    return 'status-added';
  }
}
