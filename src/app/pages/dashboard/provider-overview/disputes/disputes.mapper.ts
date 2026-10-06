import { Dispute as ApiDispute } from '../../../../core/models/dispute.model';
import { Dispute, DisputeDetail, DisputeEvidenceItem, DisputeHistoryEntry, DisputeParty, DisputeStatusStep, DisputeTimelineStep } from './disputes.model';

const dateLabel = (iso?: string | null): string =>
	iso ? new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export function buildTimeline(status: ApiDispute['status']): DisputeTimelineStep[] {
	return [
		{ label: 'رُفع النزاع', done: true, icon: 'check' },
		{
			label: 'قيد مراجعة الإدارة',
			done: status === 'RESOLVED' || status === 'REJECTED',
			active: status === 'OPEN' || status === 'UNDER_REVIEW',
			icon: 'review',
		},
		{
			label: status === 'REJECTED' ? 'تم رفض النزاع' : 'القرار النهائي',
			done: status === 'RESOLVED' || status === 'REJECTED',
			icon: 'check',
		},
	];
}

const GRADIENT = 'linear-gradient(135deg,#2B7FFF,#1A5FCC)';
const initials = (name: string) => (name.trim().slice(0, 2) || '—');
const personName = (p?: { firstName?: string; lastName?: string } | null) => `${p?.firstName || ''} ${p?.lastName || ''}`.trim();

/** Real detail built only from the fields a Dispute row carries (reason, description, evidence, status, dates, parties, resolution). */
function buildDetail(d: ApiDispute, mine: boolean): DisputeDetail {
	const closed = d.status === 'RESOLVED' || d.status === 'REJECTED';
	const history: DisputeHistoryEntry[] = [
		{ title: 'رُفع النزاع', sub: d.reason, time: dateLabel(d.createdAt), iconType: 'open' },
	];
	if (closed) {
		history.push({
			title: d.status === 'REJECTED' ? 'تم رفض النزاع' : 'تم حل النزاع',
			sub: d.resolutionNote || d.resolution || '—',
			time: dateLabel(d.resolvedAt),
			iconType: 'doc',
		});
	} else {
		history.push({ title: 'بانتظار قرار الإدارة', sub: 'النزاع قيد المراجعة', time: '—', iconType: 'pending' });
	}

	const evidence: DisputeEvidenceItem[] = (d.evidence || []).map((url, i) => ({
		name: String(url).split('/').pop() || `ملف ${i + 1}`,
		meta: '—',
		source: mine ? 'company' : 'client',
		iconType: 'doc',
	}));

	// The provider is always one side of the dispute; the other side is the client.
	const me: DisputeParty = { name: personName(mine ? d.openedBy : d.againstUser) || 'أنت', role: 'مقدم الخدمة (أنت)', initials: 'أنت', gradient: GRADIENT };
	const otherName = personName(mine ? d.againstUser : d.openedBy);
	const other: DisputeParty = { name: otherName || '—', role: 'طالب الخدمة', initials: initials(otherName), gradient: 'linear-gradient(135deg,#0FA99A,#2BD4C7)' };

	const statusSteps: DisputeStatusStep[] = [
		{ label: 'رُفع النزاع', state: 'done' },
		{ label: 'قيد مراجعة الإدارة', state: closed ? 'done' : 'active' },
		{ label: d.status === 'REJECTED' ? 'تم رفض النزاع' : 'القرار النهائي', state: closed ? 'done' : 'pending' },
	];

	return {
		// `recommendation` is only the admin's real resolution text once a dispute is resolved.
		recommendation: closed ? (d.resolutionNote || d.resolution || undefined) : undefined,
		history,
		evidence,
		parties: [me, other],
		statusSteps,
		info: [
			{ label: 'السبب', value: d.reason },
			{ label: 'تاريخ الفتح', value: dateLabel(d.createdAt) },
			{ label: 'المشروع', value: d.request?.title || '—' },
			...(d.resolvedAt ? [{ label: 'تاريخ القرار', value: dateLabel(d.resolvedAt) }] : []),
			// heldEscrowAmount: null/absent -> 'غير متاح'; 0 is a real value and is shown as '0'.
			{ label: 'المتبقي من مستحقاتك في الضمان', value: d.heldEscrowAmount === null || d.heldEscrowAmount === undefined ? 'غير متاح' : String(d.heldEscrowAmount) },
			{ label: 'الرسائل', value: 'التفاصيل الكاملة غير متاحة' },
		],
	};
}

/** Maps a real backend Dispute row onto the shape the disputes list/detail templates expect. */
export function mapDispute(d: ApiDispute, currentUserId: string | undefined): Dispute {
	const closed = d.status === 'RESOLVED' || d.status === 'REJECTED';
	const mine = d.openedById === currentUserId;
	const who = mine ? 'mine' : 'against';
	const badgeText = d.status === 'UNDER_REVIEW' ? 'قيد مراجعة الإدارة'
		: d.status === 'RESOLVED' ? 'تم حل النزاع'
		: d.status === 'REJECTED' ? 'تم رفض النزاع'
		: 'مفتوح';

	return {
		id: d.id,
		title: d.reason,
		project: d.request?.title || '—',
		status: closed ? 'closed' : 'open',
		who,
		extra: d.status === 'UNDER_REVIEW' ? 'review' : '',
		icon: closed ? 'check' : 'shield',
		iconClass: closed ? 'bg-[#0FA99A]/15 text-[#0FA99A]' : 'bg-[#FFB400]/15 text-[#FFB400]',
		badgeText,
		badgeClass: closed ? 'bg-[#0FA99A]/15 text-[#0FA99A] border-[#0FA99A]/30' : 'bg-[#FFB400]/15 text-[#D98A0B] border-[#FFB400]/30',
		activeBorder: d.status === 'OPEN',
		timeline: buildTimeline(d.status),
		aiText: closed ? (d.resolutionNote || d.resolution || 'تم إغلاق النزاع') : d.description,
		aiDone: closed,
		// No escrow-amount field exists on a Dispute row — omit rather than fabricate.
		amount: '',
		// No escalate / messaging endpoint exists yet.
		showEscalate: false,
		messages: 0,
		date: dateLabel(d.createdAt),
		detail: buildDetail(d, mine),
		// No backend concept of a company team-member assignment on a dispute.
		teamMember: undefined,
	};
}
