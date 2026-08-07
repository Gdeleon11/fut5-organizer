import React from "react";
import { Card } from "../ui/Card.jsx";
import { SectionHeader } from "../ui/SectionHeader.jsx";
import TeamCards from "../TeamCards.jsx";
import ExportCard from "../ExportCard.jsx";
import TeamShareCard from "../TeamShareCard.jsx";
import { Shield } from "lucide-react";
import { teamAnnouncementText, teamNotificationText } from "../../utils.js";

/**
 * F5Manager MatchTeamsTab Component ("Equipos" tab content)
 */
export function MatchTeamsTab({
  match,
  teams = [],
  isAdmin,
  ratingMap,
  skills,
  matchStats,
}) {
  const hasTeams = (teams || []).length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <Card variant="default">
        <SectionHeader
          title="Equipos Generados"
          subtitle={hasTeams ? `${teams.length} equipos listos para la chamusca` : "Los equipos aún no han sido generados"}
          icon={<Shield size={18} className="f5-text-success" />}
        />

        {!hasTeams ? (
          <div className="empty-state compact" style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--text-muted)" }}>
            ⚽ Los equipos aparecerán cuando el organizador los genere.
          </div>
        ) : (
          <TeamCards
            teams={teams}
            isAdmin={isAdmin}
            ratingMap={ratingMap}
            skills={skills}
            matchStats={matchStats}
          />
        )}
      </Card>

      {/* Admin Share Team Exports */}
      {hasTeams && isAdmin && (
        <Card variant="default">
          <SectionHeader
            title="Compartir Equipos"
            subtitle="Copia el texto listo para enviar por WhatsApp o redes sociales."
          />
          <div className="export-cards-grid" style={{ display: "grid", gap: "1rem" }}>
            <ExportCard
              label="Equipos para WhatsApp"
              text={teamAnnouncementText(match, teams)}
            />
            <ExportCard
              label="Notificar equipos a jugadores"
              text={teamNotificationText(match, teams)}
            />
            <TeamShareCard match={match} teams={teams} />
          </div>
        </Card>
      )}
    </div>
  );
}

export default MatchTeamsTab;
