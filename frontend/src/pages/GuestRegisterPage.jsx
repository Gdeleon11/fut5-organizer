import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient.js";
import { api } from "../api.js";

export default function GuestRegisterPage({ token }) {
  const [match, setMatch] = useState(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const matchId = atob(token);
        const { data, error } = await supabase
          .from("matches")
          .select("id, title, match_date, start_time, venue")
          .eq("id", matchId)
          .maybeSingle();
        if (error || !data) {
          setError("Link inválido o partido no encontrado.");
        } else {
          setMatch(data);
        }
      } catch (err) {
        setError("Link inválido.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Poné tu nombre.");
      return;
    }
    try {
      await api.registerGuest(token, name.trim());
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Error al registrarse.");
    }
  }

  if (loading) {
    return (
      <div className="auth-shell">
        <div className="empty-state compact">Cargando...</div>
      </div>
    );
  }

  if (error && !match) {
    return (
      <div className="auth-shell">
        <div className="empty-state compact">{error}</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-shell">
        <section className="panel auth-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">¡Listo!</p>
              <h1>Te registraste</h1>
            </div>
          </div>
          <p className="muted">
            Ya estás anotado para <strong>{match?.title || "el partido"}</strong>.
            El organizador te va a asignar a un equipo.
          </p>
          <p className="muted">
            {match?.match_date
              ? `Fecha: ${new Date(match.match_date + "T12:00:00").toLocaleDateString("es-GT")}`
              : ""}
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
            <p className="eyebrow">Invitación</p>
            <h1>{match?.title || "Partido"}</h1>
          </div>
        </div>
        <p className="muted">
          {match?.match_date
            ? `${new Date(match.match_date + "T12:00:00").toLocaleDateString("es-GT")}`
            : ""}
          {match?.start_time ? ` · ${match.start_time}` : ""}
        </p>
        <form className="form-grid auth-form" onSubmit={handleSubmit}>
          {error && <p className="form-message">{error}</p>}
          <label>
            Tu nombre
            <input
              placeholder="Ej. Juan Pérez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>
          <button type="submit">Confirmar asistencia</button>
        </form>
      </section>
    </div>
  );
}
