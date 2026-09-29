import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface ConfirmModalConfig {
  title: string;
  message: string;
  type: 'danger' | 'warning' | 'info' | 'success';
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  /** sm (380px, default) for confirmations · md (560px) for quick forms · lg (760px) for composite content */
  size?: 'sm' | 'md' | 'lg';
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmModalService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  public isOpen = signal<boolean>(false);
  public config = signal<ConfirmModalConfig | null>(null);

  private promiseResolver: ((val: boolean) => void) | null = null;

  /**
   * Opens the custom Cyber-Creative dialog and returns a Promise that resolves
   * to true (confirmed/OK) or false (canceled/dismissed).
   */
  public confirm(customConfig: ConfirmModalConfig): Promise<boolean> {
    if (!this.isBrowser) {
      return Promise.resolve(true);
    }

    // Default button labels in professional Arabic
    const defaults: Partial<ConfirmModalConfig> = {
      confirmText: customConfig.confirmText || 'تأكيد والمتابعة',
      cancelText: customConfig.cancelText || 'إلغاء التراجع',
      showCancel: customConfig.showCancel !== undefined ? customConfig.showCancel : true,
      size: customConfig.size || 'sm'
    };

    this.config.set({ ...customConfig, ...defaults } as ConfirmModalConfig);
    this.isOpen.set(true);

    return new Promise<boolean>((resolve) => {
      this.promiseResolver = resolve;
    });
  }

  /**
   * Shortcut for alert/notification without cancel button
   */
  public notify(title: string, message: string, type: 'info' | 'success' | 'warning' | 'danger' = 'info', confirmText = 'حسناً، فهمت'): Promise<boolean> {
    return this.confirm({
      title,
      message,
      type,
      confirmText,
      showCancel: false
    });
  }

  public accept(): void {
    if (this.promiseResolver) {
      this.promiseResolver(true);
      this.promiseResolver = null;
    }
    this.close();
  }

  public reject(): void {
    if (this.promiseResolver) {
      this.promiseResolver(false);
      this.promiseResolver = null;
    }
    this.close();
  }

  private close(): void {
    this.isOpen.set(false);
    this.config.set(null);
  }
}
