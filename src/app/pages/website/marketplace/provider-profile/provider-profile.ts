import { Component, HostListener, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { MarketplaceService } from '../../../../core/services/marketplace.service';

type ProfileTab = 'profile' | 'services' | 'reviews' | 'portfolio';
type ServiceSort = 'popular' | 'newest' | 'priceAsc' | 'priceDesc';
type ReviewFilter = 'all' | '5' | '4' | 'low';
type ReviewSort = 'newest' | 'oldest';

@Component({
  selector: 'app-provider-profile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './provider-profile.html',
  styleUrl: './provider-profile.css'
})
export class ProviderProfileComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private route = inject(ActivatedRoute);
  private marketplaceService = inject(MarketplaceService);

  provider = signal<any>(null);
  loading = signal<boolean>(true);
  notFound = signal<boolean>(false);
  error = signal<string>('');
  activeTab = signal<ProfileTab>('profile');

  /** P-MK-010 fav button: local "saved" state (no provider-favourite API exists). */
  favSaved = signal(false);

  /** P-MK-011 sort bar. */
  serviceSort = signal<ServiceSort>('popular');
  /** P-MK-012 filter chips (rating filter + date sort, applied to the loaded reviews). */
  reviewFilter = signal<ReviewFilter>('all');
  reviewSort = signal<ReviewSort>('newest');
  /** P-MK-013 lightbox. */
  lightboxItem = signal<any>(null);

  /** Cycled per-card thumb backgrounds from P-MK-011 (decorative only). */
  readonly svcThumbBgs = [
    'linear-gradient(135deg,#0A1020,#0D1B3E)',
    'linear-gradient(135deg,#0A1020,#0C1A35)',
    'linear-gradient(135deg,#0A1020,#0D2030)',
    'linear-gradient(135deg,#0A1020,#1A2B0A)',
    'linear-gradient(135deg,#0A1020,#2B1A0A)',
    'linear-gradient(135deg,#0A1020,#1A0A2B)',
    'linear-gradient(135deg,#0A1020,#0A1A2B)',
    'linear-gradient(135deg,#0A1020,#0D1530)'
  ];
  /** Cycled reviewer avatar gradients from P-MK-012 (decorative only). */
  readonly reviewerAvBgs = [
    { bg: 'linear-gradient(135deg,#2B7FFF,#2BD4C7)', color: '#070D24' },
    { bg: 'linear-gradient(135deg,#0FA99A,#2BD4C7)', color: '#070D24' },
    { bg: 'linear-gradient(135deg,#7B2FBE,#2B7FFF)', color: '#fff' },
    { bg: 'linear-gradient(135deg,#D98A0B,#2B7FFF)', color: '#fff' },
    { bg: 'linear-gradient(135deg,#2BD4C7,#0FA99A)', color: '#070D24' },
    { bg: 'linear-gradient(135deg,#0FA99A,#7B2FBE)', color: '#fff' }
  ];
  /** Cycled portfolio card backgrounds from P-MK-013 (decorative only). */
  readonly pfCardBgs = [
    'linear-gradient(135deg,#0C1D38,#071224)',
    'linear-gradient(135deg,#0A1628,#061020)',
    'linear-gradient(135deg,#1A0A0A,#2A0A0A)',
    'linear-gradient(135deg,#0A1628,#0D1F3C)',
    'linear-gradient(135deg,#0A1020,#12183C)',
    'linear-gradient(135deg,#0A1020,#0D1530)'
  ];

  sortedServices = computed<any[]>(() => {
    const list = [...(this.provider()?.services || [])];
    const time = (s: any) => new Date(s?.createdAt || 0).getTime();
    const price = (s: any) => Number(s?.totalAmount) || 0;
    switch (this.serviceSort()) {
      case 'newest': return list.sort((a, b) => time(b) - time(a));
      case 'priceAsc': return list.sort((a, b) => price(a) - price(b));
      case 'priceDesc': return list.sort((a, b) => price(b) - price(a));
      default: return list.sort((a, b) => (Number(b?.salesCount) || 0) - (Number(a?.salesCount) || 0));
    }
  });

  /** Big-star row in the P-MK-012 rating summary: filled up to the provider's rounded rating. */
  filledStars = computed(() => Math.round((Number(this.provider()?.header?.stats?.clientRating) || 0) / 20));

  private allReviews = computed<any[]>(() => this.provider()?.reviews || []);

  reviewCounts = computed(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<number, number>;
    for (const r of this.allReviews()) {
      const star = Math.min(5, Math.max(1, Math.round(Number(r?.rating) || 0)));
      counts[star]++;
    }
    return counts;
  });

  starRows = computed(() => {
    const total = this.allReviews().length;
    const c = this.reviewCounts();
    return [5, 4, 3, 2, 1].map(star => ({
      star,
      count: c[star],
      pct: total ? Math.round((c[star] / total) * 100) : 0
    }));
  });

  visibleReviews = computed<any[]>(() => {
    const filter = this.reviewFilter();
    const star = (r: any) => Math.round(Number(r?.rating) || 0);
    let list = this.allReviews().filter(r =>
      filter === 'all' ? true : filter === 'low' ? star(r) <= 3 : star(r) === Number(filter)
    );
    const time = (r: any) => new Date(r?.createdAt || 0).getTime();
    list = [...list].sort((a, b) => this.reviewSort() === 'oldest' ? time(a) - time(b) : time(b) - time(a));
    return list;
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (!id) {
        this.notFound.set(true);
        this.loading.set(false);
        return;
      }
      this.fetchProviderProfile(id);
    });
  }

  ngOnDestroy(): void {
    this.setBodyScrollLock(false);
  }

  private fetchProviderProfile(id: string) {
    this.loading.set(true);
    this.notFound.set(false);
    this.error.set('');
    this.provider.set(null);
    this.marketplaceService.getProviderPublicProfile(id).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res && res.data) {
          this.provider.set(res.data);
        } else {
          this.notFound.set(true);
        }
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 404) {
          this.notFound.set(true);
        } else {
          this.error.set(err?.error?.message || 'تعذر تحميل الملف الشخصي، حاول مرة أخرى');
        }
      }
    });
  }

  retry() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.fetchProviderProfile(id);
  }

  /** Maps the backend level title onto the design's 4-colour level system (P-MK-010 "لون حسب المستوى"). */
  levelClass(levelName: string | null | undefined): string {
    const expert = ['خبير', 'رصين', 'مستشار', 'رائد', 'مراجع', 'مبتكر', 'مرجع'];
    const advanced = ['متمكن', 'أخصائي', 'محترف'];
    const mid = ['منجز', 'منفذ', 'بارع', 'متقن'];
    const name = (levelName || '').trim();
    if (expert.includes(name)) return 'level-خبير';
    if (advanced.includes(name)) return 'level-متقدم';
    if (mid.includes(name)) return 'level-متوسط';
    return 'level-مبتدئ';
  }

  initials(first?: string, last?: string): string {
    const f = (first || '').trim();
    const l = (last || '').trim();
    if (f && l) return f.charAt(0) + l.charAt(0);
    return (f || l).substring(0, 2) || 'ع';
  }

  relativeTime(value: string | Date | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    const days = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (days < 1) return 'اليوم';
    if (days === 1) return 'منذ يوم';
    if (days < 7) return days === 2 ? 'منذ يومين' : `منذ ${days} أيام`;
    const weeks = Math.floor(days / 7);
    if (days < 30) return weeks === 1 ? 'منذ أسبوع' : weeks === 2 ? 'منذ أسبوعين' : `منذ ${weeks} أسابيع`;
    const months = Math.floor(days / 30);
    if (days < 365) return months === 1 ? 'منذ شهر' : months === 2 ? 'منذ شهرين' : `منذ ${months} أشهر`;
    const years = Math.floor(days / 365);
    return years === 1 ? 'منذ سنة' : years === 2 ? 'منذ سنتين' : `منذ ${years} سنوات`;
  }

  toggleFav() {
    this.favSaved.set(true);
  }

  openLightbox(item: any, event?: Event) {
    event?.stopPropagation();
    this.lightboxItem.set(item);
    this.setBodyScrollLock(true);
  }

  closeLightbox() {
    this.lightboxItem.set(null);
    this.setBodyScrollLock(false);
  }

  /** "اطلب مشابهاً" / "اطلب خدمة": take the visitor to this provider's published services. */
  goToServices() {
    this.closeLightbox();
    this.activeTab.set('services');
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.lightboxItem()) this.closeLightbox();
  }

  private setBodyScrollLock(lock: boolean) {
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = lock ? 'hidden' : '';
    }
  }
}
