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
            <strong>{team.name}</strong>
            {isAdmin && <span>{team.total_rating || 0} estrellas</span>}
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
                    {isGuest && <small className="guest-tag">invitado</small>}
                  </span>
                </li>
              );
            })}
          </ul>
        </article>
      ))}
    </div>
  );
}
