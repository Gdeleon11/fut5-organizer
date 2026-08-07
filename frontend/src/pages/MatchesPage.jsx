import React, { useState } from "react";
import MatchForm from "../components/MatchForm.jsx";
import { isConfirmedAttendance } from "../utils.js";

// UI V2 Design System & Subcomponents
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { SectionHeader } from "../components/ui/SectionHeader.jsx";
import { MatchesHeader } from "../components/matches/MatchesHeader.jsx";
import { NextMatchHeroCard } from "../components/matches/NextMatchHeroCard.jsx";
import { UpcomingMatchCard } from "../components/matches/UpcomingMatchCard.jsx";
import { MatchesHistoryFilter } from "../components/matches/MatchesHistoryFilter.jsx";
import { MatchHistoryCard } from "../components/matches/MatchHistoryCard.jsx";
import { Calendar, History } from "lucide-react";

export default function MatchesPage({
  attendances,
  isAdmin,
  matchAttendances,
  matches,
  pastMatches = [],
  myAttendance,
  nextMatch,
  onCancel,
  onConfirm,
  onJoinWaitlist,
  onCreateMatch,
  onDeleteMatch,
  onOpenMatch,
  profile,
  fineAmount,
  venues,
  profiles = [],
  groupTags = [],
  onCreateGroupTag,
  onNotice,
  clearance,
  guests = {},
  onOpenPizarra,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [visiblePastCount, setVisiblePastCount] = useState(6);
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");

  function matchConfirmedCount(matchId) {
    const regularConfirmed = (matchAttendances(matchId) || []).filter(isConfirmedAttendance).length;
    const guestList = (guests || {})[matchId] || [];
    return regularConfirmed + guestList.length;
  }

  async function handleCreate(payload, photoFile) {
    const created = await onCreateMatch(payload, photoFile);
    if (created) setShowCreate(false);
  }

  async function handleDelete(matchId) {
    await onDeleteMatch(matchId);
    setDeletingId(null);
  }

  const upcomingExcludingNext = (matches || []).filter((m) => (nextMatch ? m.id !== nextMatch.id : true));
  const currentList = pastMatches || [];
  const filteredPast = currentList.filter((m) => {
    if (!m.match_date) return !historyFrom && !historyTo;
    if (historyFrom && m.match_date < historyFrom) return false;
    if (historyTo && m.match_date > historyTo) return false;
    return true;
  });

  function updateHistoryFilter(setter, value) {
    setter(value);
    setVisiblePastCount(6);
  }

  return (
    <div className="f5-match-container">
      {/* ── HEADER / TOOLBAR ── */}
      <MatchesHeader
        isAdmin={isAdmin}
        showCreate={showCreate}
        onToggleCreate={() => setShowCreate((v) => !v)}
        onOpenPizarra={onOpenPizarra}
      />

      {/* ── SINGLE MATCH FORM INSTANCE FOR ADMIN ── */}
      {showCreate && isAdmin && (
        <Card variant="hero" style={{ borderLeft: "4px solid var(--primary)" }}>
          <SectionHeader
            title="Crear Nuevo Partido"
            subtitle="Configura la fecha, hora, cancha y límite de jugadores para la convocatoria."
          />
          <MatchForm
            venues={venues}
            profiles={profiles}
            attendances={attendances}
            groupTags={groupTags}
            onCreateGroupTag={onCreateGroupTag}
            onCopied={onNotice}
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        </Card>
      )}

      {/* ── PRÓXIMO PARTIDO — HERO CARD ── */}
      <div>
        <SectionHeader
          title="Próximo Partido"
          subtitle="Convocatoria activa más cercana del grupo."
        />
        <NextMatchHeroCard
          match={nextMatch}
          confirmedCount={nextMatch ? matchConfirmedCount(nextMatch.id) : 0}
          onOpenMatch={onOpenMatch}
        />
      </div>

      {/* ── S IGU IENTES PARTIDOS PROGRAMADOS ── */}
      {upcomingExcludingNext.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <SectionHeader
            title="Siguientes Partidos Programados"
            subtitle={`${upcomingExcludingNext.length} ${upcomingExcludingNext.length === 1 ? "partido programado" : "partidos programados"} a futuro`}
            icon={<Calendar size={18} className="f5-text-primary" />}
          />
          <div className="f5-matches-grid">
            {upcomingExcludingNext.map((match) => (
              <UpcomingMatchCard
                key={match.id}
                match={match}
                confirmedCount={matchConfirmedCount(match.id)}
                onOpenMatch={onOpenMatch}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── HISTORIAL V2 ── */}
      <div style={{ marginTop: "1.5rem" }}>
        <SectionHeader
          title="Historial de Partidos"
          subtitle={`${filteredPast.length} partido${filteredPast.length === 1 ? "" : "s"} jugado${filteredPast.length === 1 ? "" : "s"}${(historyFrom || historyTo) ? " en el rango de fechas" : ""}`}
          icon={<History size={18} className="f5-text-muted" />}
        />

        {/* Date Filter Bar */}
        <MatchesHistoryFilter
          historyFrom={historyFrom}
          historyTo={historyTo}
          onChangeFrom={(val) => updateHistoryFilter(setHistoryFrom, val)}
          onChangeTo={(val) => updateHistoryFilter(setHistoryTo, val)}
          onClear={() => {
            setHistoryFrom("");
            setHistoryTo("");
            setVisiblePastCount(6);
          }}
        />

        {/* History Item Cards / Rows */}
        {filteredPast.length === 0 ? (
          <Card variant="default">
            <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
              {(historyFrom || historyTo)
                ? "No se encontraron partidos jugados en el rango de fechas seleccionado."
                : "No hay partidos pasados registrados en el historial."}
            </div>
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {filteredPast.slice(0, visiblePastCount).map((match) => (
              <MatchHistoryCard
                key={match.id}
                match={match}
                confirmedCount={matchConfirmedCount(match.id)}
                isAdmin={isAdmin}
                isDeleting={deletingId === match.id}
                onStartDelete={(id) => setDeletingId(id)}
                onConfirmDelete={handleDelete}
                onCancelDelete={() => setDeletingId(null)}
                onOpenMatch={onOpenMatch}
              />
            ))}
          </div>
        )}

        {/* Load More / Load Less Buttons */}
        <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", marginTop: "1.25rem" }}>
          {filteredPast.length > visiblePastCount && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => setVisiblePastCount((c) => c + 9)}
            >
              Ver más ({filteredPast.length - visiblePastCount} restantes)
            </Button>
          )}

          {visiblePastCount > 6 && filteredPast.length <= visiblePastCount && filteredPast.length > 6 && (
            <Button
              variant="ghost"
              size="md"
              onClick={() => setVisiblePastCount(6)}
            >
              Ver menos
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
