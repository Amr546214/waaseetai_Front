import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MarketerOverviewService, MarketerSummary } from '../../../../../core/services/marketer-overview.service';
import { MarketerProfileService, MarketerProfile, AffiliateChannelHandle } from '../../../../../core/services/marketer-profile.service';

@Component({
  selector: 'app-public',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './public.html',
  styleUrl: './public.css',
})
export class Public implements OnInit {
  private overviewService = inject(MarketerOverviewService);
  private profileService = inject(MarketerProfileService);

  summary = signal<MarketerSummary | null>(null);
  profile = signal<MarketerProfile | null>(null);
  channels = signal<AffiliateChannelHandle[]>([]);

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

  getChannelStatus(platform: string): string {
    return 'موثّق';
  }

  getChannelStatusClass(platform: string): string {
    return 'status-verified';
  }
}
