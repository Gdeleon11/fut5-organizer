import { useState, useMemo } from "react";
import Avatar from "../components/Avatar.jsx";
import FifaCard from "../components/FifaCard.jsx";
import { displayName } from "../utils.js";

export default function LeaderboardPage({
  profiles = [],
  attendances = [],
  matchStats = [],
  ratingMap,
  skills,
}) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [sortBy, setSortBy] = useState("goals"); // goals, assists, mvps, cleanSheets, rating, matches

  // Compute accumulated stats for all active players
  const leaderboardData = useMemo(() => {
    const data = (profiles || [])
      .filter((p) => p && p.membership_is_active)
      .map((profile) => {
        const playerStats = (matchStats || []).filter(
          (s) => s && s.player_id === profile.id
        );

        const goals = playerStats.reduce((sum, s) => sum + (s.goals || 0), 0);
        const assists = playerStats.reduce((sum, s) => sum + (s.assists || 0), 0);
        const mvps = playerStats.filter((s) => s.mvp).length;
        const cleanSheets = playerStats.filter((s) => s.clean_sheet).length;

        // Matches played (confirmed or checked_in attendances in matches that have stats)
        const matchIdsWithStats = new Set((matchStats || []).map((s) => s.match_id));
        const matchesPlayed = (attendances || []).filter(
          (a) =>
            a &&
            a.profile_id === profile.id &&
            ["confirmed", "checked_in"].includes(a.status) &&
            matchIdsWithStats.has(a.match_id)
        ).length;

        // Overall FUT Rating
        const ratingObj = ratingMap?.get(profile.id) || null;
        const pos = profile.preferred_position || "Flexible";
        let overallRating = 60; // base fallback
        if (ratingObj) {
          const att = ratingObj.attack_rating || 3;
          const mid = ratingObj.midfield_rating || 3;
          const def = ratingObj.defense_rating || 3;
          const gk = ratingObj.goalkeeper_rating || 3;
          
          if (pos === "Goalkeeper") {
            overallRating = Math.round(gk * 25);
          } else if (pos === "Forward") {
            overallRating = Math.round(((att * 2 + mid) / 3) * 25);
          } else if (pos === "Defender") {
            overallRating = Math.round(((def * 2 + mid) / 3) * 25);
          } else if (pos === "Midfielder") {
            overallRating = Math.round(((mid * 2 + att + def) / 4) * 25);
          } else {
            overallRating = Math.round(((att + mid + def) / 3) * 25);
          }
        }

        return {
          profile,
          goals,
          assists,
          mvps,
          cleanSheets,
          matchesPlayed,
          overallRating,
        };
      });

    // Sort based on current selection
    return [...data].sort((a, b) => {
      if (sortBy === "goals") return b.goals - a.goals || b.assists - a.assists || b.overallRating - a.overallRating;
      if (sortBy === "assists") return b.assists - a.assists || b.goals - a.goals || b.overallRating - a.overallRating;
      if (sortBy === "mvps") return b.mvps - a.mvps || b.goals - a.goals || b.overallRating - a.overallRating;
      if (sortBy === "cleanSheets") return b.cleanSheets - a.cleanSheets || b.overallRating - a.overallRating;
      if (sortBy === "rating") return b.overallRating - a.overallRating || b.goals - a.goals;
      if (sortBy === "matches") return b.matchesPlayed - a.matchesPlayed || b.overallRating - a.overallRating;
      return 0;
    });
  }, [profiles, attendances, matchStats, ratingMap, sortBy]);

  // Extract top players for the podium highlights
  const topScorer = useMemo(() => {
    const sorted = [...leaderboardData].sort((a, b) => b.goals - a.goals);
    return sorted[0] && sorted[0].goals > 0 ? sorted[0] : null;
  }, [leaderboardData]);

  const topAssister = useMemo(() => {
    const sorted = [...leaderboardData].sort((a, b) => b.assists - a.assists);
    return sorted[0] && sorted[0].assists > 0 ? sorted[0] : null;
  }, [leaderboardData]);

  const topMvp = useMemo(() => {
    const sorted = [...leaderboardData].sort((a, b) => b.mvps - a.mvps);
    return sorted[0] && sorted[0].mvps > 0 ? sorted[0] : null;
  }, [leaderboardData]);

  const posTranslation = {
    Forward: "DEL",
    Midfielder: "MED",
    Defender: "DFC",
    Goalkeeper: "POR",
    Flexible: "FLX",
  };

  return (
    <div className="page-grid">
      {/* Podium Highlights */}
      {(topScorer || topAssister || topMvp) && (
        <section className="panel" style={{ background: "linear-gradient(180deg, var(--surface-2) 0%, var(--surface-1) 100%)" }}>
          <div className="section-heading" style={{ marginBottom: "1.5rem" }}>
            <h2>Destacados del Grupo</h2>
            <small>Líderes históricos de estadísticas</small>
          </div>
          <div className="podium-grid">
            {topScorer && (
              <article className="podium-card gold" onClick={() => setSelectedPlayer(topScorer.profile)}>
                <div className="podium-badge">⚽ Goleador</div>
                <Avatar profile={topScorer.profile} size="md" />
                <h3>{displayName(topScorer.profile)}</h3>
                <span className="podium-stat">{topScorer.goals} Goles</span>
              </article>
            )}

            {topMvp && (
              <article className="podium-card special" onClick={() => setSelectedPlayer(topMvp.profile)}>
                <div className="podium-badge">👑 Rey MVP</div>
                <Avatar profile={topMvp.profile} size="md" />
                <h3>{displayName(topMvp.profile)}</h3>
                <span className="podium-stat">{topMvp.mvps} MVPs</span>
              </article>
            )}

            {topAssister && (
              <article className="podium-card silver" onClick={() => setSelectedPlayer(topAssister.profile)}>
                <div className="podium-badge">👟 Asistidor</div>
                <Avatar profile={topAssister.profile} size="md" />
                <h3>{displayName(topAssister.profile)}</h3>
                <span className="podium-stat">{topAssister.assists} Asistencias</span>
              </article>
            )}
          </div>
        </section>
      )}

      {/* Main Leaderboard Table */}
      <section className="panel">
        <div className="section-heading">
          <h2>Estadísticas Generales</h2>
          <div className="sorting-controls">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="secondary-button"
              style={{ minHeight: "auto", padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
            >
              <option value="goals">⚽ Goles</option>
              <option value="assists">👟 Asistencias</option>
              <option value="mvps">👑 MVPs</option>
              <option value="cleanSheets">🧤 Vallas Invictas</option>
              <option value="rating">📈 FUT Rating</option>
              <option value="matches">📅 Partidos</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Jugador</th>
                <th>Pos</th>
                <th className={sortBy === "rating" ? "active-sort" : ""}>OVR</th>
                <th className={sortBy === "matches" ? "active-sort" : ""}>PJ</th>
                <th className={sortBy === "goals" ? "active-sort" : ""}>⚽ G</th>
                <th className={sortBy === "assists" ? "active-sort" : ""}>👟 A</th>
                <th className={sortBy === "mvps" ? "active-sort" : ""}>👑 MVP</th>
                <th className={sortBy === "cleanSheets" ? "active-sort" : ""}>🧤 VI</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardData.map((row, index) => (
                <tr
                  key={row.profile.id}
                  onClick={() => setSelectedPlayer(row.profile)}
                  className="leaderboard-row"
                >
                  <td><strong>{index + 1}</strong></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Avatar profile={row.profile} size="xs" />
                      <span>{displayName(row.profile)}</span>
                    </div>
                  </td>
                  <td><span className="pos-badge">{posTranslation[row.profile.preferred_position] || "FLX"}</span></td>
                  <td><strong>{row.overallRating}</strong></td>
                  <td>{row.matchesPlayed}</td>
                  <td>{row.goals}</td>
                  <td>{row.assists}</td>
                  <td>{row.mvps}</td>
                  <td>{row.cleanSheets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FIFA Card Modal */}
      {selectedPlayer && (
        <div className="modal-backdrop" onClick={() => setSelectedPlayer(null)}>
          <div className="modal-content fifa-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedPlayer(null)}>
              &times;
            </button>
            <FifaCard
              profile={selectedPlayer}
              ratingObj={ratingMap?.get(selectedPlayer.id)}
              playerSkills={skills?.filter((s) => s.player_id === selectedPlayer.id) || []}
              isGuest={false}
              matchStats={matchStats}
              showStats={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
