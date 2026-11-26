
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { applicationConfig } from '@storybook/angular-vite';

import { Component, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { NEVER, of, throwError } from 'rxjs';
import { userEvent, within } from 'storybook/test';

import { VerifyOtp } from './verify-otp';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { AuthStore } from '../../../core/store/auth.store';
import { OtpHandoffService } from '../../../core/services/otp-handoff.service';
import { WaitTimerService } from '../../../core/wait/wait-timer.service';

// ===================================
// Mock Router Page
// ===================================

@Component({
  selector: 'storybook-otp-empty-page',
  standalone: true,
  template: '',
})
class EmptyPage {}

// ===================================
// Mock Modes
// ===================================

type MockMode =
  | 'error'
  | 'loading'
  | 'rateLimit'
  | 'attemptsLocked'
  | 'resendError'
  | 'resendSuccess';

let mockMode: MockMode = 'error';
let mockLoginMode = false;

// ===================================
// Mock HttpClient
// ===================================

// منع طلبات HTTP الحقيقية
const mockHttpClient = {
  get: () => NEVER,
  post: () => NEVER,
  put: () => NEVER,
  patch: () => NEVER,
  delete: () => NEVER,
};

// ===================================
// Mock Auth Store
// ===================================

const mockAuthStore = {
  pendingUserId: signal('storybook-user'),
  isPendingVerification: () => true,
  token: signal(null),
  currentUser: signal(null),

  authenticate: () => {},
  setPendingVerification: () => {},
};

// ===================================
// Mock Authentication API
// ===================================

const mockAuthApi = {
  isLoginOtpPending: () => mockLoginMode,

  verifyOtp: () => {
    // Loading
    if (mockMode === 'loading') {
      return NEVER;
    }

    // Rate Limit 429
    if (mockMode === 'rateLimit') {
      return throwError(() => ({
        status: 429,
        error: {
          message:
            'طلبات كثيرة، يمكنك إعادة المحاولة بعد قليل',
        },
      }));
    }

    // Too Many Wrong Codes
    if (mockMode === 'attemptsLocked') {
      return throwError(() => ({
        status: 429,
        error: {
          code: 'OTP_ATTEMPTS_LOCKED',
          message:
            'تم تجاوز عدد المحاولات المسموح به، يرجى طلب رمز جديد',
        },
      }));
    }

    // Invalid OTP
    return throwError(() => ({
      status: 400,
      error: {
        message:
          'رمز التحقق غير صحيح، يرجى المحاولة مرة أخرى',
      },
    }));
  },

  resendOtp: () => {
    // Resend Success
    if (mockMode === 'resendSuccess') {
      return of({
        success: true,
        data: {
          emailSent: true,
        },
      });
    }

    // Resend Error
    if (mockMode === 'resendError') {
      return throwError(() => ({
        status: 503,
        error: {
          message:
            'تعذر إعادة إرسال رمز التحقق، يرجى المحاولة لاحقًا',
        },
      }));
    }

    // لا يوجد إرسال حقيقي
    return NEVER;
  },
};

// ===================================
// Mock OTP Handoff
// ===================================

const mockOtpHandoff = {
  consume: () => ({
    sent: true,
    to: 'demo@example.com',
    message:
      'تم إرسال رمز التحقق إلى بريدك الإلكتروني',
  }),
};

// ===================================
// Mock Wait Timer
// ===================================

function createMockWait() {
  const state = {
    active: () => false,
    remainingSeconds: () => 0,
    clock: () => '00:00',
    label: () => '',

    start: () => {},
    startFromResponse: () => {},
  };

  return () => state;
}

const mockWaitTimer = {
  trackKeyed: () => createMockWait(),
};

// ===================================
// Reset Mocks
// ===================================

function resetMocks() {
  mockMode = 'error';
  mockLoginMode = false;
}

// ===================================
// Storybook Configuration
// ===================================

const meta: Meta<VerifyOtp> = {
  title: 'Waseet AI/Auth/Verify OTP',
  component: VerifyOtp,

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
          provide: HttpClient,
          useValue: mockHttpClient,
        },

        {
          provide: AuthApiService,
          useValue: mockAuthApi,
        },

        {
          provide: AuthStore,
          useValue: mockAuthStore,
        },

        {
          provide: OtpHandoffService,
          useValue: mockOtpHandoff,
        },

        {
          provide: WaitTimerService,
          useValue: mockWaitTimer,
        },
      ],
    }),
  ],

  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<VerifyOtp>;

// ===================================
// 1. Default
// ===================================

export const Default: Story = {
  beforeEach: resetMocks,
};

// ===================================
// 2. Login OTP
// ===================================

export const LoginOtp: Story = {
  beforeEach: () => {
    resetMocks();
    mockLoginMode = true;
  },
};

// ===================================
// 3. Validation Error
// ===================================

export const ValidationError: Story = {
  beforeEach: resetMocks,

  play: async ({ canvasElement }) => {
    const button =
      canvasElement.querySelector<HTMLButtonElement>(
        '#btn-confirm'
      );

    if (!button) {
      throw new Error('Confirm button not found');
    }

    await userEvent.click(button);

    const alert = await within(
      canvasElement
    ).findByRole('alert');

    if (!alert.textContent?.includes('6 أرقام')) {
      throw new Error(
        'OTP validation message did not appear'
      );
    }
  },
};

// ===================================
// 4. Invalid Code
// ===================================

export const InvalidCode: Story = {
  beforeEach: resetMocks,

  play: async ({ canvasElement }) => {
    const inputs = Array.from(
      canvasElement.querySelectorAll<HTMLInputElement>(
        '.otp-box'
      )
    );

    if (inputs.length !== 6) {
      throw new Error('Expected 6 OTP inputs');
    }

    const digits = '123456';

    for (let i = 0; i < 6; i++) {
      await userEvent.type(inputs[i], digits[i]);
    }

    const alert = await within(
      canvasElement
    ).findByRole('alert');

    if (!alert.textContent?.includes('غير صحيح')) {
      throw new Error(
        'Invalid OTP message did not appear'
      );
    }
  },
};

// ===================================
// 5. Loading
// ===================================

export const Loading: Story = {
  beforeEach: () => {
    resetMocks();
    mockMode = 'loading';
  },

  play: async ({ canvasElement }) => {
    const inputs = Array.from(
      canvasElement.querySelectorAll<HTMLInputElement>(
        '.otp-box'
      )
    );

    if (inputs.length !== 6) {
      throw new Error('Expected 6 OTP inputs');
    }

    const digits = '123456';

    for (let i = 0; i < 6; i++) {
      await userEvent.type(inputs[i], digits[i]);
    }

    const button =
      canvasElement.querySelector<HTMLButtonElement>(
        '#btn-confirm'
      );

    if (!button?.disabled) {
      throw new Error(
        'Confirm button should be disabled while loading'
      );
    }
  },
};

// ===================================
// 6. Navigation Failed
// ===================================

export const NavigationFailed: Story = {
  beforeEach: resetMocks,

  args: {
    entryFailedUrl: '/client-overview',

    errorMsg:
      'تعذر فتح لوحتك. اضغط «إعادة فتح لوحتي» (لا حاجة إلى رمز جديد).',

    errorIsAboutCode: false,
  },
};

// ===================================
// 7. Code Expired
// ===================================

export const CodeExpired: Story = {
  beforeEach: resetMocks,

  args: {
    codeExpiryKnown: true,
  },

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByText(
      /انتهت صلاحية الرمز، اطلب رمزًا جديدًا/
    );
  },
};

// ===================================
// 8. Resend Error
// ===================================

export const ResendError: Story = {
  beforeEach: () => {
    resetMocks();
    mockMode = 'resendError';
  },

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const resend = canvas.getByRole('button', {
      name: /اعادة ارسال الرمز/,
    });

    await userEvent.click(resend);

    const alert = await canvas.findByRole('alert');

    if (!alert.textContent?.includes('تعذر')) {
      throw new Error(
        'Resend error did not appear'
      );
    }
  },
};

// ===================================
// 9. Rate Limit 429
// ===================================

export const RateLimit: Story = {
  beforeEach: () => {
    resetMocks();
    mockMode = 'rateLimit';
  },

  play: async ({ canvasElement }) => {
    const inputs = Array.from(
      canvasElement.querySelectorAll<HTMLInputElement>(
        '.otp-box'
      )
    );

    if (inputs.length !== 6) {
      throw new Error('Expected 6 OTP inputs');
    }

    const digits = '123456';

    for (let i = 0; i < 6; i++) {
      await userEvent.type(inputs[i], digits[i]);
    }

    const alert = await within(
      canvasElement
    ).findByTestId('rate-limit-msg');

    if (!alert.textContent?.includes('طلبات كثيرة')) {
      throw new Error(
        'Rate limit message did not appear'
      );
    }
  },
};

// ===================================
// 10. Attempts Locked
// ===================================

export const AttemptsLocked: Story = {
  beforeEach: () => {
    resetMocks();
    mockMode = 'attemptsLocked';
  },

  play: async ({ canvasElement }) => {
    const inputs = Array.from(
      canvasElement.querySelectorAll<HTMLInputElement>(
        '.otp-box'
      )
    );

    if (inputs.length !== 6) {
      throw new Error('Expected 6 OTP inputs');
    }

    const digits = '123456';

    for (let i = 0; i < 6; i++) {
      await userEvent.type(inputs[i], digits[i]);
    }

    const alert = await within(
      canvasElement
    ).findByRole('alert');

    if (!alert.textContent?.includes('رمز جديد')) {
      throw new Error(
        'Attempts locked message did not appear'
      );
    }
  },
};

// ===================================
// 11. Resend Success
// ===================================

export const ResendSuccess: Story = {
  beforeEach: () => {
    resetMocks();
    mockMode = 'resendSuccess';
  },

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const resend = canvas.getByRole('button', {
      name: /اعادة ارسال الرمز/,
    });

    await userEvent.click(resend);

    await canvas.findByText(
      /إذا كان الحساب بانتظار التفعيل فسيصل رمز التحقق/
    );
  },
};

// ===================================
// 12. Success Opening Dashboard
// ===================================

// معاينة بصرية لحالة النجاح.
// لا تستخدم API حقيقية ولا تختبر التنقل الفعلي.


export const SuccessOpeningDashboard: Story = {
  beforeEach: resetMocks,

  args: {
    isLoading: true,
    isEntering: true,
    successMsg: 'جارٍ فتح لوحتك...',
    errorMsg: '',
    errorIsAboutCode: false,
  },

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const messages = await canvas.findAllByText(
      'جارٍ فتح لوحتك...'
    );

    if (messages.length === 0) {
      throw new Error('Success message not found');
    }

    const button =
      canvasElement.querySelector<HTMLButtonElement>(
        '#btn-confirm'
      );

    if (!button?.disabled) {
      throw new Error(
        'Confirm button must be disabled while entering'
      );
    }
  },
};

// ===================================
// 13. Paste Arabic Digits
// ===================================

export const PasteArabicDigits: Story = {
  beforeEach: resetMocks,

  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const inputs = Array.from(
      canvasElement.querySelectorAll<HTMLInputElement>(
        '.otp-box'
      )
    );

    if (inputs.length !== 6) {
      throw new Error('Expected 6 OTP inputs');
    }

    await userEvent.click(inputs[0]);

    // لصق ستة أرقام عربية
    await userEvent.paste('١٢٣٤٥٦');

    // التحقق من تحويل الأرقام العربية
    const values = inputs
      .map((input) => input.value)
      .join('');

    if (values !== '123456') {
      throw new Error(
        `Arabic digit normalization failed: ${values}`
      );
    }

    // التحقق من الإرسال التلقائي
    // باستخدام Backend وهمي يرجع خطأ للكود

    const alert = await canvas.findByRole('alert');

    if (!alert.textContent?.includes('غير صحيح')) {
      throw new Error(
        'Automatic OTP submission did not produce the expected error'
      );
    }
  },
};
