import { Component, computed, inject } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { BlogPost, getPostBySlug, getRelatedPosts } from '../blog-data';

@Component({
  selector: 'app-blog-article',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './article.html',
  styleUrl: './article.css'
})
export class BlogArticle {
  private route = inject(ActivatedRoute);

  private slug = toSignal(
    this.route.paramMap.pipe(map(params => params.get('slug') ?? '')),
    { initialValue: '' }
  );

  post = computed<BlogPost | undefined>(() => getPostBySlug(this.slug()));
  related = computed<BlogPost[]>(() => getRelatedPosts(this.slug(), 2));

  tocItems = computed<{ id: string; title: string }[]>(() => {
    const current = this.post();
    if (!current) return [];
    return current.content
      .map((section, index) => ({ id: 's' + index, title: section.heading }))
      .filter((item): item is { id: string; title: string } => !!item.title);
  });

  categoryColorClass(color: BlogPost['categoryColor']): string {
    return 'cat-' + color;
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
