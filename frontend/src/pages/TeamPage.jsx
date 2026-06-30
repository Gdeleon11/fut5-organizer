import TeamCards from "../components/TeamCards.jsx";

export default function TeamPage({ matches, profile, teamsByMatch, isAdmin, ratingMap, skills, matchStats = [] }) {
  const assigned = (matches || [])
    .map((match) => {
      if (!match) return null;
      const team = ((teamsByMatch || {})[match.id] || []).find((item) =>
        item && (item.team_members || []).some(
          (member) => member && member.profile_id === profile?.id,
        ),
      );
      if (team) {
        // Attach the match context without mutating the cached team row.
        return { match, team: { ...team, match } };
      }
      return null;
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
          <TeamCards
            teams={assigned.map((a) => a.team)}
            isAdmin={isAdmin}
            ratingMap={ratingMap}
            skills={skills}
            matchStats={matchStats}
          />
        )}
      </section>
    </div>
  );
}
