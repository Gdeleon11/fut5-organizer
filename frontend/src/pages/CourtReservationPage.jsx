import { useEffect, useState } from "react";
import Avatar from "../components/Avatar.jsx";
import CopyReservationTextButton from "../components/CopyReservationTextButton.jsx";
import { api } from "../api.js";
import { activeReservationStatus, reservationStatusLabel } from "../reservationAssistant.js";
import { appOrigin, classNames, copyToClipboard, displayName } from "../utils.js";
import { collectGroupTags } from "../tags.js";
import VenuesPage from "./VenuesPage.jsx";

function ReservationRow({ index, venues, profiles, groupTags = [], onChange, onRemove }) {
  const [form, setForm] = useState({
    venue: "",
    reservation_date: "",
    reservation_time: "19:00",
    assigned_to: "",
    notes: "",
    allowed_tags: [],
  });

  const [selectedTags, setSelectedTags] = useState([]);

  function update(patch) {
    const next = { ...form, ...patch };
    setForm(next);
    onChange(index, next);
  }

  return (
    <div className="reservation-row">
      <div className="reservation-row-header">
        <strong>Reserva {index + 1}</strong>
        {index > 0 && (
          <button className="ghost-button" type="button" onClick={() => onRemove(index)}>✕</button>
        )}
      </div>
      <div className="form-grid">
        <label>
          Cancha
          {venues.length > 0 ? (
            <select value={form.venue} onChange={(e) => update({ venue: e.target.value })}>
              <option value="">Seleccionar</option>
              {venues.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
            </select>
          ) : (
            <input placeholder="Nombre de la cancha" value={form.venue} onChange={(e) => update({ venue: e.target.value })} />
          )}
        </label>
        <label>
          Fecha
          <input type="date" value={form.reservation_date} onChange={(e) => update({ reservation_date: e.target.value })} />
        </label>
        <label>
          Hora
          <input type="time" value={form.reservation_time} onChange={(e) => update({ reservation_time: e.target.value })} />
        </label>
        <label>
          Responsable
          <select value={form.assigned_to} onChange={(e) => update({ assigned_to: e.target.value })}>
            <option value="">Seleccionar jugador</option>
            {profiles.filter((p) => p.membership_is_active !== false).map((p) => (
              <option key={p.id} value={p.id}>{displayName(p)}</option>
            ))}
          </select>
        </label>
        <label>
          Notas (opcional)
          <input placeholder="Ej. Reservar cancha 2" value={form.notes} onChange={(e) => update({ notes: e.target.value })} />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          Restringir acceso por Tags (opcional)
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "0.25rem 0" }}>
            {groupTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    const next = isSelected
                      ? selectedTags.filter((t) => t !== tag)
                      : [...selectedTags, tag];
                    setSelectedTags(next);
                    update({ allowed_tags: next });
                  }}
                  className={`tag-chip ${isSelected ? "is-active" : ""}`}
                  style={{
                    padding: "0.2rem 0.6rem",
                    borderRadius: "15px",
                    fontSize: "0.75rem",
                    border: isSelected ? "1px solid var(--primary)" : "1px solid rgba(255,255,255,0.1)",
                    background: isSelected ? "rgba(16, 185, 129, 0.15)" : "transparent",
                    color: isSelected ? "var(--primary)" : "var(--text-muted)",
                    cursor: "pointer"
                  }}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
          {selectedTags.length === 0 && <small className="muted">Público para todo el grupo.</small>}
        </label>
      </div>
    </div>
  );
}

function ReservationCard({ reservation, isAdmin, isSuperAdmin, currentUserId, onConfirm, onDelete, onUploadProof, onCopyLink, copiedId, isNewlyCreated }) {
  const [uploading, setUploading] = useState(false);
  const isAssigned = reservation.assigned_to === currentUserId;
  const canConfirm = isAdmin || isAssigned;
  const isPending = reservation.status === "pending";

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { await onUploadProof(reservation.id, file); } finally { setUploading(false); }
  }

  const dateStr = reservation.reservation_date
    ? new Date(reservation.reservation_date + "T12:00:00").toLocaleDateString("es-GT", { weekday: "short", day: "numeric", month: "short" })
    : "";

  return (
    <article className={classNames("reservation-card", reservation.status === "confirmed" && "is-confirmed", isNewlyCreated && "is-newly-created")}>
      <div className="reservation-header">
        <div>
          <strong>{reservation.venue}</strong>
          <small>{dateStr}{reservation.reservation_time ? ` · ${reservation.reservation_time}` : ""}</small>
        </div>
        <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
          {isNewlyCreated && (
            <span className="status-pill" style={{ background: "var(--primary)", color: "#000", fontWeight: "bold" }}>
              ¡Nueva!
            </span>
          )}
          <span className={classNames("status-pill", isPending ? "is-pending" : "is-paid")}>
            {isPending ? "Pendiente" : "Confirmada"}
          </span>
        </div>
      </div>

      <div className="reservation-details">
        <div className="reservation-assigned">
          <small>Responsable:</small>
          <div className="reservation-person">
            <Avatar profile={reservation.assigned_profile} size="sm" />
            <span>{displayName(reservation.assigned_profile)}</span>
          </div>
        </div>
        {reservation.notes && <small className="reservation-notes">{reservation.notes}</small>}
      </div>

      {reservation.proof_url && (
        <div className="reservation-proof">
          <a href={reservation.proof_url} target="_blank" rel="noopener">
            <img src={reservation.proof_url} alt="Comprobante" />
          </a>
        </div>
      )}

      <div className="button-row reservation-actions">
        {isPending && (
          <>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `¡Hola ${displayName(reservation.assigned_profile)}! Te asigné la reserva de la cancha *${reservation.venue}* (${dateStr} ${reservation.reservation_time || ""}). Por favor subí tu comprobante acá:\n${appOrigin()}/reserve/${reservation.id.replace(/-/g, "")}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="secondary-button"
              style={{ background: "#25D366", color: "#fff", border: "none", display: "inline-flex", alignItems: "center", gap: "0.35rem", textDecoration: "none" }}
            >
              💬 WhatsApp
            </a>
            <button className="secondary-button" type="button" onClick={() => onCopyLink(reservation.id)}>
              {copiedId === reservation.id ? "Copiado ✓" : "📋 Copiar Link"}
            </button>
          </>
        )}
        {isPending && canConfirm && (
          <>
            {!reservation.proof_url && (
              <label className="secondary-button" style={{ cursor: "pointer" }}>
                {uploading ? "Subiendo..." : "Subir comprobante"}
                <input type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
              </label>
            )}
            <button
              type="button"
              onClick={() => onConfirm(reservation)}
              disabled={!reservation.proof_url}
              title={!reservation.proof_url ? "Subí el comprobante primero" : ""}
            >
              Confirmar y crear partido
            </button>
          </>
        )}
        {isPending && isSuperAdmin && (
          <button className="danger-button" type="button" onClick={() => { if (confirm("¿Eliminar?")) onDelete(reservation.id); }}>
            Eliminar
          </button>
        )}
        {!isPending && reservation.match_id && (
          <small className="muted">Partido creado ✓</small>
        )}
      </div>
    </article>
  );
}

function AssistedReservationCard({ match, profiles, attendances, canEdit, onUpdateMatch, onNotice }) {
  const status = activeReservationStatus(match);
  const owner = profiles.find((profile) => profile.id === match.reservation_owner_user_id);

  async function updateStatus(nextStatus) {
    await onUpdateMatch(match.id, {
      reservation_status: nextStatus,
      requires_reservation: true,
    });
  }

  return (
    <article className={classNames("reservation-card assisted-reservation-card", status === "confirmed" && "is-confirmed")}>
      <div className="reservation-header">
        <div>
          <strong>{match.title || "Chamuscón"}</strong>
          <small>{match.venue || "Cancha pendiente"} · {match.preferred_time_range || match.start_time || "Horario pendiente"}</small>
        </div>
        <span className={classNames("status-pill", status === "pending" && "is-pending", status === "confirmed" && "is-paid")}>
          {reservationStatusLabel(status)}
        </span>
      </div>
      <div className="reservation-details">
        <div className="reservation-assigned">
          <small>Responsable:</small>
          <div className="reservation-person">
            <Avatar profile={owner} size="sm" />
            <span>{owner ? displayName(owner) : "Sin responsable"}</span>
          </div>
        </div>
        {match.reservation_notes && <small className="reservation-notes">{match.reservation_notes}</small>}
      </div>
      <div className="button-row reservation-actions">
        <CopyReservationTextButton
          match={match}
          attendances={attendances}
          profiles={profiles}
          onCopied={onNotice}
        />
        {canEdit && (
          <select value={status} onChange={(e) => updateStatus(e.target.value)}>
            <option value="pending">Pendiente</option>
            <option value="confirmed">Confirmada</option>
            <option value="failed">Fallida</option>
          </select>
        )}
      </div>
    </article>
  );
}

function AssistedHistoryRow({ match, profiles, canEdit, onUpdateMatch }) {
  const status = activeReservationStatus(match);
  const owner = profiles.find((profile) => profile.id === match.reservation_owner_user_id);
  const isFailed = status === "failed";

  return (
    <div className="assisted-history-row">
      <div className="assisted-history-info">
        <strong>{match.title || "Chamuscón"}</strong>
        <small>
          {match.venue || "Cancha pendiente"} · {match.preferred_time_range || match.start_time || "Horario pendiente"}
          {owner ? ` · ${displayName(owner)}` : ""}
        </small>
      </div>
      <div className="assisted-history-actions">
        <span className={classNames("status-pill", isFailed ? "is-failed" : "is-paid")}>
          {reservationStatusLabel(status)}
        </span>
        {canEdit && (
          <select
            className="compact-select"
            aria-label="Cambiar estado de la reserva"
            value={status}
            onChange={(e) => onUpdateMatch(match.id, {
              reservation_status: e.target.value,
              requires_reservation: true,
            })}
          >
            <option value="pending">Pendiente</option>
            <option value="confirmed">Confirmada</option>
            <option value="failed">Fallida</option>
          </select>
        )}
      </div>
    </div>
  );
}

export default function CourtReservationPage({
  activeGroupId,
  profiles,
  venues,
  matches = [],
  attendances = [],
  groupTags = [],
  isAdmin,
  isSuperAdmin,
  currentUserId,
  onUpdateMatch,
  onNotice,
  onCreateMatch,
  onCreateVenue,
  onUpdateVenue,
  isDemoMode = false,
  reservations = [],
  setReservations,
}) {
  const [showForm, setShowForm] = useState(false);
  const [rows, setRows] = useState([0]);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [recentlyCreated, setRecentlyCreated] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [view, setView] = useState("cards"); // "cards" | "list"
  const [rangeFilter, setRangeFilter] = useState("3"); // "3" | "10" | "all"
  const [expandedPending, setExpandedPending] = useState(false);
  const [expandedConfirmed, setExpandedConfirmed] = useState(false);

  async function loadReservations() {
    if (!activeGroupId || isDemoMode) return;
    try {
      const rows = await api.listReservations(activeGroupId);
      setReservations(rows);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (!isDemoMode) {
      setLoading(true);
      loadReservations().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [activeGroupId, isDemoMode]);

  // Auto-refresh when tab becomes visible again
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") loadReservations();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [activeGroupId]);

  function handleRowChange(index, data) {
    setFormData((prev) => ({ ...prev, [index]: data }));
  }

  function addRow() {
    if (rows.length >= 3) return;
    setRows((prev) => [...prev, prev.length]);
  }

  function removeRow(index) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setFormData((prev) => {
      const next = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = Number(k);
        if (ki < index) next[ki] = v;
        else if (ki > index) next[ki - 1] = v;
      });
      return next;
    });
  }

  async function handleCreate() {
    setError(""); setNotice(""); setRecentlyCreated([]); setSaving(true);
    const allRows = rows.map((_, i) => formData[i]);
    const validEntries = allRows.filter((d) => d?.venue && d?.reservation_date && d?.assigned_to);
    const invalidCount = allRows.length - validEntries.length;
    
    if (validEntries.length === 0) {
      setError("Completá al menos una reserva con cancha, fecha y responsable.");
      setSaving(false);
      return;
    }

    const created = [];
    const errors = [];
    for (let i = 0; i < validEntries.length; i++) {
      try {
        const formRow = validEntries[i];
        const notesWithTags = formRow.allowed_tags && formRow.allowed_tags.length > 0
          ? `[Tags: ${formRow.allowed_tags.join(",")}] ${formRow.notes || ""}`
          : formRow.notes || null;

        const payload = {
          venue: formRow.venue,
          reservation_date: formRow.reservation_date,
          reservation_time: formRow.reservation_time || "19:00",
          assigned_to: formRow.assigned_to,
          notes: notesWithTags,
          group_id: activeGroupId,
          assigned_by: currentUserId,
        };

        let res;
        if (isDemoMode) {
          res = {
            id: `res-mock-${Date.now()}-${i}`,
            ...payload,
            status: "pending",
            proof_url: null,
            created_at: new Date().toISOString()
          };
        } else {
          res = await api.createReservation(payload);
        }
        const assignedProf = profiles.find((p) => p.id === payload.assigned_to) || null;
        res.assigned_profile = assignedProf;
        created.push(res);
      } catch (err) {
        errors.push(`Reserva ${i + 1} (${validEntries[i].venue}): ${err.message}`);
      }
    }
    if (created.length > 0) {
      setReservations((c) => [...c, ...created]);
      setRecentlyCreated(created);
      setShowForm(false);
      setRows([0]);
      setFormData({});
      loadReservations();

      setTimeout(() => {
        const targetEl = document.getElementById("seguimiento-panel");
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 150);
    }
    if (errors.length > 0) {
      setError(`Errores: ${errors.join(" | ")}`);
    } else if (invalidCount > 0) {
      setNotice(`${created.length} reserva(s) creada(s). ${invalidCount} fila(s) incompleta(s) ignorada(s).`);
    } else {
      setNotice(`${created.length} reserva(s) creada(s).`);
    }
    setSaving(false);
  }

  async function handleUploadProof(reservationId, file) {
    try {
      let url;
      if (isDemoMode) {
        url = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=300";
      } else {
        url = await api.uploadReservationProof(reservationId, file);
        await api.updateReservation(reservationId, { proof_url: url });
      }
      setReservations((c) => c.map((r) => r.id === reservationId ? { ...r, proof_url: url } : r));
    } catch (err) { setError(err.message); }
  }

  async function handleConfirm(reservation) {
    setError("");
    try {
      let match;
      if (isDemoMode) {
        let allowedTags = [];
        let cleanTitle = `Partido en ${reservation.venue}`;

        if (reservation.notes) {
          const matchTags = reservation.notes.match(/^\[Tags:\s*([^\]]*)\]\s*(.*)/);
          if (matchTags) {
            const tagStr = matchTags[1];
            allowedTags = tagStr.split(",").map((t) => t.trim()).filter(Boolean);
            const restNotes = matchTags[2];
            if (restNotes) {
              cleanTitle = restNotes;
            }
          }
        }

        match = {
          id: `m-mock-${Date.now()}`,
          group_id: activeGroupId,
          title: cleanTitle,
          match_date: reservation.reservation_date,
          start_time: reservation.reservation_time || "19:00",
          venue: reservation.venue,
          status: "upcoming",
          allowed_tags: allowedTags
        };
      } else {
        match = await api.confirmReservation(
          reservation.id, activeGroupId, reservation.venue,
          reservation.reservation_date, reservation.reservation_time,
          `Partido en ${reservation.venue}`,
        );
      }
      setReservations((c) => c.map((r) => r.id === reservation.id ? { ...r, status: "confirmed", match_id: match.id } : r));
      if (onCreateMatch) onCreateMatch(match);
      setNotice("Partido creado desde la reserva (Simulación Local).");
    } catch (err) { setError(err.message); }
  }

  async function handleDelete(reservationId) {
    try {
      if (!isDemoMode) {
        await api.deleteReservation(reservationId);
      }
      setReservations((c) => c.filter((r) => r.id !== reservationId));
    } catch (err) { setError(err.message); }
  }

  async function copyLink(reservationId) {
    const token = reservationId.replace(/-/g, "");
    const link = `${appOrigin()}/reserve/${token}`;
    try {
      await copyToClipboard(link);
      setCopiedId(reservationId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Error copying reservation link:", err);
    }
  }

  const newlyCreatedSet = new Set(recentlyCreated.map((r) => r.id));

  const pending = reservations.filter((r) => r.status === "pending");
  pending.sort((a, b) => {
    const aNew = newlyCreatedSet.has(a.id) ? 1 : 0;
    const bNew = newlyCreatedSet.has(b.id) ? 1 : 0;
    if (aNew !== bNew) return bNew - aNew;
    return (b.created_at || b.reservation_date || "").localeCompare(a.created_at || a.reservation_date || "");
  });

  const confirmed = reservations.filter((r) => r.status === "confirmed");
  confirmed.sort((a, b) => (b.reservation_date || "").localeCompare(a.reservation_date || ""));

  const effectivePendingLimit = rangeFilter === "3" && !expandedPending ? 3 : rangeFilter === "10" && !expandedPending ? 10 : pending.length;
  const visiblePending = pending.slice(0, effectivePendingLimit);

  const effectiveConfirmedLimit = rangeFilter === "3" && !expandedConfirmed ? 3 : rangeFilter === "10" && !expandedConfirmed ? 10 : confirmed.length;
  const visibleConfirmed = confirmed.slice(0, effectiveConfirmedLimit);

  const assistedReservations = matches
    .filter((match) => match.requires_reservation)
    .filter((match) => isAdmin || match.reservation_owner_user_id === currentUserId);
  const assistedPending = assistedReservations.filter((m) => activeReservationStatus(m) === "pending");
  const assistedFailed = assistedReservations.filter((m) => activeReservationStatus(m) === "failed");

  // Group by date for list view
  const groupedByDate = {};
  reservations.forEach((r) => {
    const key = r.reservation_date || "Sin fecha";
    if (!groupedByDate[key]) groupedByDate[key] = [];
    groupedByDate[key].push(r);
  });
  const sortedDates = Object.keys(groupedByDate).sort().reverse();

  return (
    <div className="page-grid reservations-page">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Asistente</p>
            <h2>Reservas asistidas</h2>
            <small>Copiá el texto para administración y actualizá el estado.</small>
          </div>
          <span className="count-pill">{assistedPending.length}</span>
        </div>
        {assistedPending.length === 0 ? (
          <div className="empty-state compact">No hay reservas asistidas pendientes.</div>
        ) : (
          <div className="reservation-card-grid">
            {assistedPending.map((match) => (
              <AssistedReservationCard
                key={match.id}
                match={match}
                profiles={profiles}
                attendances={attendances}
                canEdit={isAdmin || match.reservation_owner_user_id === currentUserId}
                onUpdateMatch={onUpdateMatch}
                onNotice={onNotice}
              />
            ))}
          </div>
        )}

        {assistedFailed.length > 0 && (
          <div className="assisted-history-block is-failed">
            <div className="assisted-history-heading">
              <h3>Fallidas</h3>
              <span className="count-pill">{assistedFailed.length}</span>
            </div>
            {assistedFailed.map((match) => (
              <AssistedHistoryRow
                key={match.id}
                match={match}
                profiles={profiles}
                canEdit={isAdmin || match.reservation_owner_user_id === currentUserId}
                onUpdateMatch={onUpdateMatch}
              />
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Reservas</p>
            <h2>Delegación de cancha</h2>
            <small>Delegá la reserva a un jugador. Subí el comprobante y confirmá.</small>
          </div>
          <div className="toolbar-row">
            <button
              className="toolbar-btn ghost-button"
              type="button"
              onClick={loadReservations}
              title="Actualizar"
              aria-label="Actualizar"
            >
              ↻
            </button>
            {reservations.length > 0 && (
              <div className="seg-control" role="group" aria-label="Vista de reservas">
                <button
                  className={classNames("seg-btn", view === "cards" && "is-active")}
                  type="button"
                  onClick={() => setView("cards")}
                >
                  Tarjetas
                </button>
                <button
                  className={classNames("seg-btn", view === "list" && "is-active")}
                  type="button"
                  onClick={() => setView("list")}
                >
                  Lista
                </button>
              </div>
            )}
            <button
              className={classNames("toolbar-btn", showForm && "secondary-button")}
              type="button"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? "Cancelar" : "+ Nueva"}
            </button>
          </div>
        </div>
        {error && <p className="form-message">{error}</p>}
        {notice && <p className="form-message success">{notice}</p>}

        {recentlyCreated.length > 0 && (() => {
          const groupedByPlayer = {};
          recentlyCreated.forEach((r) => {
            const key = r.assigned_to || "unassigned";
            if (!groupedByPlayer[key]) groupedByPlayer[key] = [];
            groupedByPlayer[key].push(r);
          });

          return (
            <div className="created-reservations-banner">
              <h3>¡Reserva(s) creada(s) exitosamente!</h3>
              <p>Compartí el enlace directamente con los jugadores responsables para que suban su comprobante:</p>
              <div className="created-reservations-list">
                {Object.entries(groupedByPlayer).map(([key, rList]) => {
                  const personName = displayName(rList[0]?.assigned_profile);
                  const tokens = rList.map((r) => r.id.replace(/-/g, "")).join("_");
                  const link = `${appOrigin()}/reserve/${tokens}`;
                  const count = rList.length;

                  let waMessage = "";
                  if (count > 1) {
                    const listSummary = rList.map((r) => {
                      const dateStr = r.reservation_date
                        ? new Date(r.reservation_date + "T12:00:00").toLocaleDateString("es-GT", { weekday: "short", day: "numeric", month: "short" })
                        : "";
                      return `• *${r.venue}* (${dateStr} ${r.reservation_time || ""})`;
                    }).join("\n");
                    waMessage = encodeURIComponent(
                      `¡Hola ${personName}! Te asigné ${count} reservas de cancha:\n${listSummary}\n\nPor favor subí tu(s) comprobante(s) acá:\n${link}`
                    );
                  } else {
                    const r = rList[0];
                    const dateStr = r.reservation_date
                      ? new Date(r.reservation_date + "T12:00:00").toLocaleDateString("es-GT", { weekday: "short", day: "numeric", month: "short" })
                      : "";
                    waMessage = encodeURIComponent(
                      `¡Hola ${personName}! Te asigné la reserva de la cancha *${r.venue}* (${dateStr} ${r.reservation_time || ""}). Por favor subí tu comprobante acá:\n${link}`
                    );
                  }
                  const waUrl = `https://wa.me/?text=${waMessage}`;

                  return (
                    <div key={key} className="created-reservation-item">
                      <div>
                        <strong>{count > 1 ? `${count} Reservas para ${personName}` : rList[0].venue}</strong>
                        {count > 1 ? (
                          <div style={{ marginTop: "0.25rem" }}>
                            {rList.map((r) => {
                              const dStr = r.reservation_date
                                ? new Date(r.reservation_date + "T12:00:00").toLocaleDateString("es-GT", { weekday: "short", day: "numeric", month: "short" })
                                : "";
                              return (
                                <div key={r.id} style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                  • {r.venue} ({dStr} {r.reservation_time || ""})
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div><small>Responsable: <strong>{personName}</strong></small></div>
                        )}
                      </div>
                      <div className="button-row" style={{ marginTop: 0 }}>
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="secondary-button"
                          style={{ background: "#25D366", color: "#fff", border: "none", display: "inline-flex", alignItems: "center", gap: "0.35rem", textDecoration: "none" }}
                        >
                          💬 WhatsApp
                        </a>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => copyLink(rList[0].id, rList)}
                        >
                          {copiedId === rList[0].id ? "Copiado ✓" : "📋 Copiar Link"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {showForm && (
          <div className="reservation-form-block">
            {rows.map((_, i) => (
              <ReservationRow
                key={i}
                index={i}
                venues={venues}
                profiles={profiles}
                groupTags={groupTags}
                onChange={handleRowChange}
                onRemove={removeRow}
              />
            ))}
            {rows.length < 3 && (
              <button className="secondary-button" type="button" onClick={addRow}>
                + Agregar otra reserva
              </button>
            )}
            <div className="button-row">
              <button type="button" onClick={handleCreate} disabled={saving}>
                {saving ? "Guardando..." : `Crear ${rows.length} reserva(s)`}
              </button>
              <button className="secondary-button" type="button" onClick={() => { setShowForm(false); setRows([0]); setFormData({}); }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      {/* List view - grouped by date */}
      {view === "list" && reservations.length > 0 && (
        <section className="panel">
          <div className="section-heading">
            <h2>Todas las reservas</h2>
            <span className="count-pill">{reservations.length}</span>
          </div>
          <div className="reservation-list">
            {sortedDates.map((date) => (
              <div key={date} className="reservation-date-group">
                <div className="reservation-date-header">
                  <strong>
                    {date !== "Sin fecha"
                      ? new Date(date + "T12:00:00").toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" })
                      : "Sin fecha"}
                  </strong>
                </div>
                {groupedByDate[date].map((r) => (
                  <div key={r.id} className="reservation-list-row">
                    <div className="reservation-list-info">
                      <span className="reservation-list-venue">{r.venue}</span>
                      <span className="reservation-list-time">{r.reservation_time || ""}</span>
                      <span className="reservation-list-person">
                        <Avatar profile={r.assigned_profile} size="sm" />
                        {displayName(r.assigned_profile)}
                      </span>
                    </div>
                    <div className="reservation-list-status">
                      <span className={classNames("status-pill", r.status === "pending" ? "is-pending" : "is-paid")}>
                        {r.status === "pending" ? "Pendiente" : "Confirmada"}
                      </span>
                      {r.proof_url && <span className="reservation-list-proof">📎</span>}
                      {r.status === "pending" && (
                        <div style={{ display: "inline-flex", gap: "0.35rem" }}>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(
                              `¡Hola ${displayName(r.assigned_profile)}! Te asigné la reserva de la cancha *${r.venue}* (${r.reservation_date} ${r.reservation_time || ""}). Por favor subí tu comprobante acá:\n${appOrigin()}/reserve/${r.id.replace(/-/g, "")}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="secondary-button"
                            style={{ background: "#25D366", color: "#fff", border: "none", display: "inline-flex", alignItems: "center", textDecoration: "none", padding: "0.2rem 0.5rem" }}
                            title="Enviar por WhatsApp"
                          >
                            💬
                          </a>
                          <button className="secondary-button" type="button" onClick={() => copyLink(r.id)}>
                            {copiedId === r.id ? "✓" : "📋 Link"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Card view */}
      {view === "cards" && (
        reservations.length > 0 && (
          <section id="seguimiento-panel" className="panel">
            <div className="section-heading" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
              <div>
                <h2>Seguimiento</h2>
                <small>{pending.length} pendientes · {confirmed.length} confirmadas</small>
              </div>
              <div className="toolbar-row" style={{ marginLeft: "auto", flexWrap: "wrap", gap: "0.5rem" }}>
                <div className="range-filter-control seg-control" role="group" aria-label="Rango de reservas">
                  <button
                    className={classNames("seg-btn", rangeFilter === "3" && "is-active")}
                    type="button"
                    onClick={() => { setRangeFilter("3"); setExpandedPending(false); setExpandedConfirmed(false); }}
                    title="Mostrar las últimas 3 por categoría"
                  >
                    Últimas 3
                  </button>
                  <button
                    className={classNames("seg-btn", rangeFilter === "10" && "is-active")}
                    type="button"
                    onClick={() => { setRangeFilter("10"); setExpandedPending(false); setExpandedConfirmed(false); }}
                    title="Mostrar las últimas 10 por categoría"
                  >
                    Últimas 10
                  </button>
                  <button
                    className={classNames("seg-btn", rangeFilter === "all" && "is-active")}
                    type="button"
                    onClick={() => { setRangeFilter("all"); setExpandedPending(true); setExpandedConfirmed(true); }}
                    title="Mostrar todas las reservas"
                  >
                    Todas ({reservations.length})
                  </button>
                </div>
                <span className="count-pill">{reservations.length}</span>
              </div>
            </div>

            {/* Sub-sección Pendientes de Confirmar */}
            {pending.length > 0 && (
              <div className="reservation-subgroup">
                <div className="reservation-subgroup-heading">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>Pendientes de confirmar</h3>
                    <span className="count-pill is-pending">{pending.length}</span>
                  </div>
                  {pending.length > visiblePending.length && (
                    <small className="muted" style={{ fontSize: "0.78rem" }}>
                      Mostrando {visiblePending.length} de {pending.length}
                    </small>
                  )}
                </div>
                <div className="reservation-card-grid">
                  {visiblePending.map((r) => (
                    <ReservationCard
                      key={r.id}
                      reservation={r}
                      isAdmin={isAdmin}
                      isSuperAdmin={isSuperAdmin}
                      currentUserId={currentUserId}
                      onConfirm={handleConfirm}
                      onDelete={handleDelete}
                      onUploadProof={handleUploadProof}
                      onCopyLink={copyLink}
                      copiedId={copiedId}
                      isNewlyCreated={newlyCreatedSet.has(r.id)}
                    />
                  ))}
                </div>
                {pending.length > visiblePending.length && (
                  <div className="reservation-expand-footer">
                    <button
                      type="button"
                      className="secondary-button expand-reservations-btn"
                      onClick={() => setExpandedPending(true)}
                    >
                      Ver todas las pendientes ({pending.length}) ▾
                    </button>
                  </div>
                )}
                {expandedPending && pending.length > 3 && rangeFilter === "3" && (
                  <div className="reservation-expand-footer">
                    <button
                      type="button"
                      className="ghost-button expand-reservations-btn"
                      onClick={() => setExpandedPending(false)}
                    >
                      Ver menos pendientes ▴
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Sub-sección Reservas Confirmadas */}
            {confirmed.length > 0 && (
              <div className="reservation-subgroup" style={{ marginTop: pending.length > 0 ? "1.75rem" : 0 }}>
                <div className="reservation-subgroup-heading">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>Reservas confirmadas</h3>
                    <span className="count-pill is-confirmed" style={{ background: "rgba(16, 185, 129, 0.15)", color: "var(--primary)", border: "1px solid rgba(16, 185, 129, 0.3)" }}>{confirmed.length}</span>
                  </div>
                  {confirmed.length > visibleConfirmed.length && (
                    <small className="muted" style={{ fontSize: "0.78rem" }}>
                      Mostrando {visibleConfirmed.length} de {confirmed.length}
                    </small>
                  )}
                </div>
                <div className="reservation-card-grid">
                  {visibleConfirmed.map((r) => (
                    <ReservationCard
                      key={r.id}
                      reservation={r}
                      isAdmin={isAdmin}
                      isSuperAdmin={isSuperAdmin}
                      currentUserId={currentUserId}
                      onConfirm={handleConfirm}
                      onDelete={handleDelete}
                      onUploadProof={handleUploadProof}
                      onCopyLink={copyLink}
                      copiedId={copiedId}
                      isNewlyCreated={newlyCreatedSet.has(r.id)}
                    />
                  ))}
                </div>
                {confirmed.length > visibleConfirmed.length && (
                  <div className="reservation-expand-footer">
                    <button
                      type="button"
                      className="secondary-button expand-reservations-btn"
                      onClick={() => setExpandedConfirmed(true)}
                    >
                      Ver todas las confirmadas ({confirmed.length}) ▾
                    </button>
                  </div>
                )}
                {expandedConfirmed && confirmed.length > 3 && rangeFilter === "3" && (
                  <div className="reservation-expand-footer">
                    <button
                      type="button"
                      className="ghost-button expand-reservations-btn"
                      onClick={() => setExpandedConfirmed(false)}
                    >
                      Ver menos confirmadas ▴
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )
      )}


      {reservations.length === 0 && !loading && !showForm && (
        <section className="panel">
          <div className="empty-state compact">No hay reservas. Creá una para delegar la cancha.</div>
        </section>
      )}

      {/* Catálogo de Canchas Consolidado */}
      <div style={{ gridColumn: "1 / -1", marginTop: "2rem" }}>
        <VenuesPage
          groupId={activeGroupId}
          profileId={currentUserId}
          venues={venues}
          matches={matches}
          onCreateVenue={onCreateVenue}
          onUpdateVenue={onUpdateVenue}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
