/**
 * Match detail view model shared by both experiences (Editorial / Command Center).
 * Pure data shaping over the props MatchDetail already receives — no new rules:
 * attendance state/actions come from the same deriveMatchState used on Partidos.
 */
import { displayName, positionLabel, waitlistPosition } from "../utils.js";
import { dateParts, deriveMatchState, matchCapacity, matchTitle } from "./matchdayModel.js";

const CONFIRMED = ["confirmed", "checked_in"];
const POS_SHORT = { Goalkeeper: "POR", Defender: "DEF", Midfielder: "MED", Forward: "DEL", Flexible: "FLX" };
const TEAM_FALLBACK = ["#22c55e", "#3b82f6", "#ef4444", "#eab308", "#a855f7", "#f97316"];

const initialOf = (name) => (String(name || "?").trim()[0] || "?").toUpperCase();

export function positionShort(position) {
  return POS_SHORT[position] || "FLX";
}

export function buildMatchDetailModel({
  match,
  attendances = [],
  guests = [],
  profile = null,
  profileById,
  ratingMap,
  teams = [],
  matchStats = [],
  selectedVenue = null,
  clearance = null,
  fineAmount = null,
  now = new Date(),
}) {
  if (!match) return null;
  const meId = profile?.id || null;
  const lookup = (id) => profileById?.get?.(id) || null;
  const capacity = matchCapacity(match);

  const confirmed = (attendances || [])
    .filter((a) => a && CONFIRMED.includes(a.status))
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
    .map((a, i) => {
      const p = lookup(a.profile_id);
      const name = p ? displayName(p) : "Jugador";
      return {
        key: `p-${a.profile_id}`,
        id: a.profile_id,
        order: i + 1,
        name,
        initial: initialOf(name),
        position: p?.preferred_position || "Flexible",
        positionLabel: positionLabel(p?.preferred_position || "Flexible"),
        positionShort: positionShort(p?.preferred_position),
        rating: ratingMap?.get?.(a.profile_id) || null,
        checkedIn: a.status === "checked_in" || a.checked_in === true,
        isMe: a.profile_id === meId,
        isGuest: false,
        profile: p,
      };
    });
  const guestRows = (guests || []).map((g, i) => ({
    key: `g-${g.id}`,
    id: g.id,
    order: confirmed.length + i + 1,
    name: g.name || "Invitado",
    initial: initialOf(g.name || "I"),
    position: "Flexible",
    positionLabel: "Invitado",
    positionShort: "INV",
    rating: null,
    guestRating: g.rating || null,
    checkedIn: false,
    isMe: false,
    isGuest: true,
    profile: null,
  }));
  const roster = [...confirmed, ...guestRows];

  const waitlist = (attendances || [])
    .filter((a) => a && a.status === "waitlist")
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
    .map((a, i) => {
      const p = lookup(a.profile_id);
      const name = p ? displayName(p) : "Jugador";
      return { key: a.id || a.profile_id, id: a.profile_id, turn: i + 1, name, initial: initialOf(name), isMe: a.profile_id === meId, profile: p };
    });

  const myAttendance = (attendances || []).find((a) => a && a.profile_id === meId) || null;
  const confirmedCount = roster.length;
  const state = deriveMatchState({
    match,
    attendance: myAttendance,
    confirmedCount,
    waitlistPos: myAttendance?.status === "waitlist" ? waitlistPosition(match.id, meId, attendances) : null,
    profile,
    clearance,
    fineAmount,
    now,
  });

  const normTeams = (teams || []).map((t, i) => {
    const members = [...(t.team_members || [])]
      .map((m) => {
        const isGuest = Boolean(m.guest_player_id);
        const p = isGuest ? null : m.profiles || lookup(m.profile_id);
        const name = isGuest ? m.guest_name || "Invitado" : displayName(p);
        const position = isGuest ? "Flexible" : p?.preferred_position || "Flexible";
        return {
          key: m.id || `${m.profile_id || m.guest_player_id}`,
          id: isGuest ? m.guest_player_id : m.profile_id || p?.id,
          name,
          initial: initialOf(name),
          position,
          positionLabel: isGuest ? "Invitado" : positionLabel(position),
          positionShort: isGuest ? "INV" : positionShort(position),
          isGuest,
          guestRating: m.guest_rating || null,
          isMe: !isGuest && (m.profile_id || p?.id) === meId,
          profile: p,
        };
      })
      .sort((a, b) => (a.position === "Goalkeeper" ? -1 : 0) - (b.position === "Goalkeeper" ? -1 : 0));
    return {
      key: t.id || `team-${i}`,
      name: t.name || `Equipo ${String.fromCharCode(65 + i)}`,
      color: t.color || TEAM_FALLBACK[i % TEAM_FALLBACK.length],
      totalRating: t.total_rating || 0,
      members,
    };
  });

  const stats = (matchStats || []).filter((s) => s && s.match_id === match.id);
  const nameForStat = (s) => {
    if (s.player_id) return displayName(lookup(s.player_id));
    const g = (guests || []).find((x) => x.id === s.guest_player_id);
    return g ? g.name : "Invitado";
  };
  const statRows = stats.map((s) => ({ ...s, name: nameForStat(s) }));
  const totals = {
    goals: statRows.reduce((n, s) => n + Number(s.goals || 0), 0),
    assists: statRows.reduce((n, s) => n + Number(s.assists || 0), 0),
    mvp: statRows.find((s) => s.mvp)?.name || null,
    scorers: [...statRows].filter((s) => Number(s.goals) > 0).sort((a, b) => b.goals - a.goals).slice(0, 5),
  };

  const isClosed =
    match.status === "closed" ||
    match.status === "finished" ||
    (match.match_date && new Date(`${match.match_date}T${match.start_time || "19:00"}`) < now);

  return {
    match,
    title: matchTitle(match),
    parts: dateParts(match, now),
    capacity,
    confirmedCount,
    free: Math.max(0, capacity - confirmedCount),
    fillRatio: Math.min(1, confirmedCount / capacity),
    roster,
    waitlist,
    canceled: (attendances || []).filter((a) => a && a.status === "canceled"),
    myAttendance,
    state,
    teams: normTeams,
    totals,
    hasStats: statRows.length > 0,
    isClosed,
    venue: {
      name: selectedVenue?.name || match.venue || "",
      address: selectedVenue?.address || "",
      notes: selectedVenue?.notes || "",
      lat: selectedVenue?.lat,
      lng: selectedVenue?.lng,
    },
    notes: match.notes || "",
    // Entry shape expected by the Partidos heroes (EditorialHero / CommandArena)
    entry: {
      id: match.id,
      match,
      title: matchTitle(match),
      venue: match.venue || "",
      place: selectedVenue?.address || (match.venue && match.venue !== matchTitle(match) ? match.venue : selectedVenue?.notes || ""),
      parts: dateParts(match, now),
      capacity,
      confirmedCount,
      free: Math.max(0, capacity - confirmedCount),
      fillRatio: Math.min(1, confirmedCount / capacity),
      waitlistCount: (attendances || []).filter((a) => a && a.status === "waitlist").length,
      attendance: myAttendance,
      state,
      roster: roster.map((r) => ({
        id: r.key,
        name: r.name,
        initial: r.initial,
        isMe: r.isMe,
        isGuest: r.isGuest,
        // Conserva la referencia al perfil para que PlayerFace pueda renderizar la foto real
        // en el detalle (mismo dato que ya usa la vista principal de Partidos).
        profile: r.profile || null,
      })),
    },
  };
}
