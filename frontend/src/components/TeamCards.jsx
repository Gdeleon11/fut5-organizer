import Avatar from "./Avatar.jsx";
import { displayName } from "../utils.js";

export default function TeamCards({ teams, isAdmin, onColorChange }) {
  return (
    <div className="team-grid">
      {teams.map((team, i) => (
        <article
          className="team-card"
          key={team.id || i}
          style={{ borderTop: `4px solid ${team.color || "#22c55e"}` }}
        >
          <div className="team-header">
            <div className="team-header-left">
              <span className="team-name-dot" style={{ background: team.color || "#22c55e" }} />
              <strong>{team.name}</strong>
            </div>
            {isAdmin && <span className="team-rating-pill">{team.total_rating || 0} ★</span>}
          </div>
          <ul>
            {(team.team_members || []).map((member) => {
              const isGuest = !!member.guest_player_id;
              const name = isGuest ? (member.guest_name || "Invitado") : displayName(member.profiles);
              return (
                <li key={member.id}>
                  <span className="team-member">
                    {isGuest ? (
                      <span className="avatar avatar-sm guest-avatar">I</span>
                    ) : (
                      <Avatar profile={member.profiles} size="sm" />
                    )}
                    {name}
                  </span>
                  {isGuest && <small className="guest-tag">invitado</small>}
                </li>
              );
            })}
          </ul>
        </article>
      ))}
    </div>
  );
}
