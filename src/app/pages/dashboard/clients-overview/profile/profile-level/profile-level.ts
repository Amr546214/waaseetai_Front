import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GamificationService, GamificationLevelResponse } from '../../../../../core/services/gamification.service';

@Component({
	selector: 'app-profile-level',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './profile-level.html',
	styles: [`
	@keyframes ws-fade {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes skel-pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.state-card {
  background: var(--crd-bg, linear-gradient(135deg, rgba(255,255,255,.04), rgba(255,255,255,.01)));
  backdrop-filter: blur(12px);
  border: 1px solid var(--sec-bd, rgba(255,255,255,.08));
  border-radius: 16px;
  padding: 24px;
}

.active-tab {
  color: var(--teal-txt, #2BD4C7) !important;
  border-bottom-color: var(--teal-txt, #2BD4C7) !important;
}

/* Base Light Mode override - typical for Waseet AI without using direct Tailwind dark: classes */
:host-context([data-theme='light']) .active-tab {
  color: #0F8A7F !important;
  border-bottom-color: #0F8A7F !important;
}

:host-context([data-theme='light']) .req-card:hover {
  border-color: rgba(43, 212, 199, 0.4) !important;
}
	`]
})
export class ProfileLevel implements OnInit {
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
