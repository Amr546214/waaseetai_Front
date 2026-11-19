/**
 * The platform's real social accounts: ONE list used by every page that shows them (footer, contact). Share-link tracking parameters (utm_*, si=, stkn=, _r/_t, ?s=)
 * are left out on purpose: the link must open the account, not a one-time share session.
 */
export const SOCIAL_LINKS = {
	x: 'https://x.com/waseet_ai',
	instagram: 'https://www.instagram.com/waseetai',
	snapchat: 'https://snapchat.com/t/annbDbTu',
	linkedin: 'https://www.linkedin.com/in/waseet-ai-a856492a5',
	youtube: 'https://youtube.com/@waseetai',
	tiktok: 'https://www.tiktok.com/@waseetai',
} as const;
