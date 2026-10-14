import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SaSpecialtiesService, AdminCategory, AdminSpecialty } from '../sa-specialties.service';

// The live API (SaSpecialtiesService) only exposes providersCount / registered accreditation requests per specialty, plus
// its category. Nothing else is shown here: no invented trend, top-provider list, performance metrics or tiers.
interface SpecialtyAnalytics {
	kpis: {
		activeProviders: number;
		accreditationRequests: number;
		categoryRank: string;
	};
}

@Component({
  selector: 'app-sa-specialty-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-specialty-detail.html',
  styleUrls: ['./sa-specialty-detail.css'],
})
export class SaSpecialtyDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(SaSpecialtiesService);

  private currentId: string | null = null;

  loading = signal(true);
  notFound = signal(false);
  error = signal('');

  selectedSpec = signal<AdminSpecialty | null>(null);
  selectedSpecCategory = signal<AdminCategory | null>(null);
  specialtyAnalytics = signal<SpecialtyAnalytics | null>(null);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      this.currentId = id;
      if (!id) {
        this.notFound.set(true);
        this.loading.set(false);
        return;
      }
      this.fetchDetail(id);
    });
  }

  // There is no GET /admin/specialties/:id endpoint — load the same category/specialty
  // tree the list page uses (getTree) and locate the specialty (and its category) by id.
  // Works on page refresh / deep link since it doesn't depend on router state.
  private fetchDetail(id: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.error.set('');
    this.selectedSpec.set(null);
    this.selectedSpecCategory.set(null);
    this.specialtyAnalytics.set(null);

    this.service.getTree('').subscribe({
      next: (res) => {
        const cats = res.success ? res.data : [];
        let foundSpec: AdminSpecialty | null = null;
        let foundCat: AdminCategory | null = null;
        for (const cat of cats) {
          const spec = (cat.specialties || []).find((s) => String(s.id) === id);
          if (spec) {
            foundSpec = spec;
            foundCat = cat;
            break;
          }
        }
        if (foundSpec && foundCat) {
          this.selectedSpec.set(foundSpec);
          this.selectedSpecCategory.set(foundCat);
          this.specialtyAnalytics.set(this.buildAnalytics(foundSpec, foundCat));
        } else {
          this.notFound.set(true);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'تعذر تحميل بيانات التخصص');
        this.loading.set(false);
      },
    });
  }

  retry(): void {
    if (this.currentId) this.fetchDetail(this.currentId);
  }

  goBack(): void {
    this.router.navigate(['/supper-admin-overview/specialties']);
  }

  private buildAnalytics(spec: AdminSpecialty, cat: AdminCategory): SpecialtyAnalytics {
    const providers = Math.max(spec.providersCount || 0, 0);
    const requests = Math.max(spec.monthlyRequests || 0, 0);

    // Rank of this specialty within its own category by registered accreditation requests, derived from the loaded tree.
    const siblings = [...(cat.specialties || [])].sort((a, b) => (b.monthlyRequests || 0) - (a.monthlyRequests || 0));
    const rankIndex = siblings.findIndex(s => s.id === spec.id);
    const categoryRank = rankIndex >= 0 ? `${rankIndex + 1} من ${siblings.length}` : '—';

    return { kpis: { activeProviders: providers, accreditationRequests: requests, categoryRank } };
  }
}
