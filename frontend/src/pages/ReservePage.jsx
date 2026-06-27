import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient.js";
import { api } from "../api.js";

export default function ReservePage({ token }) {
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const hex = token;
        const reservationId = [
          hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16),
          hex.slice(16, 20), hex.slice(20),
        ].join("-");

        const { data, error } = await supabase
          .from("court_reservations")
          .select("id, venue, reservation_date, reservation_time, notes, status, proof_url, assigned_profile:profiles!assigned_to(full_name)")
          .eq("id", reservationId)
          .maybeSingle();

        if (error || !data) {
          setError("Link inválido o reserva no encontrada.");
        } else {
          setReservation(data);
        }
      } catch (err) {
        setError("Link inválido.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await api.uploadReservationProof(reservation.id, file);
      await api.updateReservation(reservation.id, { proof_url: url });
      setReservation((prev) => ({ ...prev, proof_url: url }));
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Error al subir comprobante.");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <div className="auth-shell"><div className="empty-state compact">Cargando...</div></div>;
  }

  if (error && !reservation) {
    return <div className="auth-shell"><div className="empty-state compact">{error}</div></div>;
  }

  if (success) {
    return (
      <div className="auth-shell">
        <section className="panel auth-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">¡Listo!</p>
              <h1>Comprobante enviado</h1>
            </div>
          </div>
          <p className="muted">
            Tu comprobante para <strong>{reservation?.venue}</strong> fue enviado.
            El administrador va a confirmar la reserva y crear el partido.
          </p>
        </section>
      </div>
    );
  }

  const assignedName = reservation?.assigned_profile?.full_name || "Responsable";

  return (
    <div className="auth-shell">
      <section className="panel auth-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Reserva de cancha</p>
            <h1>{reservation?.venue}</h1>
          </div>
        </div>

        <div className="reservation-info">
          <p>
            <strong>Fecha:</strong>{" "}
            {reservation?.reservation_date
              ? new Date(reservation.reservation_date + "T12:00:00").toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" })
              : ""}
            {reservation?.reservation_time ? ` · ${reservation.reservation_time}` : ""}
          </p>
          <p><strong>Responsable:</strong> {assignedName}</p>
          {reservation?.notes && <p><strong>Notas:</strong> {reservation.notes}</p>}
        </div>

        {reservation?.proof_url ? (
          <div className="reservation-proof-uploaded">
            <p className="muted">Comprobante ya enviado ✓</p>
            <a href={reservation.proof_url} target="_blank" rel="noopener">
              <img src={reservation.proof_url} alt="Comprobante" />
            </a>
          </div>
        ) : (
          <div className="form-grid">
            {error && <p className="form-message">{error}</p>}
            <label className="proof-upload-label">
              <span>
                {uploading ? "Subiendo..." : "Subí tu comprobante de reserva"}
                <small>Tomá una captura de pantalla de tu reserva y subila acá</small>
              </span>
              <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        )}
      </section>
    </div>
  );
}
