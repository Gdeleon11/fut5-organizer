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
            {profiles.filter((p) => p.membership_is_active).map((p) => (
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

function ReservationCard({ reservation, isAdmin, isSuperAdmin, currentUserId, onConfirm, onDelete, onUploadProof, onCopyLink, copiedId }) {
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
    <article className={classNames("reservation-card", reservation.status === "confirmed" && "is-confirmed")}>
      <div className="reservation-header">
        <div>
          <strong>{reservation.venue}</strong>
          <small>{dateStr}{reservation.reservation_time ? ` · ${reservation.reservation_time}` : ""}</small>
        </div>
        <span className={classNames("status-pill", isPending ? "is-pending" : "is-paid")}>
          {isPending ? "Pendiente" : "Confirmada"}
        </span>
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
          <button className="secondary-button" type="button" onClick={() => onCopyLink(reservation.id)}>
            {copiedId === reservation.id ? "Copiado ✓" : "Link para responsable"}
          </button>
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

export default function CourtReservationPage({
  activeGroupId,
  profiles,
  venues,
  matches = [],
  attendances = [],
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
  const [copiedId, setCopiedId] = useState(null);
  const [view, setView] = useState("cards"); // "cards" | "list"

  async function loadReservations() {
    if (!activeGroupId || !isAdmin || isDemoMode) return;
    try {
      const rows = await api.listReservations(activeGroupId);
      setReservations(rows);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (!isDemoMode && isAdmin) {
      setLoading(true);
      loadReservations().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [activeGroupId, isDemoMode, isAdmin]);

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
    setError(""); setNotice(""); setSaving(true);
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
        created.push(res);
      } catch (err) {
        errors.push(`Reserva ${i + 1} (${validEntries[i].venue}): ${err.message}`);
      }
    }
    if (created.length > 0) {
      setReservations((c) => [...c, ...created]);
      setShowForm(false);
      setRows([0]);
      setFormData({});
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

  const pending = reservations.filter((r) => r.status === "pending");
  const confirmed = reservations.filter((r) => r.status === "confirmed");
  const assistedReservations = matches
    .filter((match) => match.requires_reservation)
    .filter((match) => isAdmin || match.reservation_owner_user_id === currentUserId);

  // Group by date for list view
  const groupedByDate = {};
  reservations.forEach((r) => {
    const key = r.reservation_date || "Sin fecha";
    if (!groupedByDate[key]) groupedByDate[key] = [];
    groupedByDate[key].push(r);
  });
  const sortedDates = Object.keys(groupedByDate).sort();

  return (
    <div className="page-grid reservations-page">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Asistente</p>
            <h2>Reservas asistidas</h2>
            <small>Copiá el texto para administración y actualizá el estado.</small>
          </div>
          <span className="count-pill">{assistedReservations.length}</span>
        </div>
        {assistedReservations.length === 0 ? (
          <div className="empty-state compact">No hay reservas asistidas pendientes.</div>
        ) : (
          <div className="reservation-card-grid">
            {assistedReservations.map((match) => (
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
      </section>

      {isAdmin && (
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Reservas</p>
            <h2>Delegación de cancha</h2>
            <small>Delegá la reserva a un jugador. Subí el comprobante y confirmá.</small>
          </div>
          <div className="button-row">
            <button className="ghost-button" type="button" onClick={loadReservations}>Actualizar</button>
            {reservations.length > 0 && (
              <>
                <button
                  className={view === "cards" ? "" : "secondary-button"}
                  type="button"
                  onClick={() => setView("cards")}
                >
                  Tarjetas
                </button>
                <button
                  className={view === "list" ? "" : "secondary-button"}
                  type="button"
                  onClick={() => setView("list")}
                >
                  Lista
                </button>
              </>
            )}
            {isAdmin && (
              <button className="secondary-button" type="button" onClick={() => setShowForm((v) => !v)}>
                {showForm ? "Cancelar" : "+ Nueva"}
              </button>
            )}
          </div>
        </div>
        {error && <p className="form-message">{error}</p>}
        {notice && <p className="form-message success">{notice}</p>}

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
      )}

      {/* List view - grouped by date */}
      {isAdmin && view === "list" && reservations.length > 0 && (
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
                      {isAdmin && r.status === "pending" && (
                        <button className="secondary-button" type="button" onClick={() => copyLink(r.id)}>
                          {copiedId === r.id ? "✓" : "Link"}
                        </button>
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
      {isAdmin && view === "cards" && (
        reservations.length > 0 && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Seguimiento</h2>
                <small>{pending.length} pendientes · {confirmed.length} confirmadas</small>
              </div>
              <span className="count-pill">{reservations.length}</span>
            </div>
            <div className="reservation-card-grid">
              {[...pending, ...confirmed].map((r) => (
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
                />
              ))}
            </div>
          </section>
        )
      )}

      {isAdmin && reservations.length === 0 && !loading && !showForm && (
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
