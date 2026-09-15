import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BLOG_POSTS, BlogPost } from './blog-data';
import { NewsletterService } from '../../../core/services/newsletter.service';

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

  activeCategory = signal<string>('الكل');
  searchQuery = signal<string>('');

  newsletterEmail = '';
  newsletterSubscribed = signal(false);
  newsletterError = signal('');
  newsletterSubmitting = signal(false);

  categories = computed(() => {
    const counts = new Map<string, number>();
    for (const p of this.posts) {
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  });

  featuredPost = computed<BlogPost | undefined>(() => this.posts.find(p => p.featured) ?? this.posts[0]);

  filteredPosts = computed<BlogPost[]>(() => {
    const category = this.activeCategory();
    const query = this.searchQuery().trim().toLowerCase();
    return this.posts.filter(p => {
      if (p.slug === this.featuredPost()?.slug) return false;
      if (category !== 'الكل' && p.category !== category) return false;
      if (query && !p.title.toLowerCase().includes(query) && !p.excerpt.toLowerCase().includes(query)) return false;
      return true;
    });
  });

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
  }

  setQuickTag(tag: string): void {
    this.searchQuery.set(tag);
    this.activeCategory.set('الكل');
    this.scrollToResults();
  }

  private hasScrolledForSearch = false;

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
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
}
