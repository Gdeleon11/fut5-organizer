import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, Clock, Play, Pause, Trash2, Check, ChevronRight } from "lucide-react";
import { api } from "../../api.js";
import { Button } from "../ui/Button.jsx";
import { SectionHeader } from "../ui/SectionHeader.jsx";
import { Card } from "../ui/Card.jsx";

/** Día de la semana: clave (0=Dom ... 6=Sáb) → etiqueta corta para la UI. */
const WEEKDAYS = [
  { key: 0, label: "Domingo" },
  { key: 1, label: "Lunes" },
  { key: 2, label: "Martes" },
  { key: 3, label: "Miércoles" },
  { key: 4, label: "Jueves" },
  { key: 5, label: "Viernes" },
  { key: 6, label: "Sábado" },
];

export default function RecurringConfig({ groupId, isAdmin = false, onNotice }) {
  const [recurrences, setRecurrences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  /* Formulario de nueva recurrencia */
  const [form, setForm] = useState({
    title: "Chamuscón semanal",
    dayOfWeek: new Date().getDay(),
    matchTime: "19:00",
    venue: "",
    minPlayers: 10,
    maxPlayers: 18,
    isActive: true,
  });
  const [creating, setCreating] = useState(false);

  const setNoticeText = (text, kind = "success") => {
    setNotice(text);
    setError(kind === "error" ? text : "");
    if (kind === "success") setError("");
  };

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const rows = await api.listRecurringMatches(groupId);
      setRecurrences(rows || []);
    } catch (err) {
      setError(err?.message || "No se pudieron cargar las recurrencias.");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const handleToggleActive = async (rec) => {
    if (!isAdmin) return;
    setBusyId(rec.id);
    try {
      await api.updateRecurringMatch(rec.id, { is_active: !rec.is_active });
      setNoticeText(rec.is_active ? "Recurrencia pausada." : "Recurrencia activada.");
      await load();
    } catch (err) {
      setError(err?.message || "No se pudo cambiar el estado de la recurrencia.");
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (rec) => {
    if (!isAdmin || !window.confirm(`¿Cancelar la recurrencia «${rec.title}»? Los partidos ya generados se mantienen.`)) return;
    setBusyId(rec.id);
    try {
      await api.deleteRecurringMatch(rec.id);
      setNoticeText("Recurrencia cancelada.");
      await load();
    } catch (err) {
      setError(err?.message || "No se pudo cancelar la recurrencia.");
    } finally {
      setBusyId(null);
    }
  };

  const handleGenerateNow = async () => {
    if (!isAdmin || !groupId) return;
    setBusyId("generate");
    try {
      const result = await api.generateUpcomingRecurringMatches(groupId, 4);
      setNoticeText(`Se prepararon ${result.generated} partido${result.generated !== 1 ? "s" : ""} nuevo${result.generated !== 1 ? "s" : ""}${result.skipped > 0 ? ` (${result.skipped} ya existían)` : ""}.`);
      await load();
    } catch (err) {
      setError(err?.message || "No se pudieron generar los próximos partidos.");
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isAdmin || !groupId) return;
    if (!form.title.trim()) { setError("Poné un nombre a la recurrencia."); return; }
    setCreating(true); setError("");
    try {
      await api.createRecurringMatch({
        group_id: groupId,
        title: form.title.trim(),
        venue: form.venue.trim() || null,
        match_time: form.matchTime,
        day_of_week: Number(form.dayOfWeek),
        min_players: Number(form.minPlayers) || 10,
        max_players: Number(form.maxPlayers) || 18,
        is_active: Boolean(form.isActive),
      });
      setNoticeText("Recurrencia creada. Los próximos partidos (4 semanas) se preparan al abrir el grupo o al tocar «Generar próximos partidos ahora».");
      setForm({ title: "Chamuscón semanal", dayOfWeek: new Date().getDay(), matchTime: "19:00", venue: "", minPlayers: 10, maxPlayers: 18, isActive: true });
      await load();
    } catch (err) {
      setError(err?.message || "No se pudo crear la recurrencia.");
    } finally {
      setCreating(false);
    }
  };

  const weekdayOf = (key) => WEEKDAYS.find((w) => w.key === key)?.label || "";

  return (
    <section className="recurring-config" aria-label="Partidos recurrentes">
      <SectionHeader title="Partidos recurrentes" subtitle="Configurá tu chamusca semanal una sola vez (horizonte de 4 semanas)." />
      {error && <div className="alert error" role="alert">{error}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}

      {isAdmin && (
        <>
          <Card className="recurring-form-card">
            <SectionHeader title="Nueva recurrencia" subtitle="Los próximos encuentros se preparan cuando un administrador abre el grupo o toca «Generar ahora»." />
            <form className="recurring-form" onSubmit={handleCreate}>
              <div className="recurring-form-grid">
                <div className="rf-field">
                  <label>Nombre</label>
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="rf-field">
                  <label>Día de juego</label>
                  <select value={String(form.dayOfWeek)} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}>
                    {WEEKDAYS.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
                  </select>
                </div>
                <div className="rf-field">
                  <label>Hora</label>
                  <input type="time" value={form.matchTime} onChange={(e) => setForm({ ...form, matchTime: e.target.value })} />
                </div>
                <div className="rf-field">
                  <label>Cancha (opcional)</label>
                  <input type="text" placeholder="Ej. Cancha Futeca" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
                </div>
                <div className="rf-field">
                  <label>Mínimo de jugadores</label>
                  <input type="number" min="1" value={form.minPlayers} onChange={(e) => setForm({ ...form, minPlayers: Number(e.target.value) || 10 })} />
                </div>
                <div className="rf-field">
                  <label>Máximo de jugadores</label>
                  <input type="number" min="1" value={form.maxPlayers} onChange={(e) => setForm({ ...form, maxPlayers: Number(e.target.value) || 18 })} />
                </div>
              </div>
              <div className="rf-actions">
                <Button variant="primary" loading={creating} disabled={creating} type="submit">
                  <Calendar size={16} aria-hidden="true" /> Crear recurrencia
                </Button>
                <Button variant="ghost" loading={busyId === "generate"} disabled={busyId === "generate"} onClick={handleGenerateNow}>
                  <Play size={16} aria-hidden="true" /> Generar próximos partidos ahora
                </Button>
              </div>
            </form>
          </Card>

          <Card className="recurring-list-card">
            <SectionHeader title="Tus recurrencias" subtitle="Activá, pausá o cancelá una serie. Los partidos ya creados no se borran al cancelar la recurrencia." />
            {loading ? (
              <p className="muted">Cargando recurrencias…</p>
            ) : recurrences.length === 0 ? (
              <p className="muted">No hay partidos recurrentes configurados para este grupo.</p>
            ) : (
              <ul className="recurring-list">
                {recurrences.map((r) => (
                  <li key={r.id} className={`recurring-item ${!r.is_active ? "is-paused" : ""}`}>
                    <div className="recurring-main">
                      <div className="recurring-info">
                        <strong>{r.title}</strong>
                        <span className="recurring-meta">
                          {weekdayOf(r.day_of_week)} · {r.match_time}
                          {r.venue ? ` · ${r.venue}` : ""}
                          {r.min_players || r.max_players ? ` · ${r.min_players || 1}-${r.max_players || 18} jugadores` : ""}
                        </span>
                        <span className={`recurring-badge ${r.is_active ? "badge-active" : "badge-paused"}`}>
                          {r.is_active ? (
                            <>
                              <Play size={12} aria-hidden="true" /> Activa
                            </>
                          ) : (
                            <>
                              <Pause size={12} aria-hidden="true" /> Pausada
                            </>
                          )}
                        </span>
                      </div>
                      <div className="recurring-actions">
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={busyId === r.id}
                          disabled={busyId === r.id}
                          onClick={() => handleToggleActive(r)}
                        >
                          {r.is_active ? "Pausar" : "Activar"}
                        </Button>
                        <Button variant="danger" size="sm" loading={busyId === r.id} disabled={busyId === r.id} onClick={() => handleCancel(r)}>
                          <Trash2 size={14} aria-hidden="true" /> Cancelar
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted recurring-foot">
              <ChevronRight size={12} aria-hidden="true" /> Cada partido generado es independiente: podés editarlo o cancelarlo sin tocar el resto de la serie.
              Los jugadores confirman su asistencia normalmente (sin confirmación automática). Los recordatorios push/WhatsApp automáticos aún no están activos en esta versión.
            </p>
          </Card>
        </>
      )}

      {!isAdmin && groupId && (
        <div className="recurring-hint">
          <Calendar size={16} aria-hidden="true" /> Solo los administradores del grupo configuran partidos recurrentes.
        </div>
      )}
    </section>
  );
}
