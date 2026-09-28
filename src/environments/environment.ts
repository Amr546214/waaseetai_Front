import packageInfo from '../../package.json';

export const environment = {
	appVersion: '1.0.0',
	production: false,
	url_api: 'https://dev.waseetai.com/api',
	socketUrl: 'https://dev.waseetai.com',
	google_client_id: '45082682655-hprdmb9ghriv95b0dahukgh72paah08j.apps.googleusercontent.com',
	// Public PayPal Sandbox Client ID only (never the secret). Fill in with
	// the real Sandbox Client ID before testing the PayPal deposit flow —
	// intentionally left blank here, not committed.
	paypal_client_id: '',

};
