import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActiveProjectsService } from '../../../../../core/services/active.service';

interface ArchivedProject {
  id: string;
  displayId: string;
  title: string;
  clientName: string;
  value: string;
  date: string;
  status: 'done' | 'cancel' | 'arch';
  icon: string;
}

@Component({
  selector: 'app-archived',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './archived.html',
})
export class Archived implements OnInit {
  private activeProjectsService = inject(ActiveProjectsService);

  searchQuery = signal('');
  activeFilter = signal<'all' | 'done' | 'cancel' | 'arch'>('all');
  isLoading = signal(true);

  projects = signal<ArchivedProject[]>([]);

  ngOnInit() {
    this.fetchArchivedProjects();
  }

  fetchArchivedProjects() {
    this.isLoading.set(true);
    this.activeProjectsService.getArchivedProjects().subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res && res.data) {
          this.projects.set(res.data);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Error fetching archived projects:', err);
      }
    });
  }

  filteredProjects = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const filter = this.activeFilter();
    return this.projects().filter(p => {
      const matchQuery = !query || p.title.toLowerCase().includes(query) || p.displayId.toLowerCase().includes(query);
      const matchFilter = filter === 'all' || p.status === filter;
      return matchQuery && matchFilter;
    });
  });

  stats = computed(() => {
    const all = this.projects();
    return {
      done: all.filter(p => p.status === 'done').length,
      cancel: all.filter(p => p.status === 'cancel').length,
      arch: all.filter(p => p.status === 'arch').length,
      total: all.length
    };
  });

  setFilter(filter: 'all' | 'done' | 'cancel' | 'arch') {
    this.activeFilter.set(filter);
  }

  updateSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }
}
