
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { applicationConfig } from '@storybook/angular-vite';
import { Component, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { NEVER, of, Subject, throwError } from 'rxjs';
import { userEvent, within, waitFor } from 'storybook/test';

import { Register } from './register';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { AffiliateApiService } from '../../../core/services/affiliate-api.service';
import { AuthStore } from '../../../core/store/auth.store';
import { WaitTimerService } from '../../../core/wait/wait-timer.service';
import { SocialAuthService } from '@abacritt/angularx-social-login';

// ===================================
// Mock Router Page
// ===================================

// كل البيانات تجريبية.
// لا يتم إرسال HTTP أو إيميلات حقيقية.

@Component({
  selector: 'storybook-register-empty-page',
  standalone: true,
  template: '',
})
class EmptyPage {}

// ===================================
// Mock Modes
// ===================================

type Mode =
  | 'normal'
  | 'loading'
  | 'mailError'
  | 'registerRateLimit'
  | 'invalidCode'
  | 'codeLocked'
  | 'verifyRateLimit'
  | 'dataUnavailable'
  | 'accountReady'
  | 'resendError'
  | 'resendSuccess'
  | 'registrationClosed';

let mode: Mode = 'normal';

const socialState = new Subject<any>();

// ===================================
// Mock Error Helper
// ===================================

function fail(
  status: number,
  message: string,
  code?: string
) {
  return throwError(() => ({
    status,
    error: {
      message,
      code,
    },
  }));
}

// ===================================
// Mock Authentication API
// ===================================

const fakeAuthApi = {
  registerStart: () => {
    if (mode === 'loading') {
      return NEVER;
    }

    if (mode === 'mailError') {
      return of({
        success: false,
        message: 'تعذر إرسال رمز التحقق الآن',
        data: {
          emailSent: false,
        },
      });
    }

    if (mode === 'registerRateLimit') {
      return fail(
        429,
        'طلبات كثيرة، يمكنك إعادة المحاولة بعد قليل'
      );
    }

    if (mode === 'registrationClosed') {
      return fail(
        403,
        'التسجيل بحسابات جديدة مغلق مؤقتًا',
        'REGISTRATION_CLOSED'
      );
    }

    return of({
      success: true,
      data: {
        emailSent: true,
        ticket: 'storybook-proof-ticket',
      },
    });
  },

  registerComplete: () => {
    if (mode === 'loading') {
      return NEVER;
    }

    if (mode === 'invalidCode') {
      return fail(
        400,
        'رمز التحقق غير صحيح أو منتهي'
      );
    }

    if (mode === 'codeLocked') {
      return fail(
        429,
        'تم تجاوز عدد المحاولات المسموح به، يرجى طلب رمز جديد',
        'OTP_ATTEMPTS_LOCKED'
      );
    }

    if (mode === 'verifyRateLimit') {
      return fail(
        429,
        'طلبات كثيرة، يمكنك إعادة المحاولة بعد قليل'
      );
    }

    if (mode === 'dataUnavailable') {
      return fail(
        409,
        'تعذّر إنشاء حساب بهذه البيانات، صحّح البيانات أو سجّل الدخول',
        'REGISTRATION_DATA_UNAVAILABLE'
      );
    }

    if (mode === 'accountReady') {
      return of({
        success: true,
        message:
          'تم إنشاء الحساب، سجّل الدخول بشكل عادي',
        data: {
          signInRequired: true,
        },
      });
    }

    // لا ننشئ جلسة دخول حقيقية
    return NEVER;
  },

  register: () => NEVER,


verifyOtp: () => {
  // Invalid OTP
  if (mode === 'invalidCode') {
    return fail(
      400,
      'رمز التحقق غير صحيح، يرجى المحاولة مرة أخرى'
    );
  }

  // OTP Attempts Locked
  if (mode === 'codeLocked') {
    return fail(
      429,
      'تم تجاوز عدد المحاولات المسموح به، يرجى طلب رمز جديد',
      'OTP_ATTEMPTS_LOCKED'
    );
  }

  // باقي الحالات لا ترسل طلبات حقيقية
  return NEVER;
},


  resendOtpByEmail: () => {
    if (mode === 'resendError') {
      return fail(
        503,
        'تعذر إعادة إرسال رمز التحقق'
      );
    }

    return of({
      success: true,
      data: {
        emailSent: true,
      },
    });
  },

  googleAuth: () => NEVER,
};

// ===================================
// Mock Affiliate Service
// ===================================

const fakeAffiliates = {
  clearReferralCookie: () =>
    of({
      success: true,
      data: {
        cleared: true,
      },
    }),

  getReferralStatus: () =>
    of({
      success: true,
      data: {
        active: false,
      },
    }),

  resolve: () =>
    of({
      success: false,
      data: null,
    }),

  search: () =>
    of({
      success: true,
      data: [],
    }),
};

// ===================================
// Mock HttpClient
// ===================================

const fakeHttp = {
  get: () => NEVER,
  post: () => NEVER,
  put: () => NEVER,
  patch: () => NEVER,
  delete: () => NEVER,
};

// ===================================
// Mock Auth Store
// ===================================

const fakeAuthStore = {
  currentUser: signal<any>(null),
  pendingUserId: signal<any>(null),
  token: signal<any>(null),

  isPendingVerification: () => false,

  authenticate: () => {},
  setPendingVerification: () => {},
};

// ===================================
// Mock Wait Timer
// ===================================

// مؤقت وهمي للمعاينة.
// اختبارات الوقت الفعلي تكون في Unit Tests.

function waitState() {
  return {
    active: () => false,
    remainingSeconds: () => 0,
    clock: () => '00:00',
    label: () => '',

    start: () => {},
    startFromResponse: () => {},
  };
}

const fakeWaitTimer = {
  trackKeyed: () => () => waitState(),
  track: () => waitState(),
};

// ===================================
// Reset Mocks
// ===================================

function reset() {
  mode = 'normal';
}

// ===================================
// Storybook Configuration
// ===================================

const meta: Meta<Register> = {
  title: 'Waseet AI/Auth/Register',

  component: Register,

  decorators: [
    applicationConfig({
      providers: [
        provideRouter([
          {
            path: '**',
            component: EmptyPage,
          },
        ]),

        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap:
                convertToParamMap({}),
            },
          },
        },

        {
          provide: HttpClient,
          useValue: fakeHttp,
        },

        {
          provide: AuthApiService,
          useValue: fakeAuthApi,
        },

        {
          provide: AffiliateApiService,
          useValue: fakeAffiliates,
        },

        {
          provide: AuthStore,
          useValue: fakeAuthStore,
        },

        {
          provide: WaitTimerService,
          useValue: fakeWaitTimer,
        },

        {
          provide: SocialAuthService,
          useValue: {
            authState: socialState,
            initState: of(undefined),
          },
        },
      ],
    }),
  ],

  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<Register>;

// ===================================
// Account Types
// ===================================

const INDIVIDUAL = 'service_requester_ind';

const PROVIDER = 'service_provider_ind';

const MARKETER = 'marketing_broker';

// ===================================
// Helper: Find Field
// ===================================

function field(
  canvasElement: HTMLElement,
  selector: string
): HTMLInputElement {
  const item =
    canvasElement.querySelector<HTMLInputElement>(
      selector
    );

  if (!item) {
    throw new Error(
      `Register field missing: ${selector}`
    );
  }

  return item;
}

// ===================================
// Helper: Fill Basic Information
// ===================================

async function fillBasicForm(
  canvasElement: HTMLElement
) {
  await userEvent.type(
    field(canvasElement, '#username'),
    'Sara'
  );

  await userEvent.type(
    field(canvasElement, '#email'),
    'sara@example.com'
  );

  // رقم تجريبي بصيغة سعودية مع +966
  await userEvent.type(
    field(canvasElement, '.phone-number-input'),
    '512345678'
  );

  await userEvent.type(
    field(canvasElement, '#password'),
    'Aa1!aaaaaa'
  );

  await userEvent.type(
    field(canvasElement, '#password-confirm'),
    'Aa1!aaaaaa'
  );

  await userEvent.click(
    field(canvasElement, '#chk-accuracy')
  );

  await userEvent.click(
    field(canvasElement, '#terms-chk')
  );
}

// ===================================
// Helper: Submit Basic Information
// ===================================

async function submitBasicForm(
  canvasElement: HTMLElement
) {
  await fillBasicForm(canvasElement);

  const next =
    canvasElement.querySelector<HTMLButtonElement>(
      '#btn-next'
    );

  if (!next) {
    throw new Error('Next button missing');
  }

  await userEvent.click(next);
}

// ===================================
// Helper: Enter and Confirm OTP
// ===================================

// صفحة Register عندنا تحتاج إدخال
// الأرقام ثم تأكيدها باستخدام الزر.

async function enterOtp(
  canvasElement: HTMLElement,
  code = '123456'
) {
  const inputs = Array.from(
    canvasElement.querySelectorAll<HTMLInputElement>(
      '.otp-box'
    )
  );

  if (inputs.length !== 6) {
    throw new Error('Expected six code inputs');
  }

  for (let i = 0; i < 6; i++) {
    await userEvent.type(
      inputs[i],
      code[i]
    );
  }

  const confirm =
    canvasElement.querySelector<HTMLButtonElement>(
      '#btn-confirm'
    );

  if (!confirm) {
    throw new Error('Confirm button not found');
  }

  if (!confirm.disabled) {
    await userEvent.click(confirm);
  }
}

// ===================================
// 1. Default
// ===================================

export const Default: Story = {
  beforeEach: reset,
};

// ===================================
// 2. Select Individual
// ===================================

export const SelectIndividual: Story = {
  beforeEach: reset,

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole('listitem', {
        name: 'طالب الخدمة (فرد)',
      })
    );

    const selected =
      canvasElement.querySelector(
        '[aria-selected="true"]'
      );

    if (
      !selected?.textContent?.includes(
        'طالب الخدمة (فرد)'
      )
    ) {
      throw new Error(
        'Individual role not selected'
      );
    }
  },
};

// ===================================
// 3. Provider Role
// ===================================

export const ProviderRole: Story = {
  beforeEach: reset,

  args: {
    selectedAccountType: PROVIDER,
  },
};

// ===================================
// 4. Marketer Role
// ===================================

export const MarketerRole: Story = {
  beforeEach: reset,

  args: {
    selectedAccountType: MARKETER,
  },
};

// ===================================
// 5. Company Roles Unavailable
// ===================================

export const CompanyRolesUnavailable: Story = {
  beforeEach: reset,

  play: async ({ canvasElement }) => {
    const unavailable =
      canvasElement.querySelectorAll(
        '.role-card[aria-disabled="true"]'
      );

    if (unavailable.length !== 2) {
      throw new Error(
        `Expected two disabled company roles; found ${unavailable.length}`
      );
    }
  },
};

// ===================================
// 6. Basic Information
// ===================================

export const BasicInformation: Story = {
  beforeEach: reset,

  args: {
    currentStep: 2,
    selectedAccountType: INDIVIDUAL,
  },
};

// ===================================
// 7. Provider Information
// ===================================

export const ProviderInformation: Story = {
  beforeEach: reset,

  args: {
    currentStep: 2,
    selectedAccountType: PROVIDER,
  },
};

// ===================================
// 8. Marketer Information
// ===================================

export const MarketerInformation: Story = {
  beforeEach: reset,

  args: {
    currentStep: 2,
    selectedAccountType: MARKETER,
  },

  play: async ({ canvasElement }) => {
    if (
      canvasElement.querySelector(
        '.referral-card'
      )
    ) {
      throw new Error(
        'Marketer must not see referral picker'
      );
    }
  },
};

// ===================================
// 9. Required Fields
// ===================================

export const RequiredFields: Story = {
  beforeEach: reset,

  args: {
    currentStep: 2,
    selectedAccountType: INDIVIDUAL,
  },

  play: async ({ canvasElement }) => {
    const btn =
      canvasElement.querySelector<HTMLButtonElement>(
        '#btn-next'
      );

    if (!btn) {
      throw new Error('Next button missing');
    }

    await userEvent.click(btn);

    if (
      !canvasElement.querySelector('#err-username') ||
      !canvasElement.querySelector('#err-email')
    ) {
      throw new Error(
        'Required field messages were not shown'
      );
    }
  },
};

// ===================================
// 10. Invalid Email
// ===================================

export const InvalidEmail: Story = {
  beforeEach: reset,

  args: {
    currentStep: 2,
    selectedAccountType: INDIVIDUAL,
  },

  play: async ({ canvasElement }) => {
    await userEvent.type(
      field(canvasElement, '#email'),
      'invalid-email'
    );

    await userEvent.tab();

    if (
      !canvasElement.querySelector(
        '#err-email'
      )
    ) {
      throw new Error(
        'Email validation missing'
      );
    }
  },
};

// ===================================
// 11. Show / Hide Passwords
// ===================================


export const ShowHidePasswords: Story = {
  beforeEach: reset,

  args: {
    currentStep: 2,
    selectedAccountType: INDIVIDUAL,
  },

  play: async ({ canvasElement }) => {
    const pass = field(canvasElement, '#password');
    const confirm = field(canvasElement, '#password-confirm');

    const toggle1 =
      canvasElement.querySelector<HTMLButtonElement>(
        '#pw-toggle-1'
      );

    const toggle2 =
      canvasElement.querySelector<HTMLButtonElement>(
        '#pw-toggle-2'
      );

    if (!toggle1 || !toggle2) {
      throw new Error('Password toggles not found');
    }

    // Show Passwords
    await userEvent.click(toggle1);
    await userEvent.click(toggle2);

    if (
      pass.getAttribute('type') !== 'text' ||
      confirm.getAttribute('type') !== 'text'
    ) {
      throw new Error('Show passwords failed');
    }

    // Hide Passwords
    await userEvent.click(toggle1);
    await userEvent.click(toggle2);

    if (
      pass.getAttribute('type') !== 'password' ||
      confirm.getAttribute('type') !== 'password'
    ) {
      throw new Error('Hide passwords failed');
    }
  },
};


// ===================================
// 12. Password Mismatch
// ===================================

export const PasswordMismatch: Story = {
  beforeEach: reset,

  args: {
    currentStep: 2,
    selectedAccountType: INDIVIDUAL,
  },

  play: async ({ canvasElement }) => {
    await userEvent.type(
      field(canvasElement, '#password'),
      'Aa1!aaaaaa'
    );

    await userEvent.type(
      field(canvasElement, '#password-confirm'),
      'Different123!'
    );

    await userEvent.tab();

    if (
      !canvasElement.querySelector(
        '#err-confirm'
      )
    ) {
      throw new Error(
        'Password mismatch not shown'
      );
    }
  },
};

// ===================================
// 13. Proof Email Sent
// ===================================

export const ProofEmailSent: Story = {
  beforeEach: reset,

  args: {
    currentStep: 2,
    selectedAccountType: INDIVIDUAL,
  },

  play: async ({ canvasElement }) => {
    await submitBasicForm(canvasElement);

    await waitFor(() => {
      if (
        !canvasElement.querySelector(
          '#otp-group'
        )
      ) {
        throw new Error(
          'OTP step did not open'
        );
      }
    });
  },
};

// ===================================
// 14. Proof Mail Unavailable
// ===================================

export const ProofMailUnavailable: Story = {
  beforeEach: () => {
    mode = 'mailError';
  },

  args: {
    currentStep: 2,
    selectedAccountType: INDIVIDUAL,
  },

  play: async ({ canvasElement }) => {
    await submitBasicForm(canvasElement);

    await waitFor(() => {
      if (
        !canvasElement.querySelector(
          '#banner-error'
        )
      ) {
        throw new Error(
          'Mail failure not shown'
        );
      }
    });

    if (
      canvasElement.querySelector(
        '#otp-group'
      )
    ) {
      throw new Error(
        'OTP should not open when no email was sent'
      );
    }
  },
};

// ===================================
// 15. Registration Rate Limit
// ===================================

export const RegistrationRateLimit: Story = {
  beforeEach: () => {
    mode = 'registerRateLimit';
  },

  args: {
    currentStep: 2,
    selectedAccountType: INDIVIDUAL,
  },

  play: async ({ canvasElement }) => {
    await submitBasicForm(canvasElement);

    await waitFor(() => {
      if (
        !canvasElement.querySelector(
          '[data-testid="rate-limit-msg"]'
        )
      ) {
        throw new Error(
          'Rate limit message missing'
        );
      }
    });
  },
};

// ===================================
// 16. Registration Closed
// ===================================

export const RegistrationClosed: Story = {
  beforeEach: () => {
    mode = 'registrationClosed';
  },

  args: {
    currentStep: 2,
    selectedAccountType: INDIVIDUAL,
  },

  play: async ({ canvasElement }) => {
    await submitBasicForm(canvasElement);

    await waitFor(() => {
      if (
        !canvasElement.querySelector(
          '#banner-error'
        )
      ) {
        throw new Error(
          'Registration-closed message missing'
        );
      }
    });
  },
};

// ===================================
// OTP Step Args
// ===================================

const codeArgs = {
  currentStep: 3,
  selectedAccountType: INDIVIDUAL,
  registeredEmail: 'sara@example.com',
};

// ===================================
// 17. OTP Step
// ===================================

export const OtpStep: Story = {
  beforeEach: reset,

  args: codeArgs,
};

// ===================================
// 18. OTP Required
// ===================================

export const OtpRequired: Story = {
  beforeEach: reset,

  args: codeArgs,

  play: async ({ canvasElement }) => {
    const button =
      canvasElement.querySelector<HTMLButtonElement>(
        '#btn-confirm'
      );

    if (!button) {
      throw new Error(
        'Confirm button missing'
      );
    }

    await userEvent.click(button);

    await waitFor(() => {
      if (
        !canvasElement.textContent?.includes(
          '6 أرقام'
        )
      ) {
        throw new Error(
          'Six-digit warning missing'
        );
      }
    });
  },
};

// ===================================
// 19. Invalid OTP
// ===================================

export const InvalidOtp: Story = {
  beforeEach: () => {
    mode = 'invalidCode';
  },

  args: codeArgs,

  play: async ({ canvasElement }) => {
    await enterOtp(canvasElement);

    await waitFor(() => {
      const error =
        canvasElement.querySelector(
          '#banner-error'
        );

      if (!error) {
        throw new Error(
          'Invalid OTP error did not appear'
        );
      }

      if (
        !error.textContent?.includes(
          'غير صحيح'
        )
      ) {
        throw new Error(
          'Expected invalid OTP error message'
        );
      }
    });
  },
};

// ===================================
// 20. OTP Attempts Locked
// ===================================

export const OtpAttemptsLocked: Story = {
  beforeEach: () => {
    mode = 'codeLocked';
  },

  args: codeArgs,

  play: async ({ canvasElement }) => {
    await enterOtp(canvasElement);

    await waitFor(() => {
      const message =
        canvasElement.textContent ?? '';

      if (
        !message.includes(
          'رمز جديد'
        )
      ) {
        throw new Error(
          'OTP attempts locked message did not appear'
        );
      }
    });
  },
};

// ===================================
// 21. Resend OTP Success
// ===================================

export const ResendOtpSuccess: Story = {
  beforeEach: () => {
    mode = 'resendSuccess';
  },

  args: codeArgs,

  play: async ({ canvasElement }) => {
    const button =
      canvasElement.querySelector<HTMLButtonElement>(
        '#btn-resend'
      );

    if (!button) {
      throw new Error(
        'Resend button missing'
      );
    }

    await userEvent.click(button);

    await waitFor(() => {
      if (
        !canvasElement.querySelector(
          '#otp-notice'
        )
      ) {
        throw new Error(
          'Resend notice missing'
        );
      }
    });
  },
};

// ===================================
// 22. Resend OTP Error
// ===================================

export const ResendOtpError: Story = {
  beforeEach: () => {
    mode = 'resendError';
  },

  args: codeArgs,

  play: async ({ canvasElement }) => {
    const button =
      canvasElement.querySelector<HTMLButtonElement>(
        '#btn-resend'
      );

    if (!button) {
      throw new Error(
        'Resend button missing'
      );
    }

    await userEvent.click(button);

    await waitFor(() => {
      if (
        !canvasElement.querySelector(
          '#banner-error'
        )
      ) {
        throw new Error(
          'Resend error missing'
        );
      }
    });
  },
};

// ===================================
// 23. Data Unavailable
// ===================================

export const DataUnavailable: Story = {
  beforeEach: reset,

  args: {
    ...codeArgs,

    dataUnavailableMessage:
      'تعذّر إنشاء حساب بهذه البيانات، صحّح البيانات أو سجّل الدخول.',
  },
};

// ===================================
// 24. Account Ready
// ===================================

export const AccountReadySignInRequired: Story = {
  beforeEach: reset,

  args: {
    ...codeArgs,

    accountReadyMessage:
      'تم إنشاء حسابك وتأكيد بريدك. سجّل الدخول ببريدك وكلمة مرورك.',
  },
};

// ===================================
// 25. Proof Code Delivery Hint
// ===================================

export const ProofCodeDeliveryHint: Story = {
  beforeEach: reset,

  args: {
    ...codeArgs,

    otpNotice:
      'تم إرسال رمز التحقق إلى بريدك الإلكتروني.',
  },
};
