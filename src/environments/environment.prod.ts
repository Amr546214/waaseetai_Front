import packageInfo from '../../package.json';

export const environment = {
  appVersion: packageInfo.version || '1.0.0',
  production: true,
  url_api: '/api',
  socketUrl: '/', // Relative URL so it automatically uses wss:// if hosted on https
  google_client_id: '1041761245251-0remq3eevcvkp8f6n4q81e7i8g7tpsr7.apps.googleusercontent.com',
  // Public PayPal Sandbox Client ID only (never the secret) — left blank,
  // not committed.
  paypal_client_id: 'ATuztFIB8nbg5phGxZxE17WVuCEam440fjixaWc9m1RqrwIJooqJPBf_lClVmYfueBR8fQjBX2sLoAUf',

};
