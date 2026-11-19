import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { generateBalancedTeams, fairnessScore } from "../teamGeneration.js";
import { distributeTeamsWithAI } from "../groq.js";
import { copyToClipboard, displayName } from "../utils.js";
import { useAppearance } from "../appearance/AppearanceProvider.jsx";
import { buildMatchDetailModel } from "../matchday/matchDetailModel.js";
import { useMatchActions } from "../components/matchday/shared.jsx";
import { EditorialMatchDetail, CommandMatchDetail } from "../components/matchdetail/MatchDetailViews.jsx";
import { AdminTools, FifaModal, StatsModal, useFifaModal } from "../components/matchdetail/DetailBlocks.jsx";
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
  forceDesign,
}) {
  const { design: preferredDesign } = useAppearance();
  const design = forceDesign || preferredDesign;
  const fifa = useFifaModal();
  const [guestLinkCopied, setGuestLinkCopied] = useState(false);
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
    let players = [];
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
      players = [...registeredPlayers, ...guestPlayers].map((p) => ({
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
        groupId: match?.group_id,
        matchId: match?.id,
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
      if (players.length >= 10) {
        const fallback = generateBalancedTeams(players);
        onGenerateTeams({
          aiTeams: {
            teams: fallback.teams.map((team) => ({
              name: team.name,
              playerIds: team.players.map((player) => player.id),
            })),
            team_count: fallback.team_count,
          },
          aiFallback: true,
        });
        setAiError(`IA no disponible (${err.message}). Se usó el balanceador automático.`);
      } else {
        setAiError(err.message);
      }
    } finally {
      setAiLoading(false);
    }
  }

  // Guest link (was a floating button; now an inline action on the roster)
  const handleCopyGuestLink = async () => {
    const link = api.generateGuestLink(match?.id);
    try {
      await copyToClipboard(link);
      setGuestLinkCopied(true);
      window.setTimeout(() => setGuestLinkCopied(false), 1800);
      setToastMessage({ variant: "success", text: "Enlace de invitado copiado al portapapeles ✓" });
    } catch (err) {}
  };

  const vm = useMemo(() => {
    const model = buildMatchDetailModel({
      match, attendances, guests, profile, profileById, ratingMap, teams, matchStats, selectedVenue, clearance, fineAmount,
    });
    return model ? { ...model, rawTeams: teams || [] } : null;
  }, [match, attendances, guests, profile, profileById, ratingMap, teams, matchStats, selectedVenue, clearance, fineAmount]);

  // In the detail screen "Ver partido" is redundant; "Ver resumen" jumps to the result section.
  const entry = useMemo(() => {
    if (!vm) return null;
    const st = vm.state;
    const strip = (a) => (a && (a.kind === "open" || (a.kind === "summary" && !vm.isClosed)) ? null : a);
    return { ...vm.entry, state: { ...st, primary: strip(st.primary), secondary: strip(st.secondary) } };
  }, [vm]);

  const actions = useMatchActions({
    onConfirm: () => onConfirm?.(),
    onCancel: () => onCancel?.(),
    onJoinWaitlist: () => onJoinWaitlist?.(),
    onOpenMatch: () => document.getElementById("resumen")?.scrollIntoView({ behavior: "smooth", block: "start" }),
  });

  if (!vm) return null;

  const didParticipate = (attendances || []).some(
    (a) => a.profile_id === profile?.id && ["confirmed", "checked_in"].includes(a.status),
  );

  const shared = {
    isAdmin,
    roster: { onOpenPlayer: (p) => p && fifa.open(p), onCopyGuestLink: handleCopyGuestLink, guestLinkCopied },
    summary: { profile, matchStats, currentMatchStats, didParticipate },
  };

  const admin = isAdmin ? (
    <AdminTools
      vm={vm}
      attendances={attendances}
      profiles={profiles}
      profileById={profileById}
      guests={guests}
      onGenerateTeams={onGenerateTeams}
      onAIDistribute={handleAIDistribute}
      aiLoading={aiLoading}
      aiError={aiError}
      teamInstructions={teamInstructions}
      setTeamInstructions={setTeamInstructions}
      onOpenStats={() => setIsEditingStats(true)}
      onCheckIn={onCheckIn}
      onMarkNoShow={onMarkNoShow}
      onReconfirm={onReconfirm}
      onAddGuest={onAddGuest}
      onDeleteGuest={onDeleteGuest}
      onUpdateGuestRating={onUpdateGuestRating}
      onDeleteMatch={onDeleteMatch}
    />
  ) : null;

  const View = design === "command" ? CommandMatchDetail : EditorialMatchDetail;

  return (
    <div className={`md-matches md-design-${design}`} data-design={design} data-view="match-detail">
      {toastMessage && (
        <Toast variant={toastMessage.variant} message={toastMessage.text} onClose={() => setToastMessage(null)} />
      )}
      <View vm={vm} entry={entry} actions={actions} onBack={onBack} shared={shared} admin={admin} />
      <StatsModal
        open={isEditingStats && isAdmin}
        statsForm={statsForm}
        updateStatField={updateStatField}
        onSave={handleSaveStats}
        saving={savingStats}
        onClose={() => setIsEditingStats(false)}
        title={`${vm.title} · ${vm.parts.longLabel}`}
      />
      <FifaModal player={fifa.player} onClose={fifa.close} ratingMap={ratingMap} skills={skills} matchStats={matchStats} />
    </div>
  );
}
