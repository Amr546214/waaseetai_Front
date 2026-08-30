import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanDeactivateFn } from '@angular/router';
import { AntiCheatService } from '../services/anti-cheat.service';
import { ConfirmModalService } from '../services/confirm-modal.service';

/**
 * Router guard preventing unconfirmed page navigation or tab exits during active test execution.
 * Enforces anti-cheat compliance using a theme-aware custom confirmation dialog.
 */
export const quizLockGuard: CanDeactivateFn<any> = async (component, currentRoute, currentState, nextState) => {
  const antiCheatService = inject(AntiCheatService);
  const confirmModalService = inject(ConfirmModalService);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  // If the secure monitoring environment is not active or test is finished/invalidated, allow navigation
  if (!antiCheatService.isMonitoring() || antiCheatService.isInvalidated()) {
    return true;
  }

  // Intercept navigation attempt during active examination via custom Cyber-Creative modal
  const userConfirm = await confirmModalService.confirm({
    title: '⚠️ تنبيه أمني حازم من نظام وسيط AI',
    message: 'أنت على وشك مغادرة بيئة الاختبار الفوري المؤمنة أثناء سير الاختبار!\n\nمغادرتك الآن ستعد مخالفة جسيمة لشروط مكافحة الغش، وستؤدي لإلغاء النتيجة وتطبيق حظر الإعادة لمدة 24 ساعة.\n\nهل أنت متأكد تماماً من رغبتك في المغادرة والإلغاء؟',
    type: 'danger',
    confirmText: 'نعم، مغادرة وإلغاء الاختبار',
    cancelText: 'البقاء ومتابعة الاختبار'
  });

  if (userConfirm) {
    // Report explicit abort violation to backend before allowing exit
    antiCheatService.reportViolation('NAVIGATION_ABORT');
    antiCheatService.stopMonitoring();
    return true;
  } else {
    // User aborted exit; record focus recovery and block route transition
    antiCheatService.latestWarning.set('🛡️ تم البقاء في الاختبار. الرجاء الالتزام بشروط بيئة الفحص حتى الإتمام.');
    return false;
  }
};
