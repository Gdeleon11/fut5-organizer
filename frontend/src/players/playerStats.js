/**
 * Player statistics shared by Jugadores, Ranking and Mi FIFA.
 *
 * The formulas are moved verbatim from the former LeaderboardPage computation so every
 * screen shows the same, verified numbers (no new metrics, no changed weighting):
 *  - goals / assists / mvps / cleanSheets: sums over the player's match_player_stats rows
 *  - matchesPlayed: confirmed/checked-in attendances in matches that have any stats row
 *  - confirmed / canceled / noShows: attendance status counts
 *  - reliabilityScore = confirmed - canceled - 2 * noShows
 *  - voteAverage: average of received votes (1 decimal)
 */
const CONFIRMED = ["confirmed", "checked_in"];

export function computePlayerStats(profile, { matchStats = [], attendances = [], voteScoreMap = null } = {}) {
  const id = profile?.id;
  const playerStats = (matchStats || []).filter((s) => s && s.player_id === id);
  const goals = playerStats.reduce((sum, s) => sum + (s.goals || 0), 0);
  const assists = playerStats.reduce((sum, s) => sum + (s.assists || 0), 0);
  const mvps = playerStats.filter((s) => s.mvp).length;
  const cleanSheets = playerStats.filter((s) => s.clean_sheet).length;
  const playerAttendances = (attendances || []).filter((a) => a && a.profile_id === id);
  const confirmedAttendances = playerAttendances.filter((a) => CONFIRMED.includes(a.status)).length;
  const canceledAttendances = playerAttendances.filter((a) => a.status === "canceled").length;
  const noShows = playerAttendances.filter((a) => a.status === "no_show").length;
  const matchIdsWithStats = new Set((matchStats || []).map((s) => s.match_id));
  const matchesPlayed = playerAttendances.filter((a) => CONFIRMED.includes(a.status) && matchIdsWithStats.has(a.match_id)).length;
  const voteObj = voteScoreMap?.get?.(id) || null;
  const voteAverage = voteObj ? Number(voteObj.average.toFixed(1)) : 0;
  return {
    profile,
    goals,
    assists,
    mvps,
    cleanSheets,
    matchesPlayed,
    voteAverage,
    voteCount: voteObj?.count || 0,
    confirmedAttendances,
    canceledAttendances,
    noShows,
    reliabilityScore: confirmedAttendances - canceledAttendances - noShows * 2,
    statRows: playerStats.length,
  };
}

export const SORTERS = {
  goals: (a, b) => b.goals - a.goals || b.assists - a.assists || b.voteAverage - a.voteAverage,
  assists: (a, b) => b.assists - a.assists || b.goals - a.goals || b.voteAverage - a.voteAverage,
  mvps: (a, b) => b.mvps - a.mvps || b.goals - a.goals || b.voteAverage - a.voteAverage,
  cleanSheets: (a, b) => b.cleanSheets - a.cleanSheets || b.voteAverage - a.voteAverage,
  votes: (a, b) => b.voteAverage - a.voteAverage || b.goals - a.goals,
  matches: (a, b) => b.matchesPlayed - a.matchesPlayed || b.voteAverage - a.voteAverage,
};

/** True when the data supports showing per-match evolution (avoid inventing trends). */
export const MIN_HISTORY_FOR_EVOLUTION = 3;

/** Per-match timeline for one player, oldest → newest, only from recorded stat rows. */
export function playerTimeline(profileId, { matchStats = [], matches = [] } = {}) {
  const byId = new Map((matches || []).map((m) => [m.id, m]));
  return (matchStats || [])
    .filter((s) => s && s.player_id === profileId)
    .map((s) => {
      const m = byId.get(s.match_id);
      return { id: s.id || s.match_id, matchId: s.match_id, date: m?.match_date || null, title: m?.title || m?.venue || "Partido", goals: s.goals || 0, assists: s.assists || 0, mvp: Boolean(s.mvp), cleanSheet: Boolean(s.clean_sheet) };
    })
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
}

/**
 * Privacy: contact data (phone, full name) and fines are only for the player themself
 * or group admins. Other members see the sporting profile only.
 */
export function canSeePrivate({ viewerId, targetId, isAdmin }) {
  return Boolean(isAdmin || (viewerId && viewerId === targetId));
}
