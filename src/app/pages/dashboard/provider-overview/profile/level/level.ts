import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { levelDisplayFromInfo } from '../../../../../core/levels/level-display';
import { LevelBadgeComponent } from '../../../../../shared/levels/level-badge.component';
import { GamificationService, GamificationLevelResponse } from '../../../../../core/services/gamification.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

@Component({
  selector: 'app-profile-level',
  standalone: true,
  imports: [CommonModule, RouterModule, LevelBadgeComponent],
  templateUrl: './level.html',
  styleUrls: ['./level.css'],
})
export class Level implements OnInit {
  private gamificationService = inject(GamificationService);
  private authStore = inject(AuthStore);

  levelData = signal<GamificationLevelResponse | null>(null);
  isLoading = signal<boolean>(true);

  /** The shared level display of the current level (name from the roadmap, colour pair from the backend, percent = the real commission). */
  levelDisplay = computed(() => {
    const d = this.levelData();
    const cur = d?.roadmap.find(l => l.isCurrent);
    return levelDisplayFromInfo(d && cur ? { role: 'PROVIDER', index: d.currentLevel.index, total: d.roadmap.length, name: d.currentLevel.title, percent: d.currentStats.commissionRate, percentKind: 'PLATFORM_COMMISSION', color: cur.color } : null);
  });

  /** The current level's brand colour pair (dark / light) from the backend roadmap. */
  currentLevelColor = computed(() => this.levelData()?.roadmap.find(l => l.isCurrent)?.color ?? { dark: '#9B8B7A', light: '#7A6B5A' });

  /** "15 مستوى · من مبتدئ إلى مرجع" built from the real roadmap, never typed. */
  ladderSubtitle = computed(() => {
    const r = this.levelData()?.roadmap ?? [];
    return r.length ? `${r.length} مستوى · من ${r[0].title} إلى ${r[r.length - 1].title}` : '';
  });

  isCompanyMode = computed<boolean>(() => {
    const user = this.authStore.currentUser();
    return user?.accountType === AccountType.PROVIDER_COMPANY;
  });

  ngOnInit() {
    this.gamificationService.getLevelDetails().subscribe({
      next: (res) => {
        if (res.success) {
          this.levelData.set(res.data);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.isLoading.set(false);
      }
    });
  }
}
