import { useState, useEffect } from "react";
import { api } from "../api.js";
import { PubFilePicker, PubNotice, PubStatus, PublicShell } from "../components/public/PublicShell.jsx";

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
    return <PublicShell view="public-reserve" eyebrow="Reserva de cancha" title="Cargando…"><p className="pub-lede">Buscando tus reservas.</p></PublicShell>;
  }

  if (error && reservations.length === 0) {
    return (
      <PublicShell view="public-reserve" eyebrow="Reserva de cancha" title="Enlace no disponible">
        <PubNotice tone="error">{error}</PubNotice>
        <p className="pub-lede">Pedí un enlace nuevo a la administración del grupo.</p>
      </PublicShell>
    );
  }

  const assignedName = reservations[0]?.assigned_profile?.full_name || "Responsable";
  const pendingCount = reservations.filter((r) => !r.proof_url).length;

  if (success) {
    return (
      <PublicShell view="public-reserve" eyebrow="¡Listo!" title="Comprobante(s) enviado(s)">
        <PubNotice tone="success">
          Gracias <strong>{assignedName}</strong>. Se registraron los comprobantes para tu(s) <strong>{reservations.length} reserva(s)</strong>.
          El administrador va a confirmar las reservas y crear los partidos.
        </PubNotice>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      view="public-reserve"
      wide={reservations.length > 1}
      eyebrow="Reserva(s) de cancha"
      title={reservations.length > 1 ? `${reservations.length} reservas asignadas` : reservations[0]?.venue}
      lede={<>Responsable: <strong>{assignedName}</strong> · {pendingCount} pendiente(s) de comprobante</>}
    >
      {error && <PubNotice tone="error">{error}</PubNotice>}

      {/* Global upload if 2+ pending reservations */}
      {pendingCount > 1 && (
        <PubFilePicker
          label={`Subir 1 comprobante único para las ${pendingCount} reservas`}
          busy={uploadingAll ? "Subiendo para todas…" : null}
          hint="Si hiciste una sola transferencia para todas, subí el comprobante acá."
          onChange={(e) => handleUploadAll(e.target.files?.[0])}
          disabled={uploadingAll || Boolean(uploadingId)}
        />
      )}

      <ul className="pub-list">
        {reservations.map((r, index) => {
          const dateStr = r.reservation_date
            ? new Date(r.reservation_date + "T12:00:00").toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" })
            : "";
          return (
            <li key={r.id} className="pub-item">
              <div className="pub-item-head">
                <b>{reservations.length > 1 ? `#${index + 1} · ${r.venue}` : r.venue}</b>
                <PubStatus tone={r.proof_url ? "done" : "pending"}>{r.proof_url ? "Comprobante subido" : "Pendiente"}</PubStatus>
              </div>
              <p className="pub-item-meta">{dateStr}{r.reservation_time ? ` · ${r.reservation_time}` : ""}</p>
              {r.notes && <p className="pub-item-notes">{r.notes}</p>}
              {r.proof_url ? (
                <a className="pub-thumb" href={r.proof_url} target="_blank" rel="noopener noreferrer">
                  <img src={r.proof_url} alt={`Comprobante de ${r.venue}`} />
                </a>
              ) : (
                <PubFilePicker
                  label="Subir comprobante para esta reserva"
                  busy={uploadingId === r.id ? "Subiendo…" : null}
                  hint="Imagen de la transferencia o del recibo."
                  onChange={(e) => handleUploadSingle(r.id, e.target.files?.[0])}
                  disabled={uploadingAll || Boolean(uploadingId)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </PublicShell>
  );
}
