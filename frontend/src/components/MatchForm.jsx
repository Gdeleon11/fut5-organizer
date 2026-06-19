import { useEffect, useState } from "react";
import { MATCH_STATUSES, emptyMatchForm } from "../constants.js";
import { formatMoney, statusLabel } from "../utils.js";

export default function MatchForm({ initial, venues, onSave, onCancel }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(
    initial
      ? {
          title: initial.title || "",
          match_date: initial.match_date || "",
          start_time: initial.start_time || "19:00",
          venue: initial.venue || "",
          venue_id: initial.venue_id || "",
          court_cost: initial.court_cost ?? 0,
          min_players: initial.min_players ?? 10,
          max_players: initial.max_players ?? 18,
          status: initial.status || "upcoming",
        }
      : { ...emptyMatchForm, venue_id: "", court_cost: 0 },
  );
  const [courtPhotoFile, setCourtPhotoFile] = useState(null);
  const [courtPhotoPreview, setCourtPhotoPreview] = useState(
    initial?.court_photo_url || "",
  );
  const [formError, setFormError] = useState("");

  useEffect(() => {
    return () => {
      if (courtPhotoPreview.startsWith("blob:")) URL.revokeObjectURL(courtPhotoPreview);
    };
  }, [courtPhotoPreview]);

  function updateForm(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function handleVenueChange(venueId) {
    const venue = venues.find((v) => v.id === venueId);
    updateForm({
      venue_id: venueId,
      venue: venue?.name || form.venue,
      court_cost: venue?.default_cost ?? form.court_cost,
    });
  }

  function updateCourtPhoto(event) {
    const file = event.target.files?.[0] || null;
    setCourtPhotoFile(file);
    setCourtPhotoPreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : initial?.court_photo_url || "";
    });
  }

  async function submit(event) {
    event.preventDefault();
    setFormError("");
    if (!form.title.trim()) { setFormError("El nombre del partido es obligatorio."); return; }
    if (!form.match_date) { setFormError("La fecha es obligatoria."); return; }

    await onSave(
      {
        title: form.title.trim(),
        match_date: form.match_date,
        start_time: form.start_time,
        venue: form.venue?.trim() || null,
        venue_id: form.venue_id || null,
        court_cost: Number(form.court_cost) || 0,
        min_players: Number(form.min_players) || 10,
        max_players: Number(form.max_players) || 18,
        status: form.status,
      },
      courtPhotoFile,
    );
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      {formError && <p className="form-message">{formError}</p>}
      <label>
        Nombre
        <input value={form.title} onChange={(e) => updateForm({ title: e.target.value })} />
      </label>
      <label>
        Fecha
        <input type="date" value={form.match_date}
          onChange={(e) => updateForm({ match_date: e.target.value })} />
      </label>
      <label>
        Hora
        <input type="time" value={form.start_time}
          onChange={(e) => updateForm({ start_time: e.target.value })} />
      </label>

      {venues.length > 0 ? (
        <label>
          Cancha
          <select value={form.venue_id} onChange={(e) => handleVenueChange(e.target.value)}>
            <option value="">— Seleccionar cancha —</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}{v.default_cost > 0 ? ` (${formatMoney(v.default_cost)})` : " (gratis)"}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label>
          Cancha / sede
          <input value={form.venue || ""}
            onChange={(e) => updateForm({ venue: e.target.value })} />
        </label>
      )}

      <label>
        Costo de cancha (Q)
        <input min="0" step="1" type="number" value={form.court_cost}
          onChange={(e) => updateForm({ court_cost: e.target.value })} />
      </label>
      <label className="media-upload">
        Foto de la cancha
        {courtPhotoPreview ? (
          <img alt="Vista previa" src={courtPhotoPreview} />
        ) : (
          <span className="media-placeholder">Subí una foto de la cancha</span>
        )}
        <input accept="image/*" type="file" onChange={updateCourtPhoto} />
      </label>
      <label>
        Mínimo de jugadores
        <input max="18" min="6" type="number" value={form.min_players}
          onChange={(e) => updateForm({ min_players: Number(e.target.value) })} />
      </label>
      <label>
        Máximo de jugadores
        <input max="22" min="6" type="number" value={form.max_players}
          onChange={(e) => updateForm({ max_players: Number(e.target.value) })} />
      </label>
      <label>
        Estado
        <select value={form.status} onChange={(e) => updateForm({ status: e.target.value })}>
          {MATCH_STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>
      </label>

      <button type="submit">{isEdit ? "Guardar cambios" : "Crear partido"}</button>
      {onCancel && (
        <button className="secondary-button" type="button" onClick={onCancel}>
          Cancelar
        </button>
      )}
    </form>
  );
}
