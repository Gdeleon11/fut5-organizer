import Avatar from "../components/Avatar.jsx";
import SectionBanner from "../components/SectionBanner.jsx";
import { displayName, formatMatchDate } from "../utils.js";

export default function TeamPage({ matches, profile, teamsByMatch }) {
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
      <SectionBanner section="equipo" />
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
              <article className="team-card" key={`${match.id}-${team.id}`}>
                <div className="team-header">
                  <strong>{team.name}</strong>
                  <span>{team.total_rating || 0} estrellas</span>
                </div>
                <small>{formatMatchDate(match)}</small>
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
        )}
      </section>
    </div>
  );
}
