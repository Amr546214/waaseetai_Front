// View-model shapes of the provider disputes pages. The data comes from the real
// GET /provider/disputes[/:id] API (see disputes.mapper.ts); nothing here is mock data.

export interface DisputeTimelineStep {
	label: string;
	done?: boolean;
	active?: boolean;
	icon?: string;
}

export interface DisputeHistoryEntry {
	title: string;
	sub: string;
	time: string;
	iconType: 'open' | 'doc' | 'chat' | 'pending';
}

export interface DisputeEvidenceItem {
	name: string;
	meta: string;
	source: 'company' | 'client';
	iconType: 'doc';
}

export interface DisputeParty {
	name: string;
	role: string;
	initials: string;
	gradient: string;
}

export interface DisputeStatusStep {
	label: string;
	state: 'done' | 'active' | 'pending';
}

// Company-mode only: which team member on the provider company's side this
// dispute/project involves. Mock/placeholder — there is no backend field
// linking a dispute to a specific company team member yet (dispute.service.ts
// has no team-member assignment concept at all). Deterministic per dispute id
// (not random) so the list and detail pages always agree.
export interface DisputeTeamMember {
	name: string;
	role: string;
	initials: string;
	gradient: string;
}

// Final AI cleanup batch: confidencePct/verdictFor/verdictAgainst/meters
// (a fabricated AI-adjudication apparatus — a fake "AI confidence" score,
// AI-authored arguments for each side, and AI-assigned fault percentages)
// removed entirely — no real dispute-resolution AI exists anywhere in the
// backend (dispute.service.ts is a plain manual create -> admin-review ->
// admin-resolve workflow, zero AI/Gemini involvement). `recommendation` is
// kept as an honest admin-attributed proposed resolution, not an AI verdict.
export interface DisputeDetail {
	recommendation?: string;
	history: DisputeHistoryEntry[];
	evidence: DisputeEvidenceItem[];
	parties: DisputeParty[];
	statusSteps: DisputeStatusStep[];
	info: { label: string; value: string; valueClass?: 'teal' | 'amber' }[];
}

export interface Dispute {
	id: string;
	title: string;
	project: string;
	status: string;
	who: string;
	extra: string;
	icon: string;
	iconClass: string;
	badgeText: string;
	badgeClass: string;
	activeBorder: boolean;
	timeline: DisputeTimelineStep[];
	aiText: string;
	aiDone: boolean;
	amount: string;
	showEscalate: boolean;
	messages: number;
	date: string;
	detail?: DisputeDetail;
	/** Company-mode only — see DisputeTeamMember. Mock/placeholder field. */
	teamMember?: DisputeTeamMember;
}
