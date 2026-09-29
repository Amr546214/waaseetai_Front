import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { ProviderSpecialOfferService } from '../../../../../core/services/provider-special-offer.service';
import { CompanyTeamService } from '../../../../../core/services/company-team.service';
import { NewProjectService } from '../../../../../core/services/new-project.service';
import { ProviderSpecialOffer } from '../../../../../core/models/marketing.model';
import { CompanyTeamMember } from '../../../../../core/models/company-team.model';
import {
  Flash, ProviderModelOption, STATUS_LABELS, STATUS_PILL, ToolDisplayStatus, avatarGradient, describeOffer, formatNumber, httpErrorMessage, initials,
  isToggleable, mapProviderModels, offerStatus, validityLabel,
} from '../marketing-utils';

export interface OfferRow {
  offer: ProviderSpecialOffer;
  status: ToolDisplayStatus;
  meta: string;
  description: string;
  assignee: CompanyTeamMember | null;
}

/** P-PR-041 (individual) / P-CO-MK-007 (company) — العروض الخاصة (card list). */
@Component({
  selector: 'app-marketing-offers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './offers.html',
  styleUrls: ['../marketing-shared.css'],
})
export class MarketingOffers implements OnInit {
  private authStore = inject(AuthStore);
  private offerApi = inject(ProviderSpecialOfferService);
  private teamApi = inject(CompanyTeamService);
  private modelsApi = inject(NewProjectService);
  private destroyRef = inject(DestroyRef);

  isCompanyMode = computed<boolean>(() => this.authStore.currentUser()?.accountType === AccountType.PROVIDER_COMPANY);

  readonly statusLabels = STATUS_LABELS;
  readonly statusPill = STATUS_PILL;
  readonly fmt = formatNumber;
  readonly initials = initials;
  readonly avatarBg = avatarGradient;
  readonly validity = validityLabel;
  readonly toggleable = isToggleable;
  readonly flash = new Flash();

  offers = signal<ProviderSpecialOffer[]>([]);
  models = signal<ProviderModelOption[]>([]);
  team = signal<CompanyTeamMember[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  busy = signal<Set<string>>(new Set());
  /** "إيراد إضافي من الباقات" — GET /provider/special-offers/summary; null until loaded / on error. */
  bundleRevenue = signal<number | null>(null);

  search = signal('');
  memberFilter = signal('all');

  rows = computed<OfferRow[]>(() => {
    const names = new Map(this.models().map(m => [m.id, m.title]));
    const team = new Map(this.team().map(m => [m.id, m]));
    return this.offers().map(o => ({
      offer: o,
      status: offerStatus(o),
      ...describeOffer(o, names),
      assignee: o.assignedToTeamMemberId ? team.get(o.assignedToTeamMemberId) ?? null : null,
    }));
  });

  filteredRows = computed(() => {
    const q = this.search().trim();
    const mf = this.memberFilter();
    return this.rows().filter(r => {
      if (q && !r.offer.name.includes(q)) return false;
      if (mf === 'none' && r.offer.assignedToTeamMemberId) return false;
      if (mf !== 'all' && mf !== 'none' && r.offer.assignedToTeamMemberId !== mf) return false;
      return true;
    });
  });

  kpis = computed(() => {
    const rows = this.rows();
    return {
      active: rows.filter(r => r.status === 'ACTIVE').length,
      expired: rows.filter(r => r.status === 'EXPIRED').length,
      pending: rows.filter(r => r.status === 'PENDING').length,
      totalUses: rows.reduce((a, r) => a + (r.offer.usedCount || 0), 0),
    };
  });

  ngOnInit(): void {
    this.load();
    this.offerApi.getSummary().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => this.bundleRevenue.set(res.data?.bundleExtraRevenue ?? null),
      error: () => this.bundleRevenue.set(null),
    });
    this.modelsApi.getMyMarketModels().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => this.models.set(mapProviderModels(res)),
      error: () => this.models.set([]),
    });
    if (this.isCompanyMode()) {
      this.teamApi.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: res => this.team.set(res.data ?? []),
        error: () => this.team.set([]),
      });
    }
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.offerApi.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.offers.set(res.data ?? []);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(httpErrorMessage(err, 'تعذر تحميل العروض الخاصة'));
        this.loading.set(false);
      },
    });
  }

  toggleActive(o: ProviderSpecialOffer, ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const next = input.checked;
    const set = new Set(this.busy());
    set.add(o.id);
    this.busy.set(set);
    const done = () => {
      const s = new Set(this.busy());
      s.delete(o.id);
      this.busy.set(s);
    };
    this.offerApi.setActive(o.id, next).subscribe({
      next: res => {
        this.offers.update(list => list.map(x => (x.id === o.id ? res.data : x)));
        done();
        this.flash.show(res.data.active ? `تم تفعيل «${o.name}»` : `تم إيقاف «${o.name}»`);
      },
      error: err => {
        input.checked = !next;
        done();
        this.flash.show(httpErrorMessage(err, 'تعذر تحديث حالة العرض'), true);
      },
    });
  }
}
