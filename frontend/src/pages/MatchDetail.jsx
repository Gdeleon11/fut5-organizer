import React, { useEffect, useMemo, useState } from "react";
import { Link2 } from "lucide-react";
import { api } from "../api.js";
import { generateBalancedTeams, fairnessScore } from "../teamGeneration.js";
import { distributeTeamsWithAI } from "../groq.js";
import { copyToClipboard, displayName } from "../utils.js";

// UI V2 Design System & Subcomponents
import { MatchHero } from "../components/match/MatchHero.jsx";
import { MatchTabs } from "../components/match/MatchTabs.jsx";
import { MatchMatchTab } from "../components/match/MatchMatchTab.jsx";
import { MatchPlayersTab } from "../components/match/MatchPlayersTab.jsx";
import { MatchTeamsTab } from "../components/match/MatchTeamsTab.jsx";
import { MatchAdminPanel } from "../components/match/MatchAdminPanel.jsx";
import { MatchStatsEditor } from "../components/match/MatchStatsEditor.jsx";
import { Toast } from "../components/ui/Toast.jsx";

export default function MatchDetail({
  confirmedCount,
  fineAmount,
  isAdmin,
  match,
  myAttendance,
  onCheckIn,
  onConfirm,
  onCancel,
  onJoinWaitlist,
  onDeleteMatch,
  clearance,
  onGenerateTeams,
  onMarkNoShow,
  onAddGuest,
  onDeleteGuest,
  onUpdateGuestRating,
  onReconfirm,
  attendances = [],
  guests = [],
  profile,
  profiles = [],
  profileById,
  skills,
  ratingMap,
  teams,
  venues = [],
  matchStats = [],
  onSaveStats,
  onBack,
}) {
  const [activeTab, setActiveTab] = useState("partido");
  const [teamInstructions, setTeamInstructions] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [toastMessage, setToastMessage] = useState(null);

  const [statsForm, setStatsForm] = useState([]);
  const [savingStats, setSavingStats] = useState(false);
  const [isEditingStats, setIsEditingStats] = useState(false);

  // Selected venue matching logic
  const selectedVenue = useMemo(() => {
    return (venues || []).find((v) => v && v.id === match?.venue_id)
      || (venues || []).find((v) => v && v.name === match?.venue)
      || null;
  }, [venues, match?.venue_id, match?.venue]);

  // Confirmed players list
  const confirmedPlayers = useMemo(() => {
    const regularConfirmed = (attendances || [])
      .filter((a) => ["confirmed", "checked_in"].includes(a.status))
      .map((a) => {
        const p = profileById?.get(a.profile_id);
        return {
          id: a.profile_id,
          name: p ? displayName(p) : "Jugador",
          is_guest: false,
          profile: p,
        };
      });

    const guestPlayers = (guests || []).map((g) => ({
      id: g.id,
      name: g.name,
      is_guest: true,
    }));

    return [...regularConfirmed, ...guestPlayers];
  }, [attendances, guests, profileById]);

  // Initialize stats form state
  useEffect(() => {
    const initialStats = confirmedPlayers.map((player) => {
      const existing = (matchStats || []).find(
        (s) =>
          s &&
          match &&
          s.match_id === match.id &&
          (player.is_guest
            ? s.guest_player_id === player.id
            : s.player_id === player.id)
      );

      return {
        player_id: player.is_guest ? null : player.id,
        guest_player_id: player.is_guest ? player.id : null,
        name: player.name,
        is_guest: player.is_guest,
        goals: existing ? existing.goals : 0,
        assists: existing ? existing.assists : 0,
        mvp: existing ? existing.mvp : false,
        clean_sheet: existing ? existing.clean_sheet : false,
      };
    });
    setStatsForm(initialStats);
  }, [confirmedPlayers, matchStats, match?.id]);

  const updateStatField = (playerId, isGuest, field, value) => {
    setStatsForm((prev) =>
      prev.map((item) => {
        const isMatch = isGuest
          ? item.guest_player_id === playerId
          : item.player_id === playerId;
        if (!isMatch) return item;
        return { ...item, [field]: value };
      }).map((item) => {
        // Enforce only one MVP
        if (field === "mvp" && value === true) {
          const isThis = isGuest
            ? item.guest_player_id === playerId
            : item.player_id === playerId;
          if (!isThis) {
            return { ...item, mvp: false };
          }
        }
        return item;
      })
    );
  };

  const handleSaveStats = async () => {
    if (!onSaveStats || !match?.id) return;
    setSavingStats(true);
    try {
      await onSaveStats(match.id, statsForm);
      setToastMessage({ variant: "success", text: "Estadísticas guardadas con éxito ✓" });
      setIsEditingStats(false);
    } catch (err) {
      setToastMessage({ variant: "danger", text: "Error al guardar estadísticas." });
    } finally {
      setSavingStats(false);
    }
  };

  // Match stats sorted for current match
  const currentMatchStats = useMemo(() => {
    return (matchStats || [])
      .filter((s) => s && match && s.match_id === match.id)
      .map((s) => {
        let name = "Jugador";
        if (s.player_id) {
          const p = profileById?.get(s.player_id);
          name = p ? displayName(p) : "Jugador";
        } else if (s.guest_player_id) {
          const g = (guests || []).find((guest) => guest.id === s.guest_player_id);
          name = g ? g.name : "Invitado";
        }
        return {
          ...s,
          name,
        };
      })
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists || (b.mvp ? 1 : 0) - (a.mvp ? 1 : 0));
  }, [matchStats, match?.id, profileById, guests]);

  // AI Team Distribution Handler
  async function handleAIDistribute() {
    setAiError("");
    setAiLoading(true);
    try {
      const confirmedAttendances = (attendances || []).filter(
        (a) => a && (a.status === "confirmed" || a.status === "checked_in")
      );
      const confirmedIds = confirmedAttendances.map((a) => a.profile_id);
      const registeredPlayers = profileById
        ? Array.from(profileById.values()).filter(
            (p) => p.membership_is_active && confirmedIds.includes(p.id),
          )
        : [];
      const guestPlayers = (guests || []).map((g) => ({
        id: g.id,
        full_name: g.name,
        nickname: null,
        preferred_position: "Flexible",
        membership_is_active: true,
        is_guest: true,
        rating: g.rating || 2,
        attack_rating: g.rating || 2,
        defense_rating: g.rating || 2,
        midfield_rating: g.rating || 2,
        goalkeeper_rating: g.rating || 2,
      }));
      const confirmationTimes = new Map();
      confirmedAttendances.forEach((a) => {
        confirmationTimes.set(a.profile_id, new Date(a.updated_at || a.created_at || Date.now()).getTime());
      });
      (guests || []).forEach((g) => {
        confirmationTimes.set(g.id, new Date(g.updated_at || g.created_at || Date.now()).getTime());
      });
      let players = [...registeredPlayers, ...guestPlayers].map((p) => ({
        ...p,
        confirmed_at: confirmationTimes.get(p.id) || Date.now(),
      }));

      const playerSkills = (skills || []).filter((s) => confirmedIds.includes(s.player_id));
      let teamCount = players.length >= 10 && players.length <= 13 ? 2 : (players.length >= 14 && players.length <= 18 ? 3 : Math.ceil(players.length / 5));

      let penaltyTeam = null;

      const aiTeams = await distributeTeamsWithAI({
        players,
        skills: playerSkills,
        instructions: teamInstructions,
        teamCount,
      });

      if (penaltyTeam) {
        aiTeams.push({
          name: "Equipo C",
          playerIds: penaltyTeam.map((p) => p.id),
        });
        teamCount = 3;
        players = [...players, ...penaltyTeam];
      }

      const flatAssignedIds = aiTeams.flatMap((team) => team.playerIds || team.player_ids || []);
      const assignedIds = new Set(flatAssignedIds);
      const isValid = players.length >= 10
        && aiTeams.length === teamCount
        && flatAssignedIds.length === players.length
        && assignedIds.size === players.length
        && players.every((player) => assignedIds.has(player.id));
      if (!isValid) {
        const fallback = generateBalancedTeams(players);
        onGenerateTeams({ aiTeams: { teams: fallback.teams.map((team) => ({
          name: team.name,
          playerIds: team.players.map((player) => player.id),
        })), team_count: fallback.team_count }, aiFallback: true });
        setAiError("La IA devolvió equipos incompletos; usé distribución automática con todos los confirmados.");
        return;
      }

      const playerMap = new Map(players.map((p) => [p.id, p]));
      const aiTeamObjs = aiTeams.map((t) => ({
        players: (t.playerIds || t.player_ids || []).map((id) => playerMap.get(id)).filter(Boolean),
      }));
      const aiFairness = fairnessScore(aiTeamObjs);
      if (aiFairness > 1.5) {
        const fallback = generateBalancedTeams(players);
        onGenerateTeams({ aiTeams: { teams: fallback.teams.map((team) => ({
          name: team.name,
          playerIds: team.players.map((player) => player.id),
        })), team_count: fallback.team_count }, aiFallback: true });
        setAiError(`La IA generó equipos muy dispares (diferencia de ${aiFairness.toFixed(1)} pts); usé distribución automática.`);
        return;
      }

      onGenerateTeams({ aiTeams: { teams: aiTeams, team_count: aiTeams.length } });
      setToastMessage({ variant: "success", text: "Equipos generados con IA con éxito 🤖" });
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  }

  // Floating button guest link action
  const handleCopyGuestLink = async () => {
    const link = api.generateGuestLink(match?.id);
    try {
      await copyToClipboard(link);
      setToastMessage({ variant: "success", text: "Enlace de invitado copiado al portapapeles ✓" });
    } catch (err) {}
  };

  return (
    <div className="f5-match-container">
      {/* Toast Feedback */}
      {toastMessage && (
        <Toast
          variant={toastMessage.variant}
          message={toastMessage.text}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* ── HERO MATCH CARD ── */}
      <MatchHero
        match={match}
        confirmedCount={confirmedCount}
        myAttendance={myAttendance}
        onConfirm={onConfirm}
        onCancel={onCancel}
        onJoinWaitlist={onJoinWaitlist}
        onBack={onBack}
        attendances={attendances}
        selectedVenue={selectedVenue}
      />

      {/* ── ADMIN PANEL (Progressive Disclosure) ── */}
      {isAdmin && (
        <MatchAdminPanel
          match={match}
          isAdmin={isAdmin}
          attendances={attendances}
          guests={guests}
          profileById={profileById}
          profiles={profiles}
          confirmedCount={confirmedCount}
          onGenerateTeams={onGenerateTeams}
          handleAIDistribute={handleAIDistribute}
          aiLoading={aiLoading}
          aiError={aiError}
          teamInstructions={teamInstructions}
          setTeamInstructions={setTeamInstructions}
          onCheckIn={onCheckIn}
          onMarkNoShow={onMarkNoShow}
          onReconfirm={onReconfirm}
          onAddGuest={onAddGuest}
          onDeleteGuest={onDeleteGuest}
          onUpdateGuestRating={onUpdateGuestRating}
          onDeleteMatch={onDeleteMatch}
          setIsEditingStats={setIsEditingStats}
        />
      )}

      {/* ── STATS EDITOR (When toggled by admin) ── */}
      {isEditingStats && isAdmin && (
        <MatchStatsEditor
          statsForm={statsForm}
          updateStatField={updateStatField}
          handleSaveStats={handleSaveStats}
          savingStats={savingStats}
          onCancel={() => setIsEditingStats(false)}
        />
      )}

      {/* ── TABS NAVIGATION ── */}
      <MatchTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        confirmedCount={confirmedPlayers.length}
        teamsCount={(teams || []).length}
      />

      {/* ── TAB CONTENTS ── */}
      {activeTab === "partido" && (
        <MatchMatchTab
          match={match}
          selectedVenue={selectedVenue}
          profile={profile}
          attendances={attendances}
          matchStats={matchStats}
          confirmedCount={confirmedCount}
          onSaveStats={onSaveStats}
          currentMatchStats={currentMatchStats}
        />
      )}

      {activeTab === "jugadores" && (
        <MatchPlayersTab
          confirmedPlayers={confirmedPlayers}
          attendances={attendances}
          profileById={profileById}
          ratingMap={ratingMap}
          maxPlayers={match?.max_players || 15}
        />
      )}

      {activeTab === "equipos" && (
        <MatchTeamsTab
          match={match}
          teams={teams}
          isAdmin={isAdmin}
          ratingMap={ratingMap}
          skills={skills}
          matchStats={matchStats}
        />
      )}

      {/* Floating Action Button for guest link */}
      <button
        onClick={handleCopyGuestLink}
        title="Copiar enlace para invitados"
        className="f5-floating-btn"
      >
        <Link2 size={24} />
      </button>
    </div>
  );
}
