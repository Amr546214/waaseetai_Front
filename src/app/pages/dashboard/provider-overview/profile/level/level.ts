import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GamificationService, GamificationLevelResponse } from '../../../../../core/services/gamification.service';

@Component({
  selector: 'app-profile-level',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './level.html',
})
export class Level implements OnInit {
  private gamificationService = inject(GamificationService);

  levelData = signal<GamificationLevelResponse | null>(null);
  isLoading = signal<boolean>(true);

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
