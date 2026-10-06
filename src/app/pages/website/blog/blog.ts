import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BLOG_POSTS, BlogPost, BlogCategoryKey, blogCategoryKey } from './blog-data';
import { NewsletterService } from '../../../core/services/newsletter.service';

/** Category strip order used by the design. Categories not listed here are appended. */
const CATEGORY_ORDER = ['للمقدمين', 'للطالبين', 'للوسطاء', 'الذكاء الاصطناعي', 'نصائح وإرشادات'];

/** Icons used in the category strip (design) vs. the post thumbnails (design uses a tag for tips there). */
const STRIP_ICONS: Record<BlogCategoryKey, string> = {
  prov: 'bl-provider',
  client: 'bl-client',
  broker: 'bl-broker',
  ai: 'bl-trust-ai',
  tips: 'bl-star',
};
const THUMB_ICONS: Record<BlogCategoryKey, string> = {
  prov: 'bl-provider',
  client: 'bl-client',
  broker: 'bl-broker',
  ai: 'bl-trust-ai',
  tips: 'bl-tag',
};

const PAGE_SIZE = 7;

@Component({
  selector: 'app-blog',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './blog.html',
  styleUrl: './blog.css',
})
export class Blog {
  private newsletterService = inject(NewsletterService);

  posts: BlogPost[] = BLOG_POSTS;

  readonly quickTags = ['مستوى المقدم', 'التسعير', 'التسليم', 'نصائح', 'الضمان'];

  activeCategory = signal<string>('الكل');
  searchQuery = signal<string>('');
  visibleCount = signal<number>(PAGE_SIZE);

  newsletterEmail = '';
  newsletterSubscribed = signal(false);
  newsletterError = signal('');
  newsletterSubmitting = signal(false);

  categories = computed(() => {
    const counts = new Map<string, { count: number; post: BlogPost }>();
    for (const p of this.posts) {
      const entry = counts.get(p.category);
      if (entry) entry.count++;
      else counts.set(p.category, { count: 1, post: p });
    }
    const rank = (name: string) => {
      const i = CATEGORY_ORDER.indexOf(name);
      return i === -1 ? CATEGORY_ORDER.length : i;
    };
    return Array.from(counts.entries())
      .sort((a, b) => rank(a[0]) - rank(b[0]))
      .map(([name, { count, post }]) => ({ name, count, icon: STRIP_ICONS[blogCategoryKey(post)] }));
  });

  featuredPost = computed<BlogPost | undefined>(() => this.posts.find(p => p.featured) ?? this.posts[0]);

  filteredPosts = computed<BlogPost[]>(() => {
    const category = this.activeCategory();
    const query = this.searchQuery().trim().toLowerCase();
    return this.posts.filter(p => {
      if (p.slug === this.featuredPost()?.slug) return false;
      if (category !== 'الكل' && p.category !== category) return false;
      if (query) {
        const haystack = [p.title, p.excerpt, p.category, ...p.tags].join(' ').toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  });

  visiblePosts = computed<BlogPost[]>(() => this.filteredPosts().slice(0, this.visibleCount()));
  hasMore = computed<boolean>(() => this.filteredPosts().length > this.visibleCount());

  topPosts = computed<BlogPost[]>(() =>
    [...this.posts].sort((a, b) => parseInt(b.readTime) - parseInt(a.readTime)).slice(0, 4)
  );

  allTags = computed<string[]>(() => {
    const set = new Set<string>();
    for (const p of this.posts) {
      for (const t of p.tags) set.add(t);
    }
    return Array.from(set);
  });

  setCategory(name: string): void {
    this.activeCategory.set(name);
    this.visibleCount.set(PAGE_SIZE);
  }

  setQuickTag(tag: string): void {
    this.searchQuery.set(tag);
    this.activeCategory.set('الكل');
    this.visibleCount.set(PAGE_SIZE);
    this.scrollToResults();
  }

  loadMore(): void {
    this.visibleCount.update(n => n + PAGE_SIZE);
  }

  private hasScrolledForSearch = false;

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.visibleCount.set(PAGE_SIZE);
    if (value.trim()) {
      if (!this.hasScrolledForSearch) {
        this.hasScrolledForSearch = true;
        this.scrollToResults();
      }
    } else {
      this.hasScrolledForSearch = false;
    }
  }

  scrollToResults(): void {
    document.getElementById('blog-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  subscribeNewsletter(): void {
    const email = this.newsletterEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.newsletterError.set('من فضلك أدخل بريداً إلكترونياً صحيحاً');
      return;
    }
    this.newsletterError.set('');
    this.newsletterSubmitting.set(true);
    this.newsletterService.subscribe(email, 'blog').subscribe({
      next: () => {
        this.newsletterSubmitting.set(false);
        this.newsletterSubscribed.set(true);
      },
      error: (err) => {
        this.newsletterSubmitting.set(false);
        this.newsletterError.set(err.error?.message || 'حدث خطأ، حاول مرة أخرى');
      }
    });
  }

  categoryColorClass(color: BlogPost['categoryColor']): string {
    return 'cat-' + color;
  }

  categoryKey(post: BlogPost): BlogCategoryKey {
    return blogCategoryKey(post);
  }

  thumbIcon(post: BlogPost): string {
    return THUMB_ICONS[blogCategoryKey(post)];
  }
}
