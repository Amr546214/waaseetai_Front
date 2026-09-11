import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GamificationService, GamificationLevelResponse } from '../../../../../core/services/gamification.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

@Component({
  selector: 'app-profile-level',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './level.html',
  styleUrls: ['./level.css'],
})
export class Level implements OnInit {
  private gamificationService = inject(GamificationService);
  private authStore = inject(AuthStore);

  levelData = signal<GamificationLevelResponse | null>(null);
  isLoading = signal<boolean>(true);

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
