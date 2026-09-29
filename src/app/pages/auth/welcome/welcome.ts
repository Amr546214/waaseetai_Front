import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AccountType, UserRole } from '../../../core/models/auth.model';
import { getDefaultDashboard } from '../../../core/guards/auth.guards';

interface WelcomeRoleConfig {
  name: string;
  /** id (without '#') of the symbol defined in welcome.html's inline <svg><defs>. */
  icon: string;
  canSkip: boolean;
  completionNote: string;
  restrictions: string[] | null;
  profileSetupRoute: string;
}

/**
 * Fixed restrictions list shown on the mandatory/blocking card, copied
 * verbatim from design-reference P-CM-001's ROLES.<role>.canSkip === false
 * branch (it's the same list for every mandatory role, hardcoded in the
 * design's buildUI() rather than per-role).
 */
const MANDATORY_RESTRICTIONS = [
  'رفع أو استقبال أي طلب رسمي',
  'إجراء أي مدفوعات أو عقود',
  'الوصول لأدوات العمل الرئيسية',
];

/**
 * Mirrors design-reference/extracted/.../P-CM-001.html's inline `ROLES`
 * script object exactly (name, canSkip, completionNote, restrictions) — see
 * that file for the source of truth. `dashboard` links from the mockup are
 * static placeholders and are intentionally NOT reused here; the real
 * dashboard target is resolved via getDefaultDashboard() instead.
 * `profileSetupRoute` maps to the actual existing "استكمال البيانات" route
 * per dashboard area (client.routes.ts / provider.routes.ts / marketer.routes.ts).
 */
const ROLES: Record<string, WelcomeRoleConfig> = {
  'client-individual': {
    name: 'طالب الخدمة (فرد)',
    icon: 'ws-role-user',
    canSkip: true,
    completionNote: 'استكمال بياناتك داخل اللوحة يتيح لك رفع الطلبات الرسمية وإجراء المدفوعات وإبرام العقود',
    restrictions: [
      'رفع طلبات الخدمة الرسمية',
      'إجراء المدفوعات وتفعيل الضمان المالي',
      'إبرام العقود الرقمية الموثقة',
    ],
    profileSetupRoute: '/client-overview/profile-setup',
  },
  'client-company': {
    name: 'طالب الخدمة (شركة)',
    icon: 'ws-role-building',
    canSkip: false,
    completionNote: 'يجب استكمال بيانات الشركة والسجل التجاري داخل لوحة التحكم قبل استخدام الموقع فعليا',
    restrictions: null,
    profileSetupRoute: '/client-overview/profile-setup',
  },
  'provider-individual': {
    name: 'مقدم الخدمة (فرد)',
    icon: 'ws-role-provider',
    canSkip: false,
    completionNote: 'يجب استكمال ملفك المهني داخل لوحة التحكم قبل عرض خدماتك واستقبال الطلبات',
    restrictions: null,
    profileSetupRoute: '/provider-overview/profile/setup',
  },
  'provider-company': {
    name: 'مقدم الخدمة (شركة)',
    icon: 'ws-role-building',
    canSkip: false,
    completionNote: 'يجب استكمال بيانات الشركة والملف المهني داخل لوحة التحكم قبل بدء تقديم الخدمات',
    restrictions: null,
    profileSetupRoute: '/provider-overview/profile/setup',
  },
  broker: {
    name: 'الوسيط التسويقي',
    icon: 'ws-role-broker',
    canSkip: true,
    completionNote: 'استكمال بياناتك داخل اللوحة يتيح لك استلام العمولات وتنفيذ العمليات الرسمية',
    restrictions: ['استلام العمولات والمدفوعات', 'سحب الأرباح', 'تنفيذ عمليات رسمية موثقة'],
    profileSetupRoute: '/marketer-overview/profile-setup',
  },
};

/** The accountType each design role key implies, used as a fallback when the
 * caller didn't also pass an explicit `accountType` query param. */
const ROLE_ACCOUNT_TYPES: Record<string, AccountType> = {
  'client-individual': AccountType.CLIENT_INDIVIDUAL,
  'client-company': AccountType.CLIENT_COMPANY,
  'provider-individual': AccountType.PROVIDER_INDIVIDUAL,
  'provider-company': AccountType.PROVIDER_COMPANY,
  broker: AccountType.MARKETING_BROKER,
};

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',
  encapsulation: ViewEncapsulation.None,
})
export class Welcome {
  /** null => unknown/missing role => template renders the error state. */
  cfg: WelcomeRoleConfig | null = null;
  dashboardRoute = '/client-overview';
  readonly mandatoryRestrictions = MANDATORY_RESTRICTIONS;

  constructor(route: ActivatedRoute) {
    const params = route.snapshot.queryParamMap;
    const role = params.get('role') || '';
    const cfg = ROLES[role] || null;
    if (!cfg) return;

    this.cfg = cfg;

    // accountType/activeRole are passed by login/register from the real
    // authenticated user; fall back to the role key's own implied account
    // type so a direct /auth/welcome?role=... visit still resolves somewhere
    // sensible.
    const accountTypeParam = params.get('accountType') as AccountType | null;
    const activeRoleParam = params.get('activeRole') as UserRole | null;
    const accountType: AccountType | undefined =
      (accountTypeParam && Object.values(AccountType).includes(accountTypeParam) ? accountTypeParam : undefined) ??
      ROLE_ACCOUNT_TYPES[role];
    const activeRole: UserRole | undefined =
      activeRoleParam && Object.values(UserRole).includes(activeRoleParam) ? activeRoleParam : undefined;

    this.dashboardRoute = getDefaultDashboard(accountType, activeRole);
  }
}
