import { useState } from "react";
import Avatar from "./Avatar.jsx";
import FifaCard from "./FifaCard.jsx";
import { displayName, formatMatchDate } from "../utils.js";

export default function TeamCards({ teams = [], isAdmin, ratingMap, skills, matchStats = [] }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  return (
    <>
      <div className="team-grid">
        {(teams || []).map((team, i) => (
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

            {team.match && (
              <small style={{ display: "block", color: "var(--text-muted)", fontSize: "0.78rem", marginTop: "-0.5rem" }}>
                {formatMatchDate(team.match)}
              </small>
            )}
            
            <div className="squad-list">
              {([...(team.team_members || [])].sort((a, b) => {
                const posA = a.guest_player_id ? "Flexible" : (a.profiles?.preferred_position || "Flexible");
                const posB = b.guest_player_id ? "Flexible" : (b.profiles?.preferred_position || "Flexible");
                if (posA === "Goalkeeper" && posB !== "Goalkeeper") return -1;
                if (posB === "Goalkeeper" && posA !== "Goalkeeper") return 1;
                return 0;
              })).map((member) => {
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
                
                // Clicking a player row sets the selectedPlayer to open the FIFA card modal
                const handlePlayerClick = () => {
                  if (isGuest) {
                    setSelectedPlayer({
                      isGuest: true,
                      full_name: member.guest_name || "Invitado",
                      guestRating: member.guest_rating || 3
                    });
                  } else if (member.profiles) {
                    setSelectedPlayer(member.profiles);
                  }
                };

                return (
                  <button
                    className="squad-row" 
                    key={member.id}
                    onClick={handlePlayerClick}
                    type="button"
                    title="Click para ver FIFA Card"
                  >
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
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      {/* Interactive FUT FIFA Card Modal */}
      {selectedPlayer && (
        <div className="fifa-modal-overlay" onClick={() => setSelectedPlayer(null)}>
          <div className="fifa-modal-content" onClick={(e) => e.stopPropagation()}>
            <FifaCard
              profile={selectedPlayer.isGuest ? null : selectedPlayer}
              ratingObj={selectedPlayer.isGuest ? null : ratingMap?.get(selectedPlayer.id)}
              playerSkills={selectedPlayer.isGuest ? [] : (skills || []).filter((s) => s.player_id === selectedPlayer.id)}
              isGuest={selectedPlayer.isGuest}
              guestRating={selectedPlayer.isGuest ? selectedPlayer.guestRating : 3}
              matchStats={matchStats}
              showStats={true}
            />
            <button 
              className="fifa-modal-close-btn" 
              type="button" 
              onClick={() => setSelectedPlayer(null)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
