import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanDeactivateFn } from '@angular/router';
import { AntiCheatService } from '../services/anti-cheat.service';
import { ConfirmModalService } from '../services/confirm-modal.service';

/**
 * Router guard preventing unconfirmed page navigation or tab exits during an active test attempt.
 */
export const quizLockGuard: CanDeactivateFn<any> = async (component, currentRoute, currentState, nextState) => {
  const antiCheatService = inject(AntiCheatService);
  const confirmModalService = inject(ConfirmModalService);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  // If no attempt is currently active, allow navigation
  if (!antiCheatService.isMonitoring()) {
    return true;
  }

  const userConfirm = await confirmModalService.confirm({
    title: '⚠️ مغادرة الاختبار الجاري',
    message: 'أنت على وشك مغادرة شاشة الاختبار أثناء سير المحاولة!\n\nمغادرتك الآن ستؤدي إلى فقدان تقدمك في هذه المحاولة.\n\nهل أنت متأكد من رغبتك في المغادرة؟',
    type: 'danger',
    confirmText: 'نعم، مغادرة الاختبار',
    cancelText: 'البقاء ومتابعة الاختبار'
  });

  if (userConfirm) {
    antiCheatService.stopMonitoring();
    return true;
  }

  return false;
};
