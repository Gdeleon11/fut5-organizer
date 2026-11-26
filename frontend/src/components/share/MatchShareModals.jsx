import { useCallback, useMemo, useState } from "react";
import ShareSheetModal from "./ShareSheetModal.jsx";
import {
  buildFifaCardData,
  buildFifaShareText,
  buildInviteCardData,
  buildInviteShareText,
  buildResultCardData,
  buildResultShareText,
  buildTeamsCardData,
  buildTeamsShareText,
} from "../../share/shareData.js";
import {
  renderFifaPng,
  renderInvitePng,
  renderResultPng,
  renderTeamsPng,
} from "../../share/renderSharePng.js";

/* ============================================================================
 * PRIORITY A — CONVOCATORIA MODAL
 * ============================================================================ */
export function InviteShareModal({ open, onClose, vm, groupName = "", isAdmin = false }) {
  const hasVenue = Boolean(vm?.venue?.name || vm?.match?.venue);
  const hasGroupName = Boolean(groupName && groupName.trim());
  const [includeVenue, setIncludeVenue] = useState(hasVenue);
  // Group name is OFF by default and only toggleable by admin when a group name exists.
  const [includeGroupName, setIncludeGroupName] = useState(false);

  const data = useMemo(
    () =>
      buildInviteCardData({
        match: vm?.match,
        confirmedCount: vm?.confirmedCount ?? 0,
        capacity: vm?.capacity ?? 10,
        waitlistCount: vm?.waitlist?.length ?? 0,
        venueName: vm?.venue?.name || vm?.match?.venue || "",
        groupName,
        includeVenue: hasVenue && includeVenue,
        includeGroupName: isAdmin && hasGroupName && includeGroupName,
      }),
    [vm, groupName, hasVenue, includeVenue, isAdmin, hasGroupName, includeGroupName],
  );

  const shareText = useMemo(() => buildInviteShareText(data), [data]);
  const renderPng = useCallback((theme) => renderInvitePng(data, theme), [data]);

  const toggles = [
    hasVenue
      ? { id: "venue", label: "Mostrar cancha", checked: includeVenue, onChange: setIncludeVenue }
      : null,
    isAdmin && hasGroupName
      ? {
          id: "group",
          label: "Mostrar nombre del grupo",
          checked: includeGroupName,
          onChange: setIncludeGroupName,
        }
      : null,
  ].filter(Boolean);

  return (
    <ShareSheetModal
      open={open}
      onClose={onClose}
      eyebrow="Convocatoria"
      title="Compartir partido"
      subtitle={data.spotsHeadline}
      filename={`convocatoria-${vm?.match?.id || "f5"}.png`}
      shareText={shareText}
      copyLabel="Copiar invitación"
      whatsappLabel="Compartir por WhatsApp"
      renderPng={renderPng}
      toggles={toggles}
      privacyNote="El enlace dirige a la invitación oficial del partido sin exponer accesos administrativos ni datos privados."
      testId="share-invite-modal"
    />
  );
}

/* ============================================================================
 * PRIORITY B — EQUIPOS MODAL
 * ============================================================================ */
export function TeamsShareModal({ open, onClose, vm, pins = null }) {
  const data = useMemo(
    () =>
      buildTeamsCardData({
        match: vm?.match,
        teams: vm?.teams?.length ? vm.teams : vm?.rawTeams || [],
        venueName: vm?.venue?.name || vm?.match?.venue || "",
        pins,
      }),
    [vm, pins],
  );

  const shareText = useMemo(() => buildTeamsShareText(data), [data]);
  const renderPng = useCallback((theme) => renderTeamsPng(data, theme), [data]);

  return (
    <ShareSheetModal
      open={open}
      onClose={onClose}
      eyebrow="Equipos"
      title="Compartir equipos"
      subtitle={`${data.teams.length} equipos · ${data.totalPlayers} jugadores`}
      filename={`equipos-${vm?.match?.id || "f5"}.png`}
      shareText={shareText}
      copyLabel="Copiar equipos"
      whatsappLabel="Compartir por WhatsApp"
      renderPng={renderPng}
      privacyNote="Se exportan solo nombres deportivos y posiciones. No se muestran ratings ni información privada."
      testId="share-teams-modal"
    />
  );
}

/* ============================================================================
 * PRIORITY C — MI FIFA MODAL (OWNER-CONTROLLED)
 * ============================================================================ */
export function FifaShareModal({ open, onClose, profile, style = null, record = null, earnedAchievements = null }) {
  const hasPhoto = Boolean(profile?.avatar_url);
  const [includePhoto, setIncludePhoto] = useState(hasPhoto);

  const data = useMemo(
    () =>
      buildFifaCardData({
        profile,
        style,
        record,
        earnedAchievements,
        includePhoto: hasPhoto && includePhoto,
      }),
    [profile, style, record, earnedAchievements, hasPhoto, includePhoto],
  );

  const shareText = useMemo(() => buildFifaShareText(data), [data]);
  const renderPng = useCallback((theme) => renderFifaPng(data, theme), [data]);

  const toggles = hasPhoto
    ? [{ id: "photo", label: "Incluir mi foto", checked: includePhoto, onChange: setIncludePhoto }]
    : [];

  return (
    <ShareSheetModal
      open={open}
      onClose={onClose}
      eyebrow="Mi FIFA"
      title="Compartir mi tarjeta"
      subtitle={`${data.name} · ${data.positionLabel}`}
      filename={`mi-fifa-${profile?.id?.slice(0, 8) || "jugador"}.png`}
      shareText={shareText}
      copyLabel="Copiar resumen"
      whatsappLabel="Compartir por WhatsApp"
      renderPng={renderPng}
      toggles={toggles}
      privacyNote="Solo incluye tu nombre deportivo, estilo autodeclarado y estadísticas confirmadas de este grupo. Nunca comparte tu teléfono ni datos pendientes."
      testId="share-fifa-modal"
    />
  );
}

/* ============================================================================
 * PRIORITY D — RESULTADO FINAL MODAL
 * ============================================================================ */
export function ResultShareModal({ open, onClose, vm, confirmedStats = [], officialMvpName = null }) {
  const data = useMemo(
    () =>
      buildResultCardData({
        match: vm?.match,
        teams: vm?.teams?.length ? vm.teams : vm?.rawTeams || [],
        confirmedStats,
        confirmedCount: vm?.confirmedCount ?? 0,
        officialMvpName: officialMvpName ?? vm?.totals?.mvp ?? null,
      }),
    [vm, confirmedStats, officialMvpName],
  );

  const shareText = useMemo(() => buildResultShareText(data), [data]);
  const renderPng = useCallback((theme) => renderResultPng(data, theme), [data]);

  return (
    <ShareSheetModal
      open={open}
      onClose={onClose}
      eyebrow="Resultado"
      title="Compartir resultado"
      subtitle={data.officialMvp ? `MVP oficial: ${data.officialMvp}` : `${data.totalGoals} goles confirmados`}
      filename={`resultado-${vm?.match?.id || "f5"}.png`}
      shareText={shareText}
      copyLabel="Copiar resultado"
      whatsappLabel="Compartir por WhatsApp"
      renderPng={renderPng}
      privacyNote="Incluye únicamente estadísticas confirmadas y el MVP oficial cuando corresponda."
      testId="share-result-modal"
    />
  );
}
