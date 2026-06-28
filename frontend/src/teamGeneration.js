function teamCountForPlayers(playerCount) {
  if (playerCount >= 10 && playerCount <= 14) return 2;
  if (playerCount >= 15 && playerCount <= 18) return 3;
  if (playerCount >= 19 && playerCount <= 22) return 4;
  throw new Error(`Se necesitan entre 10 y 22 jugadores. Hay ${playerCount}.`);
}

function targetSizes(playerCount, teamCount) {
  const base = Math.floor(playerCount / teamCount);
  const extra = playerCount % teamCount;

  return Array.from({ length: teamCount }, (_, index) =>
    base + (index < extra ? 1 : 0),
  );
}

function isGoalkeeper(player) {
  return (player.skills || []).includes("goalkeeper") || player.preferred_position === "Goalkeeper";
}

function getPlayerSkills(player) {
  return player.skills || [];
}

function hasSkill(player, skill) {
  return getPlayerSkills(player).includes(skill);
}

function countSkillInTeam(team, skill) {
  return team.players.filter((p) => hasSkill(p, skill)).length;
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

function skillsBalanceScore(teams) {
  let totalImbalance = 0;
  const allSkills = ["goalkeeper", "wizard", "cannon", "shield", "strong_leg", "captain", "veteran", "speedy", "tactician", "wings"];
  for (const skill of allSkills) {
    const counts = teams.map((t) => countSkillInTeam(t, skill));
    if (counts.some((c) => c > 0)) {
      totalImbalance += Math.max(...counts) - Math.min(...counts);
    }
  }
  return totalImbalance;
}

function combinedScore(teams) {
  return fairnessScore(teams) + skillsBalanceScore(teams) * 0.5;
}

function cloneTeams(teams) {
  return teams.map((team) => ({
    ...team,
    players: [...team.players],
  }));
}

function getPlayerPriority(player) {
  const skills = getPlayerSkills(player);
  let priority = 0;
  if (skills.includes("goalkeeper")) priority += 100;
  if (skills.includes("wizard")) priority += 50;
  if (skills.includes("captain")) priority += 40;
  if (skills.includes("shield")) priority += 30;
  if (skills.includes("cannon")) priority += 30;
  if (skills.includes("strong_leg")) priority += 20;
  if (skills.includes("wings")) priority += 20;
  if (skills.includes("speedy")) priority += 20;
  if (skills.includes("tactician")) priority += 15;
  if (skills.includes("veteran")) priority += 10;
  return priority;
}

function sortPlayers(players) {
  return [...players].sort((first, second) => {
    const firstPriority = getPlayerPriority(first);
    const secondPriority = getPlayerPriority(second);
    if (firstPriority !== secondPriority) {
      return secondPriority - firstPriority;
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
  const playerSkills = getPlayerSkills(player);
  const sorted = [...openTeams].sort((first, second) => {
    for (const skill of playerSkills) {
      const firstCount = countSkillInTeam(first, skill);
      const secondCount = countSkillInTeam(second, skill);
      if (firstCount !== secondCount) {
        return firstCount - secondCount;
      }
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
  let bestScore = combinedScore(bestTeams);
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
            const candidateScore = combinedScore(candidate);
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
