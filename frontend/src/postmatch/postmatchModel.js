/* Postmatch — presentation helpers over postmatch_summary() (the server enforces every rule). */

export const KINDS = [
  { id: "goal", label: "Goles", one: "gol", many: "goles" },
  { id: "assist", label: "Asistencias", one: "asistencia", many: "asistencias" },
  { id: "clean_sheet", label: "Valla invicta", one: "valla invicta", many: "valla invicta" },
];
export const kindLabel = (id, n = 2) => {
  const k = KINDS.find((x) => x.id === id);
  if (!k) return id;
  return id === "clean_sheet" ? k.one : n === 1 ? k.one : k.many;
};

export const STATUS = {
  provisional: { label: "Pendiente", tone: "pending" },
  confirmed: { label: "Confirmado", tone: "paid" },
  rejected: { label: "Rechazado", tone: "rejected" },
};

/** Events per participant, participants in lineup order, with my row first. */
export function rows(summary, meId) {
  const ids = summary?.participants || [];
  const byPlayer = new Map(ids.map((id) => [id, []]));
  for (const e of summary?.events || []) if (byPlayer.has(e.subject_id)) byPlayer.get(e.subject_id).push(e);
  const list = ids.map((id) => ({ id, events: byPlayer.get(id) || [] }));
  return list.sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : 0));
}

/** Provisional events the caller may decide: admins → anyone but themselves; the match validator → only
 * the designating admin's events. */
export function decidable(summary, meId, isAdmin = true) {
  const events = (summary?.events || []).filter((e) => e.status === "provisional" && e.subject_id !== meId);
  if (isAdmin) return events;
  if (summary?.i_am_validator && summary.validator) return events.filter((e) => e.subject_id === summary.validator.designated_by);
  return [];
}

/** Whether the caller may resolve a correction (admin, or the validator for the designating admin's events). */
export function canResolve(summary, correction, meId, isAdmin) {
  const ev = (summary?.events || []).find((e) => e.id === correction.event_id);
  if (isAdmin) return true;
  return Boolean(summary?.i_am_validator && ev && summary.validator && ev.subject_id === summary.validator.designated_by && ev.subject_id !== meId);
}

/** The sole admin who played has own data waiting and no validator yet. */
export function needsValidator(summary, meId) {
  if (!summary?.can_designate || summary.validator) return false;
  const own = (summary.events || []).some((e) => e.subject_id === meId && e.status === "provisional");
  const ownCorr = (summary.corrections || []).some((c) => c.status === "open" && (summary.events || []).find((e) => e.id === c.event_id)?.subject_id === meId);
  return own || ownCorr;
}

export function mvpView(summary) {
  const s = summary?.mvp || { participants: 0, voters: 0, quorum: 3, leaders: [] };
  const closed = summary?.closed || null;
  if (closed) {
    if (closed.mvp_profile_id) return { state: "official", profileId: closed.mvp_profile_id, votes: closed.mvp_votes, voters: closed.voters };
    return { state: "none", reason: closed.voters < Math.max(3, Math.ceil((closed.participants || 0) / 2)) ? "participation" : "tie", voters: closed.voters, participants: closed.participants };
  }
  const reached = s.voters >= s.quorum;
  return { state: "open", voters: s.voters, quorum: s.quorum, participants: s.participants, reached, tie: reached && (s.leaders || []).length > 1 };
}

const ACTIONS = {
  reported: "registró", updated: "cambió", confirmed: "confirmó", rejected: "rechazó",
  correction_requested: "pidió una corrección", correction_accepted: "aceptó una corrección",
  correction_dismissed: "descartó una corrección", mvp_closed: "cerró el postpartido",
  validator_designated: "designó como validador del partido a", validator_revoked: "revocó como validador a",
};

/** Human line for a history entry. */
export function historyLine(h, nameOf) {
  const who = nameOf(h.actor_id) || "Alguien";
  const d = h.detail || {};
  const validatorAction = h.action === "validator_designated" || h.action === "validator_revoked";
  const subject = d.subject_id ? (validatorAction ? ` ${nameOf(d.subject_id)}` : ` · ${nameOf(d.subject_id)}`) : "";
  const asValidator = d.as_validator ? " (como validador)" : "";
  const what = d.kind ? ` ${d.quantity ?? ""} ${kindLabel(d.kind, d.quantity)}`.replace(/\s+/g, " ") : "";
  const change = d.before && d.after ? ` (${d.before.quantity} → ${d.after.quantity})` : "";
  const msg = d.message ? `: “${d.message}”` : "";
  return `${who} ${ACTIONS[h.action] || h.action}${what}${subject}${change}${msg}${asValidator}`;
}
