import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BLOG_POSTS, BlogPost } from './blog-data';

@Component({
  selector: 'app-blog',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './blog.html',
  styleUrl: './blog.css',
})
export class Blog {
  posts: BlogPost[] = BLOG_POSTS;

  activeCategory = signal<string>('الكل');
  searchQuery = signal<string>('');

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
  }

  categoryColorClass(color: BlogPost['categoryColor']): string {
    return 'cat-' + color;
  }
}
