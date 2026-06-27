import { useEffect, useState } from "react";
import Avatar from "../components/Avatar.jsx";
import { api } from "../api.js";
import { classNames, displayName, formatMoney } from "../utils.js";

function ReservationForm({ profiles, venues, onSave, onCancel }) {
  const [form, setForm] = useState({
    venue: "",
    reservation_date: "",
    reservation_time: "19:00",
    assigned_to: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const update = (p) => setForm((f) => ({ ...f, ...p }));

  async function submit(e) {
    e.preventDefault(); setError("");
    if (!form.venue.trim()) { setError("Poné la cancha."); return; }
    if (!form.reservation_date) { setError("Elegí una fecha."); return; }
    if (!form.assigned_to) { setError("Asigná un responsable."); return; }
    await onSave(form);
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      {error && <p className="form-message">{error}</p>}
      <label>
        Cancha
        {venues.length > 0 ? (
          <select value={form.venue} onChange={(e) => update({ venue: e.target.value })}>
            <option value="">Seleccionar cancha</option>
            {venues.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
          </select>
        ) : (
          <input placeholder="Ej. Cancha Los Pinos" value={form.venue} onChange={(e) => update({ venue: e.target.value })} />
        )}
      </label>
      <label>
        Fecha de reserva
        <input type="date" value={form.reservation_date} onChange={(e) => update({ reservation_date: e.target.value })} />
      </label>
      <label>
        Hora
        <input type="time" value={form.reservation_time} onChange={(e) => update({ reservation_time: e.target.value })} />
      </label>
      <label>
        Responsable de reservar
        <select value={form.assigned_to} onChange={(e) => update({ assigned_to: e.target.value })}>
          <option value="">Seleccionar jugador</option>
          {profiles.filter((p) => p.membership_is_active).map((p) => (
            <option key={p.id} value={p.id}>{displayName(p)}</option>
          ))}
        </select>
      </label>
      <label>
        Notas (opcional)
        <input placeholder="Ej. Reservar cancha 2, pagar con tarjeta" value={form.notes} onChange={(e) => update({ notes: e.target.value })} />
      </label>
      <button type="submit">Crear reserva</button>
      <button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button>
    </form>
  );
}

function ReservationCard({ reservation, profiles, isAdmin, isSuperAdmin, currentUserId, onConfirm, onCancel, onDelete, onUploadProof }) {
  const [uploading, setUploading] = useState(false);
  const isAssigned = reservation.assigned_to === currentUserId;
  const canConfirm = isAdmin || isAssigned;
  const isPending = reservation.status === "pending";
  const isConfirmed = reservation.status === "confirmed";

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUploadProof(reservation.id, file);
    } finally {
      setUploading(false);
    }
  }

  const statusLabel = isPending ? "Pendiente" : isConfirmed ? "Confirmada" : "Cancelada";
  const statusClass = isPending ? "is-pending" : isConfirmed ? "is-paid" : "";

  return (
    <article className={classNames("reservation-card", isConfirmed && "is-confirmed")}>
      <div className="reservation-header">
        <div>
          <strong>{reservation.venue}</strong>
          <small>
            {new Date(reservation.reservation_date + "T12:00:00").toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" })}
            {reservation.reservation_time ? ` · ${reservation.reservation_time}` : ""}
          </small>
        </div>
        <span className={classNames("status-pill", statusClass)}>{statusLabel}</span>
      </div>

      <div className="reservation-details">
        <div className="reservation-assigned">
          <small>Responsable:</small>
          <div className="reservation-person">
            <Avatar profile={reservation.assigned_profile} size="sm" />
            <span>{displayName(reservation.assigned_profile)}</span>
          </div>
        </div>
        {reservation.notes && (
          <small className="reservation-notes">{reservation.notes}</small>
        )}
      </div>

      {reservation.proof_url && (
        <div className="reservation-proof">
          <a href={reservation.proof_url} target="_blank" rel="noopener">
            <img src={reservation.proof_url} alt="Comprobante de reserva" />
          </a>
        </div>
      )}

      <div className="button-row reservation-actions">
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
          <button
            className="danger-button"
            type="button"
            onClick={() => {
              if (confirm("¿Eliminar esta reserva?")) onDelete(reservation.id);
            }}
          >
            Eliminar
          </button>
        )}
        {isConfirmed && reservation.match_id && (
          <small className="muted">Partido creado ✓</small>
        )}
      </div>
    </article>
  );
}

export default function CourtReservationPage({ activeGroupId, profiles, venues, isAdmin, isSuperAdmin, currentUserId, onCreateMatch }) {
  const [reservations, setReservations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activeGroupId) return;
    setLoading(true);
    api.listReservations(activeGroupId)
      .then(setReservations)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeGroupId]);

  async function handleCreate(form) {
    setNotice(""); setError("");
    try {
      const res = await api.createReservation({
        ...form,
        group_id: activeGroupId,
        assigned_by: currentUserId,
      });
      setReservations((c) => [...c, res]);
      setShowForm(false);
    } catch (err) { setError(err.message); }
  }

  async function handleUploadProof(reservationId, file) {
    try {
      const url = await api.uploadReservationProof(reservationId, file);
      const updated = await api.updateReservation(reservationId, { proof_url: url });
      setReservations((c) => c.map((r) => r.id === reservationId ? { ...r, proof_url: url } : r));
    } catch (err) { setError(err.message); }
  }

  async function handleConfirm(reservation) {
    setError("");
    try {
      const match = await api.confirmReservation(
        reservation.id,
        activeGroupId,
        reservation.venue,
        reservation.reservation_date,
        reservation.reservation_time,
        `Partido en ${reservation.venue}`,
      );
      setReservations((c) => c.map((r) => r.id === reservation.id ? { ...r, status: "confirmed", match_id: match.id } : r));
      if (onCreateMatch) onCreateMatch(match);
    } catch (err) { setError(err.message); }
  }

  async function handleDelete(reservationId) {
    try {
      await api.deleteReservation(reservationId);
      setReservations((c) => c.filter((r) => r.id !== reservationId));
    } catch (err) { setError(err.message); }
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
            <small>Delegá la reserva de cancha a un jugador</small>
          </div>
          {isAdmin && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? "Cancelar" : "+ Nueva reserva"}
            </button>
          )}
        </div>
        {error && <p className="form-message">{error}</p>}
        {showForm && (
          <ReservationForm
            profiles={profiles}
            venues={venues}
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
          />
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
              profiles={profiles}
              isAdmin={isAdmin}
              isSuperAdmin={isSuperAdmin}
              currentUserId={currentUserId}
              onConfirm={handleConfirm}
              onDelete={handleDelete}
              onUploadProof={handleUploadProof}
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
              profiles={profiles}
              isAdmin={isAdmin}
              isSuperAdmin={isSuperAdmin}
              currentUserId={currentUserId}
              onConfirm={handleConfirm}
              onDelete={handleDelete}
              onUploadProof={handleUploadProof}
            />
          ))}
        </section>
      )}

      {reservations.length === 0 && !loading && (
        <section className="panel">
          <div className="empty-state compact">No hay reservas.</div>
        </section>
      )}
    </div>
  );
}
