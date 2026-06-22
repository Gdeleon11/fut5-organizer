import { useMemo, useState } from "react";
import Avatar from "../components/Avatar.jsx";
import { generateBalancedTeams } from "../teamGeneration.js";
import { displayName, formatMoney } from "../utils.js";

export default function SimPage({ profiles, ratingMap, isAdmin }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const activePlayers = useMemo(
    () =>
      profiles
        .filter((p) => p.membership_is_active)
        .map((p) => {
          const r = ratingMap.get(p.id) || {};
          return {
            ...p,
            rating: r.rating || 2,
            attack_rating: r.attack_rating || r.rating || 2,
            defense_rating: r.defense_rating || r.rating || 2,
            midfield_rating: r.midfield_rating || r.rating || 2,
            goalkeeper_rating: r.goalkeeper_rating || r.rating || 2,
          };
        }),
    [profiles, ratingMap],
  );

  function simulate() {
    setError("");
    try {
      const generated = generateBalancedTeams(activePlayers);
      setResult(generated);
    } catch (err) {
      setError(err.message);
      setResult(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="page-grid">
        <section className="panel">
          <div className="empty-state compact">
            Solo los admins pueden generar simulaciones.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Simulación</p>
            <h2>Generar equipos</h2>
            <small>Armá equipos con los {activePlayers.length} jugadores activos registrados.</small>
          </div>
          <button type="button" onClick={simulate}>
            Simular
          </button>
        </div>
        {error && <p className="form-message">{error}</p>}
        {activePlayers.length < 10 && (
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Se necesitan al menos 10 jugadores activos para generar equipos.
          </p>
        )}
      </section>

      {result && (
        <section className="panel">
          <div className="section-heading">
            <h2>Resultado</h2>
            <span className="count-pill">
              {result.team_count} equipos · {result.confirmed_player_count} jugadores · diferencial: {result.fairness_score}
            </span>
          </div>
          <div className="team-grid">
            {result.teams.map((team) => (
              <article className="team-card" key={team.name}>
                <div className="team-header">
                  <strong>{team.name}</strong>
                  <span>{team.total_rating} estrellas</span>
                </div>
                <small>{team.goalkeeper_count} portero(s)</small>
                <ul>
                  {team.players.map((player) => (
                    <li key={player.id}>
                      <span className="team-member">
                        <Avatar profile={player} size="sm" />
                        {displayName(player)}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
