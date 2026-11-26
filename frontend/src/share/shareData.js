/**
 * Pure, privacy-safe data & WhatsApp text builders for F5 Share & Invite V1.
 *
 * Security & privacy invariants enforced here:
 * - Invite URLs use only the existing authorized appShareUrl (no admin links, no session tokens, no Radar URLs).
 * - Group name is NEVER included in Convocatoria unless admin explicitly enables includeGroupName.
 * - Teams export NEVER includes individual ratings, team star sums, phone numbers, or emails.
 * - Mi FIFA export NEVER includes contact info (phone/email), pending/provisional stats, or cross-group data.
 * - Result export ONLY shows MVP when officially confirmed (never invents an MVP).
 */
import { appShareUrl, displayName, formatMatchDate } from "../utils.js";
import { positionShort } from "../matchday/matchDetailModel.js";
import { STYLE_KEYS, achievements, positionLabel } from "../players/playerStyle.js";

const CLEAN_TEXT = (value, fallback = "") => String(value ?? "").replace(/\s+/g, " ").trim() || fallback;

function formatDateAndTime(match) {
  if (!match?.match_date) {
    return { dateLabel: "Fecha por definir", timeLabel: "" };
  }
  const rawTime = String(match.start_time || "").slice(0, 5);
  const dateObj = new Date(`${match.match_date}T${rawTime || "12:00"}`);
  if (Number.isNaN(dateObj.getTime())) {
    return { dateLabel: formatMatchDate(match), timeLabel: rawTime };
  }
  const dateLabel = new Intl.DateTimeFormat("es-GT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(dateObj);
  const capDate = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  const timeLabel = rawTime
    ? new Intl.DateTimeFormat("es-GT", { hour: "numeric", minute: "2-digit" }).format(dateObj)
    : "";
  return { dateLabel: capDate, timeLabel };
}

/* ============================================================================
 * PRIORITY A — CONVOCATORIA
 * ============================================================================ */

export function buildInviteCardData({
  match,
  confirmedCount = 0,
  capacity = 10,
  waitlistCount = 0,
  venueName = "",
  groupName = "",
  includeVenue = true,
  includeGroupName = false,
}) {
  const safeCap = Math.max(1, Number(capacity || match?.max_players || 10));
  const safeConfirmed = Math.max(0, Number(confirmedCount || 0));
  const freeSpots = Math.max(0, safeCap - safeConfirmed);
  const safeWaitlist = Math.max(0, Number(waitlistCount || 0));
  const { dateLabel, timeLabel } = formatDateAndTime(match);
  const resolvedVenue = includeVenue ? CLEAN_TEXT(venueName || match?.venue || "") : "";
  const resolvedGroup = includeGroupName ? CLEAN_TEXT(groupName || "") : "";
  const inviteUrl = appShareUrl(match, match?.group_id);

  let spotsHeadline = "";
  let ctaText = "Sumate al partido";
  if (freeSpots > 0) {
    spotsHeadline = freeSpots === 1 ? "Queda 1 cupo disponible" : `Quedan ${freeSpots} cupos disponibles`;
    ctaText = "Confirmá tu lugar en F5 Manager";
  } else {
    spotsHeadline = safeWaitlist > 0 ? `Partido lleno · ${safeWaitlist} en espera` : "Partido lleno · Lista de espera abierta";
    ctaText = "Anotate en lista de espera";
  }

  return {
    kind: "invite",
    title: CLEAN_TEXT(match?.title, "Partido de Fútbol 5"),
    dateLabel,
    timeLabel,
    venue: resolvedVenue || null,
    groupName: resolvedGroup || null,
    confirmedCount: safeConfirmed,
    capacity: safeCap,
    freeSpots,
    waitlistCount: safeWaitlist,
    spotsHeadline,
    ctaText,
    inviteUrl,
  };
}

export function buildInviteShareText(data) {
  const lines = [
    "⚽ CONVOCATORIA · F5 MANAGER",
    "",
    data.groupName ? `${data.title} (${data.groupName})` : data.title,
    data.timeLabel ? `📅 ${data.dateLabel} · ${data.timeLabel}` : `📅 ${data.dateLabel}`,
  ];
  if (data.venue) lines.push(`📍 ${data.venue}`);
  lines.push(`👥 ${data.confirmedCount}/${data.capacity} confirmados — ${data.spotsHeadline}`);
  lines.push("");
  lines.push(`${data.ctaText}:`);
  lines.push(data.inviteUrl);
  return lines.join("\n");
}

/* ============================================================================
 * PRIORITY B — EQUIPOS EQUILIBRADOS
 * ============================================================================ */

export function buildTeamsCardData({
  match,
  teams = [],
  venueName = "",
  pins = null,
}) {
  const { dateLabel, timeLabel } = formatDateAndTime(match);
  const normalizedTeams = (teams || [])
    .map((team, ti) => {
      // Accepts both MatchDetailModel normalized teams (team.members) and raw DB teams (team.team_members)
      const rawMembers = Array.isArray(team?.members) ? team.members : (team?.team_members || []);
      const members = rawMembers.map((m, mi) => {
        const isGuest = Boolean(m?.isGuest ?? m?.guest_player_id);
        const name = CLEAN_TEXT(
          m?.name || (isGuest ? m?.guest_name || "Invitado" : displayName(m?.profiles)),
          isGuest ? "Invitado" : "Jugador",
        );
        const rawPos = m?.position || (isGuest ? null : m?.profiles?.preferred_position) || null;
        const posShort = m?.positionShort || (isGuest ? "INV" : rawPos ? positionShort(rawPos) : "");
        const id = m?.id || m?.profile_id || m?.guest_player_id || `m-${ti}-${mi}`;
        const pinned = Boolean(pins && id && pins[id] === ti);
        return {
          id,
          name,
          positionShort: posShort && posShort !== "FLX" ? posShort : (isGuest ? "INV" : ""),
          isGuest,
          pinned,
        };
      });
      return {
        name: CLEAN_TEXT(team?.name, `Equipo ${String.fromCharCode(65 + ti)}`),
        color: team?.color || ["#5be584", "#6cb4ff", "#f59e0b", "#f472b6"][ti % 4],
        members,
      };
    })
    .filter((t) => t.members.length > 0);

  return {
    kind: "teams",
    title: CLEAN_TEXT(match?.title, "Equipos del partido"),
    dateLabel,
    timeLabel,
    venue: CLEAN_TEXT(venueName || match?.venue || "") || null,
    teams: normalizedTeams,
    totalPlayers: normalizedTeams.reduce((n, t) => n + t.members.length, 0),
  };
}

export function buildTeamsShareText(data) {
  const lines = [
    "⚽ EQUIPOS · F5 MANAGER",
    "",
    data.title,
    data.timeLabel ? `📅 ${data.dateLabel} · ${data.timeLabel}` : `📅 ${data.dateLabel}`,
  ];
  if (data.venue) lines.push(`📍 ${data.venue}`);
  lines.push("");
  data.teams.forEach((team) => {
    lines.push(`${team.name} (${team.members.length}):`);
    team.members.forEach((m) => {
      const tag = m.positionShort ? `[${m.positionShort}] ` : "";
      lines.push(`- ${tag}${m.name}`);
    });
    lines.push("");
  });
  lines.push("f5manager.lat");
  return lines.join("\n").trim();
}

/* ============================================================================
 * PRIORITY C — MI FIFA (OWNER-CONTROLLED)
 * ============================================================================ */

export function buildFifaCardData({
  profile,
  style = null,
  record = null,
  earnedAchievements = null,
  includePhoto = true,
}) {
  const name = CLEAN_TEXT(displayName(profile), "Jugador");
  const primaryPosition = positionLabel(profile?.preferred_position || "Flexible");
  const secondaryPosition = style?.secondary_position ? positionLabel(style.secondary_position) : null;
  const posShort = positionShort(profile?.preferred_position || "Flexible");

  const hasStyle = Boolean(style && STYLE_KEYS.some(({ key }) => Number(style[key]) > 0));
  const styleBars = hasStyle
    ? STYLE_KEYS.map(({ key, label }) => ({
        key,
        label,
        value: Math.max(0, Math.min(10, Number(style[key]) || 0)),
      }))
    : [];

  // Only verified/confirmed record (never provisional/pending, never phone/email, never admin rating)
  const verified = {
    played: Math.max(0, Number(record?.played || 0)),
    goals: Math.max(0, Number(record?.goals || 0)),
    assists: Math.max(0, Number(record?.assists || 0)),
    mvps: Math.max(0, Number(record?.mvps || 0)),
    cleanSheets: Math.max(0, Number(record?.cleanSheets || 0)),
  };

  const awards = Array.isArray(earnedAchievements) ? earnedAchievements : achievements(verified);

  return {
    kind: "fifa",
    name,
    initials: name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "F5",
    avatarUrl: includePhoto && profile?.avatar_url ? String(profile.avatar_url) : null,
    positionLabel: primaryPosition,
    secondaryPosition,
    positionShort: posShort,
    hasStyle,
    styleBars,
    verified,
    awards: awards.slice(0, 4).map((a) => ({ id: a.id, label: CLEAN_TEXT(a.label) })),
  };
}

export function buildFifaShareText(data) {
  const lines = [
    `⚽ MI TARJETA F5 · ${data.name}`,
    `Posición: ${data.positionLabel}${data.secondaryPosition ? ` / ${data.secondaryPosition}` : ""}`,
    `Datos confirmados: ${data.verified.played} PJ · ${data.verified.goals} goles · ${data.verified.assists} asist.${data.verified.mvps > 0 ? ` · ${data.verified.mvps} MVP` : ""}`,
  ];
  if (data.awards.length > 0) {
    lines.push(`Logros: ${data.awards.map((a) => a.label).join(", ")}`);
  }
  lines.push("");
  lines.push("f5manager.lat");
  return lines.join("\n");
}

/* ============================================================================
 * PRIORITY D — RESULTADOS DE PARTIDO FINALIZADO
 * ============================================================================ */

function computeTeamScores(teams = [], confirmedStats = []) {
  if (!Array.isArray(teams) || teams.length < 2) return null;
  const goalsByPlayer = new Map();
  const goalsByGuest = new Map();
  confirmedStats.forEach((s) => {
    const g = Number(s?.goals || 0);
    if (s?.player_id) goalsByPlayer.set(s.player_id, (goalsByPlayer.get(s.player_id) || 0) + g);
    else if (s?.guest_player_id) goalsByGuest.set(s.guest_player_id, (goalsByGuest.get(s.guest_player_id) || 0) + g);
  });

  const scoredTeams = teams.map((t, idx) => {
    const members = Array.isArray(t?.members) ? t.members : (t?.team_members || []);
    const goals = members.reduce((sum, m) => {
      const isGuest = Boolean(m?.isGuest ?? m?.guest_player_id);
      const id = m?.id || (isGuest ? m?.guest_player_id : m?.profile_id);
      return sum + (isGuest ? (goalsByGuest.get(id) || 0) : (goalsByPlayer.get(id) || 0));
    }, 0);
    return {
      name: CLEAN_TEXT(t?.name, `Equipo ${String.fromCharCode(65 + idx)}`),
      color: t?.color || ["#5be584", "#6cb4ff", "#f59e0b", "#f472b6"][idx % 4],
      goals,
      playerCount: members.length,
    };
  });
  return scoredTeams;
}

export function buildResultCardData({
  match,
  teams = [],
  confirmedStats = [],
  confirmedCount = 0,
  officialMvpName = null,
}) {
  const { dateLabel, timeLabel } = formatDateAndTime(match);
  const stats = Array.isArray(confirmedStats) ? confirmedStats : [];

  const totalGoals = stats.reduce((n, s) => n + Number(s?.goals || 0), 0);
  const totalAssists = stats.reduce((n, s) => n + Number(s?.assists || 0), 0);

  // Official MVP ONLY — from explicit officialMvpName or confirmed match_stats row with mvp === true
  const statMvp = stats.find((s) => s?.mvp === true)?.name || null;
  const resolvedMvp = CLEAN_TEXT(officialMvpName || statMvp || "") || null;

  const scorers = [...stats]
    .filter((s) => Number(s?.goals || 0) > 0)
    .sort((a, b) => Number(b.goals) - Number(a.goals))
    .slice(0, 5)
    .map((s) => ({ name: CLEAN_TEXT(s.name, "Jugador"), value: Number(s.goals) }));

  const assisters = [...stats]
    .filter((s) => Number(s?.assists || 0) > 0)
    .sort((a, b) => Number(b.assists) - Number(a.assists))
    .slice(0, 4)
    .map((s) => ({ name: CLEAN_TEXT(s.name, "Jugador"), value: Number(s.assists) }));

  const teamScores = computeTeamScores(teams, stats);
  const hasExplicitScore =
    match?.home_score != null && match?.away_score != null && teamScores && teamScores.length >= 2;
  const finalTeams = hasExplicitScore
    ? teamScores.map((t, i) => (i === 0 ? { ...t, goals: Number(match.home_score) } : i === 1 ? { ...t, goals: Number(match.away_score) } : t))
    : teamScores;

  return {
    kind: "result",
    title: CLEAN_TEXT(match?.title, "Resultado del partido"),
    dateLabel,
    timeLabel,
    confirmedCount: Math.max(0, Number(confirmedCount || 0)),
    totalGoals,
    totalAssists,
    officialMvp: resolvedMvp,
    teams: finalTeams || [],
    scorers,
    assisters,
  };
}

export function buildResultShareText(data) {
  const lines = [
    "🏆 RESULTADO · F5 MANAGER",
    "",
    data.title,
    data.timeLabel ? `📅 ${data.dateLabel} · ${data.timeLabel}` : `📅 ${data.dateLabel}`,
  ];
  if (data.teams.length === 2) {
    lines.push(`⚽ ${data.teams[0].name} ${data.teams[0].goals} – ${data.teams[1].goals} ${data.teams[1].name}`);
  } else if (data.teams.length > 2) {
    lines.push(`⚽ ${data.teams.map((t) => `${t.name} ${t.goals}`).join(" · ")}`);
  } else {
    lines.push(`⚽ ${data.totalGoals} goles · ${data.confirmedCount} jugadores`);
  }
  if (data.officialMvp) {
    lines.push(`⭐ MVP oficial: ${data.officialMvp}`);
  }
  if (data.scorers.length > 0) {
    lines.push("");
    lines.push("Goleadores:");
    data.scorers.forEach((s) => lines.push(`- ${s.name}: ${s.value}`));
  }
  lines.push("");
  lines.push("f5manager.lat");
  return lines.join("\n");
}
