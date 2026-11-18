/** One stop of a guided tour. The text is written in advance (never generated while the tour runs); the audio is a pre-rendered file. */
export interface TourStep {
	/** stable id: also the name of the audio file (`/assets/tour/ar/<id>.mp3`) */
	id: string;
	/** route this step lives on; the tour navigates there first when the user is elsewhere */
	route?: string;
	/** CSS selector of the element Bebo points at; no selector (or not found) = a centred card, the tour never breaks */
	target?: string;
	title: string;
	/** what Bebo says (Modern Standard Arabic) */
	text: string;
	/** how long to wait for the target to appear after navigating (default 4000 ms) */
	waitMs?: number;
}

export interface TourDefinition {
	id: string;
	title: string;
	steps: TourStep[];
}

export type TourEndReason = 'completed' | 'skipped' | 'closed';
export const TOUR_AUDIO_BASE = '/assets/tour/ar';
export const tourAudioUrl = (stepId: string) => `${TOUR_AUDIO_BASE}/${stepId}.mp3`;
