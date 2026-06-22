/**
 * Tournament fixture generation logic.
 *
 * Formats:
 *   - cuadrangular: 4 teams, round-robin (3 matchdays) + final
 *   - league: N teams, round-robin (each plays each once)
 *   - league_playoffs: N teams, round-robin + top 4 semifinals + final
 *   - playoffs_only: single elimination bracket (2, 4, or 8 teams)
 */

const DAY_MS = 86400000;

function nextDateAfter(startDate, dayOfWeek, afterDate) {
  const start = new Date(startDate + "T12:00:00");
  const after = new Date(afterDate + "T12:00:00");
  const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const targetDay = dayMap[dayOfWeek] ?? 1;
  const diff = ((targetDay - after.getDay()) % 7 + 7) % 7 || 7;
  const next = new Date(after.getTime() + diff * DAY_MS);
  if (next < start) {
    const fix = ((targetDay - start.getDay()) % 7 + 7) % 7 || 7;
    return new Date(start.getTime() + fix * DAY_MS);
  }
  return next;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function roundRobin(teams) {
  const n = teams.length;
  const list = [...teams];
  if (n % 2 !== 0) list.push(null);
  const rounds = [];
  const half = list.length / 2;

  for (let round = 0; round < list.length - 1; round += 1) {
    const matches = [];
    for (let i = 0; i < half; i += 1) {
      const home = list[i];
      const away = list[list.length - 1 - i];
      if (home !== null && away !== null) {
        matches.push({ home, away });
      }
    }
    rounds.push(matches);
    const rotated = [list[0], list[list.length - 1], ...list.slice(1, list.length - 1)];
    list.splice(0, list.length, ...rotated);
  }
  return rounds;
}

function singleElimination(teams) {
  const rounds = [];
  let current = [...teams];

  while (current.length > 1) {
    const matches = [];
    for (let i = 0; i < current.length; i += 2) {
      if (i + 1 < current.length) {
        matches.push({ home: current[i], away: current[i + 1] });
      } else {
        matches.push({ home: current[i], away: null });
      }
    }
    rounds.push(matches);
    current = matches.map((m) => m.home);
  }
  return rounds;
}

export function generateFixtures(format, teams, startDate, matchDay, matchTime, venue) {
  const fixtures = [];
  let currentDate = startDate;
  let round = 1;

  if (format === "cuadrangular") {
    const rrRounds = roundRobin(teams);
    rrRounds.forEach((matches) => {
      matches.forEach((m, i) => {
        fixtures.push({
          round,
          match_order: i + 1,
          home_team_id: m.home.id,
          away_team_id: m.away?.id || null,
          match_date: currentDate,
          match_time: matchTime,
          venue,
        });
      });
      currentDate = nextDateAfter(startDate, matchDay, currentDate);
      round += 1;
    });
    fixtures.push({
      round,
      match_order: 1,
      home_team_id: teams[0]?.id,
      away_team_id: teams[1]?.id,
      match_date: currentDate,
      match_time: matchTime,
      venue,
      is_final: true,
    });
  } else if (format === "league") {
    const rrRounds = roundRobin(teams);
    rrRounds.forEach((matches) => {
      matches.forEach((m, i) => {
        fixtures.push({
          round,
          match_order: i + 1,
          home_team_id: m.home.id,
          away_team_id: m.away?.id || null,
          match_date: currentDate,
          match_time: matchTime,
          venue,
        });
      });
      currentDate = nextDateAfter(startDate, matchDay, currentDate);
      round += 1;
    });
  } else if (format === "league_playoffs") {
    const rrRounds = roundRobin(teams);
    rrRounds.forEach((matches) => {
      matches.forEach((m, i) => {
        fixtures.push({
          round,
          match_order: i + 1,
          home_team_id: m.home.id,
          away_team_id: m.away?.id || null,
          match_date: currentDate,
          match_time: matchTime,
          venue,
        });
      });
      currentDate = nextDateAfter(startDate, matchDay, currentDate);
      round += 1;
    });
    const playoffStartRound = round;
    fixtures.push({
      round,
      match_order: 1,
      home_team_id: teams[0]?.id,
      away_team_id: teams[3]?.id,
      match_date: currentDate,
      match_time: matchTime,
      venue,
      is_playoff: true,
      playoff_label: "Semifinal 1",
    });
    fixtures.push({
      round,
      match_order: 2,
      home_team_id: teams[1]?.id,
      away_team_id: teams[2]?.id,
      match_date: currentDate,
      match_time: matchTime,
      venue,
      is_playoff: true,
      playoff_label: "Semifinal 2",
    });
    currentDate = nextDateAfter(startDate, matchDay, currentDate);
    round += 1;
    fixtures.push({
      round,
      match_order: 1,
      home_team_id: null,
      away_team_id: null,
      match_date: currentDate,
      match_time: matchTime,
      venue,
      is_playoff: true,
      playoff_label: "Final",
    });
  } else if (format === "playoffs_only") {
    const rounds = singleElimination(teams);
    rounds.forEach((matches) => {
      matches.forEach((m, i) => {
        fixtures.push({
          round,
          match_order: i + 1,
          home_team_id: m.home?.id || null,
          away_team_id: m.away?.id || null,
          match_date: currentDate,
          match_time: matchTime,
          venue,
          is_playoff: true,
        });
      });
      currentDate = nextDateAfter(startDate, matchDay, currentDate);
      round += 1;
    });
  }

  return fixtures;
}

export function updateStandings(standings, homeTeamId, awayTeamId, homeScore, awayScore) {
  const home = standings.find((s) => s.tournament_team_id === homeTeamId);
  const away = standings.find((s) => s.tournament_team_id === awayTeamId);
  if (!home || !away) return standings;

  home.played += 1;
  away.played += 1;
  home.goals_for += homeScore;
  home.goals_against += awayScore;
  away.goals_for += awayScore;
  away.goals_against += homeScore;

  if (homeScore > awayScore) {
    home.won += 1;
    home.points += 3;
    away.lost += 1;
  } else if (homeScore < awayScore) {
    away.won += 1;
    away.points += 3;
    home.lost += 1;
  } else {
    home.drawn += 1;
    home.points += 1;
    away.drawn += 1;
    away.points += 1;
  }

  return standings;
}
