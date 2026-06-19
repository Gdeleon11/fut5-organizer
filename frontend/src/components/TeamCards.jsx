import Avatar from "./Avatar.jsx";
import { displayName } from "../utils.js";

export default function TeamCards({ teams }) {
  return (
    <div className="team-grid">
      {teams.map((team) => (
        <article className="team-card" key={team.id}>
          <div className="team-header">
            <strong>{team.name}</strong>
            <span>{team.total_rating || 0} estrellas</span>
          </div>
          <ul>
            {(team.team_members || []).map((member) => (
              <li key={member.id}>
                <span className="team-member">
                  <Avatar profile={member.profiles} size="sm" />
                  {displayName(member.profiles)}
                </span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
