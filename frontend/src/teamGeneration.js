function teamCountForPlayers(playerCount) {
  if (playerCount >= 10 && playerCount <= 14) return 2;
  if (playerCount >= 15 && playerCount <= 18) return 3;
  throw new Error("Se necesitan entre 10 y 18 jugadores activos confirmados.");
}

function targetSizes(playerCount, teamCount) {
  const base = Math.floor(playerCount / teamCount);
  const extra = playerCount % teamCount;

  return Array.from({ length: teamCount }, (_, index) =>
    base + (index < extra ? 1 : 0),
  );
}

function isGoalkeeper(player) {
  return player.preferred_position === "Goalkeeper";
}

function playerEffectiveRating(player) {
  const position = player.preferred_position;
  switch (position) {
    case "Forward":
      return player.attack_rating || player.rating || 2;
    case "Defender":
      return player.defense_rating || player.rating || 2;
    case "Midfielder":
      return player.midfield_rating || player.rating || 2;
    case "Goalkeeper":
      return player.goalkeeper_rating || player.rating || 2;
    case "Flexible":
    default: {
      const ratings = [
        player.attack_rating,
        player.defense_rating,
        player.midfield_rating,
        player.goalkeeper_rating,
      ].filter(Boolean);
      return ratings.length
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : player.rating || 2;
    }
  }
}

function totalRating(team) {
  return team.players.reduce(
    (total, player) => total + playerEffectiveRating(player),
    0,
  );
}

function goalkeeperCount(team) {
  return team.players.filter(isGoalkeeper).length;
}

function fairnessScore(teams) {
  const totals = teams.map(totalRating);

  return Math.max(...totals) - Math.min(...totals);
}

function cloneTeams(teams) {
  return teams.map((team) => ({
    ...team,
    players: [...team.players],
  }));
}

function sortPlayers(players) {
  return [...players].sort((first, second) => {
    if (isGoalkeeper(first) !== isGoalkeeper(second)) {
      return isGoalkeeper(first) ? -1 : 1;
    }

    const firstRating = playerEffectiveRating(first);
    const secondRating = playerEffectiveRating(second);

    if (secondRating !== firstRating) {
      return secondRating - firstRating;
    }

    return (first.nickname || first.full_name || "").localeCompare(
      second.nickname || second.full_name || "",
    );
  });
}

function bestTeamForPlayer(teams, player) {
  const openTeams = teams.filter((team) => team.players.length < team.target_size);
  const sorted = [...openTeams].sort((first, second) => {
    if (isGoalkeeper(player)) {
      const goalkeeperDelta = goalkeeperCount(first) - goalkeeperCount(second);

      if (goalkeeperDelta !== 0) return goalkeeperDelta;
    }

    const totalDelta = totalRating(first) - totalRating(second);

    if (totalDelta !== 0) return totalDelta;

    return first.players.length - second.players.length;
  });

  return sorted[0];
}

function greedyAssign(players, teamCount) {
  const sizes = targetSizes(players.length, teamCount);
  const teams = sizes.map((targetSize, index) => ({
    name: `Equipo ${String.fromCharCode(65 + index)}`,
    team_order: index + 1,
    target_size: targetSize,
    players: [],
  }));

  sortPlayers(players).forEach((player) => {
    bestTeamForPlayer(teams, player).players.push(player);
  });

  return teams;
}

function improveWithSwaps(teams) {
  let bestTeams = cloneTeams(teams);
  let bestScore = fairnessScore(bestTeams);
  let improved = true;

  while (improved) {
    improved = false;

    for (let firstIndex = 0; firstIndex < bestTeams.length; firstIndex += 1) {
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < bestTeams.length;
        secondIndex += 1
      ) {
        const firstTeam = bestTeams[firstIndex];
        const secondTeam = bestTeams[secondIndex];

        for (
          let firstPlayerIndex = 0;
          firstPlayerIndex < firstTeam.players.length;
          firstPlayerIndex += 1
        ) {
          for (
            let secondPlayerIndex = 0;
            secondPlayerIndex < secondTeam.players.length;
            secondPlayerIndex += 1
          ) {
            const candidate = cloneTeams(bestTeams);
            const firstPlayer = candidate[firstIndex].players[firstPlayerIndex];
            const secondPlayer = candidate[secondIndex].players[secondPlayerIndex];

            candidate[firstIndex].players[firstPlayerIndex] = secondPlayer;
            candidate[secondIndex].players[secondPlayerIndex] = firstPlayer;

            const candidateScore = fairnessScore(candidate);

            if (candidateScore < bestScore) {
              bestTeams = candidate;
              bestScore = candidateScore;
              improved = true;
            }
          }
        }
      }
    }
  }

  return bestTeams;
}

export function generateBalancedTeams(players) {
  const clamp = (v) => Math.max(1, Math.min(4, Number(v) || 2));
  const normalizedPlayers = players.map((player) => ({
    ...player,
    rating: clamp(player.rating),
    attack_rating: clamp(player.attack_rating),
    defense_rating: clamp(player.defense_rating),
    midfield_rating: clamp(player.midfield_rating),
    goalkeeper_rating: clamp(player.goalkeeper_rating),
  }));
  const teamCount = teamCountForPlayers(normalizedPlayers.length);
  const teams = improveWithSwaps(greedyAssign(normalizedPlayers, teamCount));

  return {
    team_count: teamCount,
    confirmed_player_count: normalizedPlayers.length,
    fairness_score: fairnessScore(teams),
    teams: teams.map((team) => ({
      ...team,
      total_rating: Math.round(totalRating(team)),
      goalkeeper_count: goalkeeperCount(team),
    })),
  };
}
