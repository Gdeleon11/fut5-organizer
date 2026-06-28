import Avatar from "./Avatar.jsx";
import { displayName } from "../utils.js";

export default function TeamCards({ teams, isAdmin }) {
  return (
    <div className="team-grid">
      {teams.map((team, i) => (
        <article
          className="squad-card"
          key={team.id || i}
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
  );
}
