import Avatar from "../components/Avatar.jsx";
import { displayName, formatMatchDate } from "../utils.js";

export default function TeamPage({ matches, profile, teamsByMatch, isAdmin }) {
  const assigned = matches
    .map((match) => {
      const team = (teamsByMatch[match.id] || []).find((item) =>
        (item.team_members || []).some(
          (member) => member.profile_id === profile.id,
        ),
      );
      return team ? { match, team } : null;
    })
    .filter(Boolean);

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <h2>Mis equipos</h2>
          <span className="count-pill">{assigned.length}</span>
        </div>
        {assigned.length === 0 ? (
          <div className="empty-state compact">
            Tu equipo aparecerá aquí cuando se generen los equipos.
          </div>
        ) : (
          <div className="team-grid">
            {assigned.map(({ match, team }) => (
              <article
                className="squad-card"
                key={`${match.id}-${team.id}`}
                style={{ borderTop: `4px solid ${team.color || "#22c55e"}` }}
              >
                <div className="squad-header">
                  <div className="squad-header-left">
                    <span 
                      className="squad-color-dot" 
                      style={{ 
                        background: team.color || "#22c55e",
                        boxShadow: `0 0 8px ${team.color || "#22c55e"}`
                      }} 
                    />
                    <strong className="squad-title">{team.name}</strong>
                  </div>
                  {isAdmin && (
                    <span className="squad-rating-badge">
                      {team.total_rating || 0} ★
                    </span>
                  )}
                </div>
                <small style={{ display: "block", color: "var(--text-muted)", fontSize: "0.78rem", marginTop: "-0.5rem", marginBottom: "0.5rem" }}>
                  {formatMatchDate(match)}
                </small>
                
                <div className="squad-list">
                  {(team.team_members || []).map((member) => {
                    const isGuest = !!member.guest_player_id;
                    const name = isGuest ? (member.guest_name || "Invitado") : displayName(member.profiles);
                    const position = isGuest ? "Flexible" : (member.profiles?.preferred_position || "Flexible");
                    
                    const positionLabels = {
                      Forward: "Delantero",
                      Defender: "Defensa",
                      Midfielder: "Medio",
                      Goalkeeper: "Portero",
                      Flexible: "Flexible"
                    };
                    
                    return (
                      <div className="squad-row" key={member.id}>
                        <div className="squad-player-info">
                          {isGuest ? (
                            <span className="squad-avatar guest">I</span>
                          ) : (
                            <Avatar profile={member.profiles} size="sm" />
                          )}
                          <div className="squad-player-meta">
                            <span className="squad-player-name">{name}</span>
                            <span className="squad-player-position">{positionLabels[position] || position}</span>
                          </div>
                        </div>
                        {isGuest && (
                          <span className="squad-guest-tag">Invitado</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
