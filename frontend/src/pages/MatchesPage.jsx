import React, { useMemo, useState } from "react";
import MatchForm from "../components/MatchForm.jsx";
import RecurringConfig from "../components/matchday/RecurringConfig.jsx";
import { SectionHeader } from "../components/ui/SectionHeader.jsx";
import { useAppearance } from "../appearance/AppearanceProvider.jsx";
import { buildMatchdayModel } from "../matchday/matchdayModel.js";
import EditorialMatchesView from "../components/matchday/EditorialMatchesView.jsx";
import CommandMatchesView from "../components/matchday/CommandMatchesView.jsx";
import { FifaModal, useFifaModal } from "../components/matchdetail/DetailBlocks.jsx";
import { useMatchActions } from "../components/matchday/shared.jsx";

const HISTORY_PAGE = 6;

/**
 * Partidos — renders the experience chosen in Apariencia (Editorial or Command Center).
 * Both views receive the same view model built from the data App already loads and
 * call the same handlers (confirmMatch / cancelMatch / joinWaitlist / openMatch).
 */
export default function MatchesPage({
  attendances = [],
  isAdmin,
  matches = [],
  pastMatches = [],
  nextMatch,
  onCancel,
  onConfirm,
  onJoinWaitlist,
  onCreateMatch,
  onDeleteMatch,
  onOpenMatch,
  profile,
  fineAmount,
  venues = [],
  profiles = [],
  groupTags = [],
  onCreateGroupTag,
  onNotice,
  clearance,
  guests = {},
  onOpenPizarra,
  groupName = "",
  groupId = "",
  forceDesign,
  now,
  ratingMap,
  skills = [],
  matchStats = [],
  rosterProfiles = null, // group members + accepted Radar players ("Apodo · Radar") for the pitch
  onboarding = null, // first-steps cards (invite / pending activations / optional style)
}) {
  const fifa = useFifaModal();
  const { design: preferredDesign } = useAppearance();
  const design = forceDesign || preferredDesign;
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [visiblePastCount, setVisiblePastCount] = useState(HISTORY_PAGE);
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const actions = useMatchActions({ onConfirm, onCancel, onJoinWaitlist, onOpenMatch });

  const venueById = useMemo(() => new Map((venues || []).map((v) => [v.id, v])), [venues]);

  const model = useMemo(() => {
    const m = buildMatchdayModel({
      nextMatch,
      upcoming: matches,
      pastMatches,
      attendances,
      profiles: rosterProfiles || profiles,
      guests,
      profile,
      clearance,
      fineAmount,
      now: now || new Date(),
    });
    const withPlace = (entry) => {
      if (!entry) return entry;
      const venue = venueById.get(entry.match.venue_id);
      const place =
        entry.venue && entry.venue !== entry.title ? entry.venue : venue?.notes || venue?.address || "";
      return { ...entry, place };
    };
    return { ...m, featured: withPlace(m.featured) };
  }, [nextMatch, matches, pastMatches, attendances, profiles, guests, profile, clearance, fineAmount, now, venueById, rosterProfiles]);

  const hasFilter = Boolean(historyFrom || historyTo);
  const filteredHistory = model.history.filter(({ match }) => {
    if (!match.match_date) return !hasFilter;
    if (historyFrom && match.match_date < historyFrom) return false;
    if (historyTo && match.match_date > historyTo) return false;
    return true;
  });

  function resetPaging(setter, value) {
    setter(value);
    setVisiblePastCount(HISTORY_PAGE);
  }

  const history = {
    entries: filteredHistory.slice(0, visiblePastCount),
    summary: `${filteredHistory.length} ${filteredHistory.length === 1 ? "jugado" : "jugados"}${hasFilter ? " en el rango" : ""}`,
    emptyText: hasFilter
      ? "No se encontraron partidos jugados en el rango de fechas seleccionado."
      : "No hay partidos pasados registrados en el historial.",
    filter: {
      from: historyFrom,
      to: historyTo,
      onFrom: (v) => resetPaging(setHistoryFrom, v),
      onTo: (v) => resetPaging(setHistoryTo, v),
      onClear: () => {
        setHistoryFrom("");
        setHistoryTo("");
        setVisiblePastCount(HISTORY_PAGE);
      },
    },
    canShowMore: filteredHistory.length > visiblePastCount,
    canShowLess: visiblePastCount > HISTORY_PAGE && filteredHistory.length > HISTORY_PAGE && filteredHistory.length <= visiblePastCount,
    remaining: Math.max(0, filteredHistory.length - visiblePastCount),
    showMore: () => setVisiblePastCount((c) => c + 9),
    showLess: () => setVisiblePastCount(HISTORY_PAGE),
  };

  const deletion = {
    isAdmin,
    deletingId,
    start: (id) => setDeletingId(id),
    cancel: () => setDeletingId(null),
    confirm: async (id) => {
      await onDeleteMatch(id);
      setDeletingId(null);
    },
  };

  const admin = {
    isAdmin,
    showCreate,
    onToggleCreate: () => setShowCreate((v) => !v),
    onOpenPizarra,
  };

  async function handleCreate(payload, photoFile) {
    const created = await onCreateMatch(payload, photoFile);
    if (created) setShowCreate(false);
  }

  const createForm =
    showCreate && isAdmin ? (
      <section className="md-create" aria-label="Crear nuevo partido">
        <SectionHeader
          title="Crear nuevo partido"
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
      </section>
    ) : null;

  const shared = {
    model,
    groupName,
    admin,
    createForm,
    history,
    deletion,
    actions,
    onOpenMatch,
    onboarding,
  };

  return (
    <div className={`md-matches md-design-${design}`} data-design={design}>
      {design === "command" ? (
        <CommandMatchesView
          {...shared}
          onOpenPlayer={fifa.open}
          upcomingCount={(matches || []).length}
          playedCount={model.history.filter((h) => h.state.key === "finished").length + (model.featured?.state.key === "finished" ? 1 : 0)}
        />
      ) : (
        <EditorialMatchesView {...shared} />
      )}
      {isAdmin && groupId && (
        <RecurringConfig groupId={groupId} isAdmin={isAdmin} onNotice={onNotice} />
      )}
      <FifaModal player={fifa.player} onClose={fifa.close} ratingMap={ratingMap} skills={skills} matchStats={matchStats} />
    </div>
  );
}

