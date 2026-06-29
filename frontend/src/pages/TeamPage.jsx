import TeamCards from "../components/TeamCards.jsx";

export default function TeamPage({ matches, profile, teamsByMatch, isAdmin, ratingMap, skills, matchStats = [] }) {
  const assigned = matches
    .map((match) => {
      const team = (teamsByMatch[match.id] || []).find((item) =>
        (item.team_members || []).some(
          (member) => member.profile_id === profile.id,
        ),
      );
      if (team) {
        // Attach the match context to the team so the TeamCards component can display the match date
        team.match = match;
      }
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
