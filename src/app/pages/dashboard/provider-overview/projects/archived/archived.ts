import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActiveProjectsService } from '../../../../../core/services/active.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

interface ArchivedProject {
  id: string;
  displayId: string;
  title: string;
  clientName: string;
  value: string;
  date: string;
  status: 'done' | 'cancel' | 'arch';
  icon: string;
  providerName?: string;
  providerInitial?: string;
  providerAvatarColor?: string;
  memberSpec?: string;
}

@Component({
  selector: 'app-archived',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './archived.html',
  styleUrls: ['./archived.css'],
})
export class Archived implements OnInit {
  private activeProjectsService = inject(ActiveProjectsService);
  private authStore = inject(AuthStore);

  searchQuery = signal('');
  activeFilter = signal<'all' | 'done' | 'cancel' | 'arch'>('all');
  memberFilter = signal<string>('all');
  periodFilter = signal<string>('all');
  isLoading = signal(true);
  hasError = signal(false);
  errorMessage = signal('');

  isCompanyMode = computed<boolean>(() => {
    const user = this.authStore.currentUser();
    return user?.accountType === AccountType.PROVIDER_COMPANY;
  });

  projects = signal<ArchivedProject[]>([]);

  ngOnInit() {
    this.fetchArchivedProjects();
  }

  fetchArchivedProjects() {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.errorMessage.set('');
    this.activeProjectsService.getArchivedProjects().subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res && res.data) {
          this.projects.set(res.data);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.hasError.set(true);
        this.errorMessage.set(err?.message || 'ERR-PR-025');
        console.error('Error fetching archived projects:', err);
      }
    });
  }

  retry() {
    this.fetchArchivedProjects();
  }

  filteredProjects = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const filter = this.activeFilter();
    const member = this.memberFilter();
    return this.projects().filter(p => {
      const matchQuery = !query || p.title.toLowerCase().includes(query) || p.displayId.toLowerCase().includes(query);
      const matchFilter = filter === 'all' || p.status === filter;
      const matchMember = member === 'all' || (p.providerName || '').toLowerCase().includes(member.toLowerCase());
      return matchQuery && matchFilter && matchMember;
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

  teamMembers = computed(() => {
    const members = new Map<string, { name: string; initial: string; color: string }>();
    this.projects().forEach(p => {
      const key = p.providerName || 'unknown';
      if (!members.has(key)) {
        members.set(key, {
          name: p.providerName || 'مقدم خدمة',
          initial: p.providerInitial || 'مق',
          color: p.providerAvatarColor || '#2BD4C7'
        });
      }
    });
    return Array.from(members.values());
  });

  setFilter(filter: 'all' | 'done' | 'cancel' | 'arch') {
    this.activeFilter.set(filter);
  }

  setMemberFilter(member: string) {
    this.memberFilter.set(member);
  }

  setPeriodFilter(period: string) {
    this.periodFilter.set(period);
  }

  updateSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  statusLabel(status: 'done' | 'cancel' | 'arch'): string {
    if (status === 'done') return 'مكتمل';
    if (status === 'cancel') return 'ملغى';
    return 'مؤرشف';
  }
}
