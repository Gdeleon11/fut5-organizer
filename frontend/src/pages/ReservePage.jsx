import { useState, useEffect } from "react";
import { api } from "../api.js";

export default function ReservePage({ token }) {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadingAll, setUploadingAll] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const rawTokens = (token || "").split(/[_,\+]/).filter(Boolean);
        if (rawTokens.length === 0) {
          setError("Link inválido.");
          setLoading(false);
          return;
        }

        const rows = await api.getPublicReservationsByTokens(rawTokens);
        if (!rows || rows.length === 0) {
          setError("Link inválido o reserva no encontrada.");
          setLoading(false);
          return;
        }

        const normalized = rows.map((r) => ({
          ...r,
          assigned_profile: r.assigned_display_name
            ? { full_name: r.assigned_display_name }
            : null,
        }));
        normalized.sort((a, b) => (a.reservation_date || "").localeCompare(b.reservation_date || ""));
        setReservations(normalized);
      } catch {
        setError("Link inválido o error al cargar reservas.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  async function handleUploadSingle(reservationId, file) {
    if (!file) return;
    setUploadingId(reservationId);
    setError("");
    try {
      const url = await api.uploadReservationProof(reservationId, file);
      await api.submitReservationProofByToken(reservationId, url);
      setReservations((prev) => {
        const next = prev.map((r) => r.id === reservationId ? { ...r, proof_url: url } : r);
        if (next.every((r) => r.proof_url)) setSuccess(true);
        return next;
      });
    } catch (err) {
      setError(err.message || "Error al subir comprobante.");
    } finally {
      setUploadingId(null);
    }
  }

  async function handleUploadAll(file) {
    if (!file || reservations.length === 0) return;
    setUploadingAll(true);
    setError("");
    try {
      const firstId = reservations[0].id;
      const url = await api.uploadReservationProof(firstId, file);

      // Update all pending reservations in list with the same proof URL
      for (const r of reservations) {
        if (!r.proof_url) {
          await api.submitReservationProofByToken(r.id, url);
        }
      }

      setReservations((prev) => prev.map((r) => ({ ...r, proof_url: r.proof_url || url })));
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Error al subir comprobante.");
    } finally {
      setUploadingAll(false);
    }
  }

  if (loading) {
    return <div className="auth-shell"><div className="empty-state compact">Cargando reservas...</div></div>;
  }

  if (error && reservations.length === 0) {
    return <div className="auth-shell"><div className="empty-state compact">{error}</div></div>;
  }

  const assignedName = reservations[0]?.assigned_profile?.full_name || "Responsable";
  const pendingCount = reservations.filter((r) => !r.proof_url).length;

  if (success) {
    return (
      <div className="auth-shell">
        <section className="panel auth-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">¡Listo!</p>
              <h1>Comprobante(s) enviado(s)</h1>
            </div>
          </div>
          <p className="muted">
            Gracias <strong>{assignedName}</strong>. Se registraron los comprobantes para tu(s) <strong>{reservations.length} reserva(s)</strong>.
            El administrador va a confirmar las reservas y crear los partidos.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <section className="panel auth-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Reserva(s) de cancha</p>
            <h1>{reservations.length > 1 ? `${reservations.length} Reservas asignadas` : reservations[0]?.venue}</h1>
          </div>
        </div>

        <p className="muted" style={{ marginBottom: "1rem" }}>
          Responsable: <strong>{assignedName}</strong>
        </p>

        {error && <p className="form-message" style={{ marginBottom: "1rem" }}>{error}</p>}

        {/* Global upload button if 2+ pending reservations */}
        {pendingCount > 1 && (
          <div className="form-grid" style={{ marginBottom: "1.5rem" }}>
            <label className="proof-upload-label" style={{ background: "rgba(16, 185, 129, 0.1)", borderColor: "rgba(16, 185, 129, 0.3)" }}>
              <span>
                {uploadingAll ? "Subiendo para todas..." : `Subir 1 comprobante único para las ${pendingCount} reservas`}
                <small>Si hiciste una sola transferencia para ambas reservas, subí el comprobante acá</small>
              </span>
              <input type="file" accept="image/*" onChange={(e) => handleUploadAll(e.target.files?.[0])} disabled={uploadingAll || Boolean(uploadingId)} />
            </label>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {reservations.map((r, index) => {
            const dateStr = r.reservation_date
              ? new Date(r.reservation_date + "T12:00:00").toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" })
              : "";

            return (
              <div key={r.id} className="reservation-row-block" style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "1rem", background: "rgba(0,0,0,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <strong>{reservations.length > 1 ? `#${index + 1} - ${r.venue}` : r.venue}</strong>
                  <span className={`status-pill ${r.proof_url ? "is-paid" : "is-pending"}`}>
                    {r.proof_url ? "Comprobante subido ✓" : "Pendiente"}
                  </span>
                </div>
                <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem" }}>
                  📅 {dateStr} {r.reservation_time ? ` · ⏰ ${r.reservation_time}` : ""}
                </p>
                {r.notes && <p className="muted" style={{ fontSize: "0.85rem", margin: "0 0 0.75rem 0" }}>{r.notes}</p>}

                {r.proof_url ? (
                  <div className="reservation-proof-uploaded" style={{ marginTop: "0.5rem" }}>
                    <a href={r.proof_url} target="_blank" rel="noopener noreferrer">
                      <img src={r.proof_url} alt="Comprobante" style={{ maxHeight: "120px", borderRadius: "4px" }} />
                    </a>
                  </div>
                ) : (
                  <label className="proof-upload-label" style={{ marginTop: "0.5rem" }}>
                    <span>
                      {uploadingId === r.id ? "Subiendo..." : `Subir comprobante para esta reserva`}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleUploadSingle(r.id, e.target.files?.[0])}
                      disabled={uploadingAll || Boolean(uploadingId)}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
