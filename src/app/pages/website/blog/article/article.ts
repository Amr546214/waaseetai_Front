import { Component, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { BLOG_POSTS, BlogPost, BlogCategoryKey, blogCategoryKey, getPostBySlug, getRelatedPosts } from '../blog-data';
import { NewsletterService } from '../../../../core/services/newsletter.service';

const ICONS: Record<BlogCategoryKey, string> = {
  prov: 'bart-provider',
  client: 'bart-client',
  broker: 'bart-broker',
  ai: 'bart-trust-ai',
  tips: 'bart-tag',
};

@Component({
  selector: 'app-blog-article',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './article.html',
  styleUrl: './article.css',
  host: {
    '(window:scroll)': 'onScroll()',
  },
})
export class BlogArticle {
  private route = inject(ActivatedRoute);
  private document = inject(DOCUMENT);
  private newsletterService = inject(NewsletterService);

  private slug = toSignal(
    this.route.paramMap.pipe(map(params => params.get('slug') ?? '')),
    { initialValue: '' }
  );

  post = computed<BlogPost | undefined>(() => getPostBySlug(this.slug()));
  related = computed<BlogPost[]>(() => getRelatedPosts(this.slug(), 2));

  /** Sidebar "الأكثر قراءة": other posts (same ranking the blog index uses), current post excluded. */
  sidePosts = computed<BlogPost[]>(() =>
    BLOG_POSTS.filter(p => p.slug !== this.slug())
      .sort((a, b) => parseInt(b.readTime) - parseInt(a.readTime))
      .slice(0, 3)
  );

  /** Extra audience chips: tags on this post that are themselves blog categories. */
  extraCategories = computed<BlogPost[]>(() => {
    const current = this.post();
    if (!current) return [];
    const seen = new Set<string>([current.category]);
    const out: BlogPost[] = [];
    for (const tag of current.tags) {
      if (seen.has(tag)) continue;
      const sample = BLOG_POSTS.find(p => p.category === tag);
      if (sample) {
        seen.add(tag);
        out.push(sample);
      }
    }
    return out;
  });

  tocItems = computed<{ id: string; title: string }[]>(() => {
    const current = this.post();
    if (!current) return [];
    return current.content
      .map((section, index) => ({ id: 's' + index, title: section.heading }))
      .filter((item): item is { id: string; title: string } => !!item.title);
  });

  activeSection = signal<string>('');
  readProgress = signal<number>(0);

  newsletterEmail = '';
  newsletterSubscribed = signal(false);
  newsletterError = signal('');
  newsletterSubmitting = signal(false);

  categoryColorClass(color: BlogPost['categoryColor']): string {
    return 'cat-' + color;
  }

  categoryKey(post: BlogPost): BlogCategoryKey {
    return blogCategoryKey(post);
  }

  categoryIcon(post: BlogPost): string {
    return ICONS[blogCategoryKey(post)];
  }

  shareUrl(network: 'x' | 'whatsapp' | 'linkedin'): string {
    const current = this.post();
    const url = this.document.location?.href ?? '';
    const text = current?.title ?? '';
    const u = encodeURIComponent(url);
    const t = encodeURIComponent(text);
    switch (network) {
      case 'x':
        return `https://twitter.com/intent/tweet?text=${t}&url=${u}`;
      case 'whatsapp':
        return `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
      case 'linkedin':
        return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    }
  }

  share(network: 'x' | 'whatsapp' | 'linkedin'): void {
    const win = this.document.defaultView;
    win?.open(this.shareUrl(network), '_blank', 'noopener,noreferrer');
  }

  onScroll(): void {
    // Whole-page progress: scrollY / (scrollHeight - innerHeight) => 0% at the top, exactly 100% at
    // the real end of the page (the article body alone never reaches its end while the footer and
    // related-posts sections still add scroll distance after it).
    const win = this.document.defaultView;
    if (win) {
      const maxScroll = this.document.documentElement.scrollHeight - win.innerHeight;
      this.readProgress.set(maxScroll > 0 ? Math.min(100, Math.max(0, (win.scrollY / maxScroll) * 100)) : 0);
    }
    const items = this.tocItems();
    let active = items[0]?.id ?? '';
    for (const item of items) {
      const el = this.document.getElementById(item.id);
      if (el && el.getBoundingClientRect().top < 120) active = item.id;
    }
    this.activeSection.set(active);
  }

  subscribeNewsletter(): void {
    const email = this.newsletterEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.newsletterError.set('من فضلك أدخل بريداً إلكترونياً صحيحاً');
      return;
    }
    this.newsletterError.set('');
    this.newsletterSubmitting.set(true);
    this.newsletterService.subscribe(email, 'blog-article').subscribe({
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

  scrollToSection(id: string): void {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.pageYOffset - 90;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }
}
