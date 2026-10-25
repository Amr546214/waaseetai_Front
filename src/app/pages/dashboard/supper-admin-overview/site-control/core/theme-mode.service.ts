import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

/**
 * مصدر واحد مشترك لحالة "الوضع الجاري تحريره باللوحة" — يقرأه ويكتب فيه كل من
 * DesignTokensService وLevelsService، بحيث مبدّل واحد (بصفحة القيم) يتحكم بكل
 * محرِّرات اللوحة معًا بلا خطر تعارض حالة بين خدمتين منفصلتين.
 */
@Injectable({ providedIn: 'root' })
export class ThemeModeService {
  readonly mode = signal<ThemeMode>('dark');

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }
}
