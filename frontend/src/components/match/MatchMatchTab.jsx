import React from "react";
import { Card } from "../ui/Card.jsx";
import { SectionHeader } from "../ui/SectionHeader.jsx";
import WeatherWidget from "../WeatherWidget.jsx";
import SelfStatsCard from "../SelfStatsCard.jsx";
import PostMatchSummaryCard from "../PostMatchSummaryCard.jsx";
import { MapPin, Info, Cloud } from "lucide-react";

/**
 * F5Manager MatchMatchTab Component ("Partido" tab content)
 */
export function MatchMatchTab({
  match,
  selectedVenue,
  profile,
  attendances = [],
  matchStats = [],
  confirmedCount,
  onSaveStats,
  currentMatchStats = [],
}) {
  const isClosed = match?.status === "closed" || new Date(`${match.match_date}T${match.start_time || "19:00"}`) < new Date();
  const didParticipate = (attendances || []).some(
    (a) => a.profile_id === profile?.id && ["confirmed", "checked_in"].includes(a.status)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Self Stats Card if match closed and user participated */}
      {isClosed && didParticipate && (
        <SelfStatsCard
          match={match}
          profile={profile}
          matchStats={matchStats}
          activeGroupId={match.group_id}
          onNotice={onSaveStats ? () => onSaveStats() : undefined}
        />
      )}

      {/* Post Match Summary Card if match closed */}
      {isClosed && (
        <Card variant="glass">
          <SectionHeader title="Resumen del Partido" subtitle="Estadísticas de goles y MVP registrado." />
          <PostMatchSummaryCard
            match={match}
            stats={currentMatchStats}
            confirmedCount={confirmedCount}
          />
        </Card>
      )}

      {/* Venue & Location Card */}
      <Card variant="default">
        <SectionHeader
          title="Información de la Cancha"
          subtitle={selectedVenue?.address || selectedVenue?.name || match.venue || "Guatemala"}
          icon={<MapPin size={18} className="f5-text-success" />}
        />
        <div style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
          {selectedVenue?.notes ? (
            <p style={{ margin: "0 0 0.5rem 0" }}>{selectedVenue.notes}</p>
          ) : null}
          {match.notes ? (
            <div style={{ background: "rgba(255,255,255,0.03)", padding: "0.75rem", borderRadius: "var(--r-sm)", marginTop: "0.5rem", borderLeft: "3px solid var(--primary)" }}>
              <strong style={{ color: "var(--text)", display: "block", marginBottom: "0.2rem" }}>Notas del Organizador:</strong>
              <span>{match.notes}</span>
            </div>
          ) : null}
        </div>
      </Card>

      {/* Weather Forecast Card */}
      {match.match_date && (
        <Card variant="default">
          <SectionHeader
            title="Pronóstico del Clima"
            subtitle="Condiciones esperadas para la hora de kickoff"
            icon={<Cloud size={18} className="f5-text-info" />}
          />
          <WeatherWidget
            venue={selectedVenue?.name || match.venue || "Guatemala"}
            date={match.match_date}
            time={match.start_time}
            lat={selectedVenue?.lat}
            lng={selectedVenue?.lng}
          />
        </Card>
      )}
    </div>
  );
}

export default MatchMatchTab;
