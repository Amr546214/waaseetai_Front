import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type TierName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

interface Tier {
  name: TierName;
  color: string;
  stars: number;
  count: number;
  percent: number;
  minRating: string;
  minProjects: string;
  features: string;
}

interface TopProvider {
  name: string;
  avatar: string;
  avatarBg: string;
  specialty: string;
  rating: number;
  projects: number;
  tier: TierName;
  revenue: string;
  since: string;
}

@Component({
  selector: 'app-sa-categories',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-categories.html',
  styleUrl: './sa-categories.css',
})
export class SaCategories {
  toast = signal('');
  searchTerm = signal('');
  editingTier = signal<TierName | null>(null);
  editMinRating = signal('');
  editMinProjects = signal('');
  editFeatures = signal('');

  goldProjectThreshold = signal(15);
  goldRatingThreshold = signal(4.2);

  readonly tierColors: Record<TierName, string> = {
    Bronze: '#CD7F32', Silver: '#C0C0C0', Gold: '#D98A0B', Platinum: '#94B8CC',
  };

  tiers = signal<Tier[]>([
    { name: 'Bronze', color: '#CD7F32', stars: 1, count: 2840, percent: 55.5, minRating: 'لا يشترط', minProjects: '0 مشاريع', features: 'عضوية أساسية، حد 5 عروض/شهر' },
    { name: 'Silver', color: '#C0C0C0', stars: 3, count: 1326, percent: 25.9, minRating: '4.0 نجمة', minProjects: '5 مشاريع', features: '15 عرض/شهر، أولوية متوسطة' },
    { name: 'Gold', color: '#D98A0B', stars: 4, count: 812, percent: 15.9, minRating: '4.7 نجمة', minProjects: '20 مشروع', features: 'عروض غير محدودة، شارة Gold، أولوية قصوى' },
    { name: 'Platinum', color: '#94B8CC', stars: 5, count: 142, percent: 2.8, minRating: '4.9 نجمة', minProjects: '50 مشروع', features: 'كل مميزات Gold + دعم VIP + ظهور مميز' },
  ]);

  totalProviders = computed(() => this.tiers().reduce((sum, t) => sum + t.count, 0));

  aiUpgradesThisMonth = signal([
    { label: 'Bronze إلى Silver', count: 18, color: '#C0C0C0' },
    { label: 'Silver إلى Gold', count: 12, color: '#D98A0B' },
    { label: 'Gold إلى Platinum', count: 4, color: '#94B8CC' },
    { label: 'تخفيضات (عدم استيفاء)', count: 7, color: '#FF8C69', down: true },
  ]);

  providers = signal<TopProvider[]>([
    { name: 'نورة السهلي', avatar: 'ن', avatarBg: 'linear-gradient(135deg,#0FA99A,#2BD4C7)', specialty: 'تصميم', rating: 4.98, projects: 68, tier: 'Platinum', revenue: '24,800 ر.س', since: 'يناير 2026' },
    { name: 'هيثم القرني', avatar: 'هـ', avatarBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', specialty: 'برمجة', rating: 4.96, projects: 52, tier: 'Platinum', revenue: '38,200 ر.س', since: 'مارس 2026' },
    { name: 'شركة الرياض للتصميم', avatar: 'ر', avatarBg: 'linear-gradient(135deg,#59C1F5,#FF8C69)', specialty: 'تصميم', rating: 4.95, projects: 104, tier: 'Platinum', revenue: '67,500 ر.س', since: 'نوفمبر 2025' },
    { name: 'سارة القحطاني', avatar: 'س', avatarBg: 'linear-gradient(135deg,#59C1F5,#5DA0FF)', specialty: 'تصميم', rating: 4.91, projects: 34, tier: 'Gold', revenue: '18,400 ر.س', since: 'مارس 2026' },
    { name: 'أحمد الزهراني', avatar: 'أ', avatarBg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)', specialty: 'تصميم', rating: 4.82, projects: 28, tier: 'Gold', revenue: '12,200 ر.س', since: 'يونيو 2026' },
  ]);

  filteredProviders = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    if (!q) return this.providers();
    return this.providers().filter((p) => p.name.toLowerCase().includes(q) || p.specialty.toLowerCase().includes(q));
  });

  eligibleForGold = computed(() => {
    // Simple simulated formula: fewer required projects / lower rating threshold => more eligible providers.
    const base = 824;
    const projectFactor = Math.max(0, (30 - this.goldProjectThreshold()) / 25);
    const ratingFactor = Math.max(0, (5.0 - this.goldRatingThreshold()) / 2.0);
    const eligible = Math.round(base * (0.15 + projectFactor * 0.35 + ratingFactor * 0.35));
    return Math.min(eligible, base);
  });

  starsArray(count: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < count);
  }

  editTier(tier: Tier) {
    this.editingTier.set(tier.name);
    this.editMinRating.set(tier.minRating);
    this.editMinProjects.set(tier.minProjects);
    this.editFeatures.set(tier.features);
  }

  closeTierEdit() {
    this.editingTier.set(null);
  }

  saveTierEdit(tier: Tier) {
    const minRating = this.editMinRating();
    const minProjects = this.editMinProjects();
    const features = this.editFeatures();
    this.tiers.update((list) =>
      list.map((t) => (t.name === tier.name ? { ...t, minRating, minProjects, features } : t))
    );
    this.editingTier.set(null);
    this.showToast(`تم تحديث شروط مستوى ${tier.name}`);
  }

  showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
