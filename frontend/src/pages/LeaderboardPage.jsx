import { useMemo } from "react";
import { useAppearance } from "../appearance/AppearanceProvider.jsx";
import { computePlayerStats } from "../players/playerStats.js";
import { PlayerRanking } from "../components/players/PlayersViews.jsx";

/** Standalone ranking route: same view and same formulas as Jugadores › Ranking. */
export default function LeaderboardPage({ profiles = [], attendances = [], matchStats = [], voteScoreMap, ratingMap }) {
  const { design } = useAppearance();
  const variant = design === "command" ? "command" : "editorial";
  const rows = useMemo(
    () => (profiles || []).filter(Boolean).map((p) => computePlayerStats(p, { matchStats, attendances, voteScoreMap })),
    [profiles, matchStats, attendances, voteScoreMap],
  );
  return (
    <div className={`md-matches md-design-${variant} pl-page`} data-design={variant}>
      <div className={variant === "command" ? "mdc pl-shell" : "mde pl-shell"}>
        <PlayerRanking rows={rows} variant={variant} ratingMap={ratingMap || new Map()} onOpen={() => {}} />
      </div>
    </div>
  );
}
