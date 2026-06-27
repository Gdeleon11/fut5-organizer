import { useEffect, useState } from "react";
import Avatar from "../components/Avatar.jsx";
import { api } from "../api.js";
import { classNames, displayName } from "../utils.js";

function ReservationRow({ index, venues, profiles, onChange, onRemove }) {
  const [form, setForm] = useState({
    venue: "",
    reservation_date: "",
    reservation_time: "19:00",
    assigned_to: "",
    notes: "",
  });

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
      </div>
    </div>
  );
}

export default function CourtReservationPage({ activeGroupId, profiles, venues, isAdmin, isSuperAdmin, currentUserId, onCreateMatch }) {
  const [reservations, setReservations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [rows, setRows] = useState([0]);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (!activeGroupId) return;
    setLoading(true);
    api.listReservations(activeGroupId)
      .then(setReservations)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
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
    const entries = rows.map((_, i) => formData[i]).filter((d) => d?.venue && d?.reservation_date && d?.assigned_to);
    if (entries.length === 0) {
      setError("Completá al menos una reserva con cancha, fecha y responsable.");
      setSaving(false);
      return;
    }
    try {
      const created = [];
      for (const entry of entries) {
        const res = await api.createReservation({
          ...entry,
          group_id: activeGroupId,
          assigned_by: currentUserId,
        });
        created.push(res);
      }
      setReservations((c) => [...c, ...created]);
      setShowForm(false);
      setRows([0]);
      setFormData({});
      setNotice(`${created.length} reserva(s) creada(s).`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadProof(reservationId, file) {
    try {
      const url = await api.uploadReservationProof(reservationId, file);
      await api.updateReservation(reservationId, { proof_url: url });
      setReservations((c) => c.map((r) => r.id === reservationId ? { ...r, proof_url: url } : r));
    } catch (err) { setError(err.message); }
  }

  async function handleConfirm(reservation) {
    setError("");
    try {
      const match = await api.confirmReservation(
        reservation.id, activeGroupId, reservation.venue,
        reservation.reservation_date, reservation.reservation_time,
        `Partido en ${reservation.venue}`,
      );
      setReservations((c) => c.map((r) => r.id === reservation.id ? { ...r, status: "confirmed", match_id: match.id } : r));
      if (onCreateMatch) onCreateMatch(match);
      setNotice("Partido creado desde la reserva.");
    } catch (err) { setError(err.message); }
  }

  async function handleDelete(reservationId) {
    try {
      await api.deleteReservation(reservationId);
      setReservations((c) => c.filter((r) => r.id !== reservationId));
    } catch (err) { setError(err.message); }
  }

  async function copyLink(reservationId) {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const token = reservationId.replace(/-/g, "");
    const link = `${origin}/reserve/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(reservationId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      prompt("Copiá este link:", link);
    }
  }

  const pending = reservations.filter((r) => r.status === "pending");
  const confirmed = reservations.filter((r) => r.status === "confirmed");

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Reservas</p>
            <h2>Reservas de cancha</h2>
            <small>Delegá la reserva a un jugador. Subí el comprobante y confirmá.</small>
          </div>
          {isAdmin && (
            <button className="secondary-button" type="button" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancelar" : "+ Nueva reserva"}
            </button>
          )}
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

      {pending.length > 0 && (
        <section className="panel">
          <div className="section-heading">
            <h2>Pendientes</h2>
            <span className="count-pill">{pending.length}</span>
          </div>
          {pending.map((r) => (
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
        </section>
      )}

      {confirmed.length > 0 && (
        <section className="panel">
          <div className="section-heading">
            <h2>Confirmadas</h2>
            <span className="count-pill">{confirmed.length}</span>
          </div>
          {confirmed.map((r) => (
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
        </section>
      )}

      {reservations.length === 0 && !loading && !showForm && (
        <section className="panel">
          <div className="empty-state compact">No hay reservas. Creá una para delegar la cancha.</div>
        </section>
      )}
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

  return (
    <article className={classNames("reservation-card", reservation.status === "confirmed" && "is-confirmed")}>
      <div className="reservation-header">
        <div>
          <strong>{reservation.venue}</strong>
          <small>
            {new Date(reservation.reservation_date + "T12:00:00").toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" })}
            {reservation.reservation_time ? ` · ${reservation.reservation_time}` : ""}
          </small>
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
