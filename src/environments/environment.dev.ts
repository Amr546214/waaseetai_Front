import packageInfo from '../../package.json';

export const environment = {
  appVersion: '1.0.0',
  production: false,
  url_api: 'https://dev.waseetai.com/api',
  socketUrl: 'https://dev.waseetai.com',
  assistantSocketUrl: undefined as string | undefined,
  google_client_id: '1041761245251-0remq3eevcvkp8f6n4q81e7i8g7tpsr7.apps.googleusercontent.com',
  // Public PayPal Sandbox Client ID only (never the secret) — left blank,
  // not committed.
  paypal_client_id: '',
};
