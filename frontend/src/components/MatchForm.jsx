import { useState } from "react";
import CopyReservationTextButton from "./CopyReservationTextButton.jsx";
import { MATCH_STATUSES, emptyMatchForm } from "../constants.js";
import { canUseReservationAssistant } from "../reservationAssistant.js";
import { formatTag } from "../tags.js";
import { displayName, formatMoney, statusLabel } from "../utils.js";

function dateListToInput(dates = []) {
  return (dates || []).join(", ");
}

function inputToDateList(value) {
  return String(value || "")
    .split(",")
    .map((date) => date.trim())
    .filter(Boolean);
}

export default function MatchForm({
  initial,
  venues,
  profiles = [],
  groupTags = [],
  onCreateGroupTag,
  attendances = [],
  onCopied,
  onSave,
  onCancel,
}) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(
    initial
      ? {
          title: initial.title || "",
          match_date: initial.match_date || "",
          start_time: initial.start_time || "19:00",
          venue: initial.venue || "",
          venue_id: initial.venue_id || "",
          court_photo_url: initial.court_photo_url || "",
          allowed_tags: initial.allowed_tags || [],
          requires_reservation: Boolean(initial.requires_reservation),
          reservation_owner_user_id: initial.reservation_owner_user_id || "",
          reservation_notes: initial.reservation_notes || "",
          preferred_dates_input: dateListToInput(initial.preferred_dates),
          preferred_time_range: initial.preferred_time_range || "",
          reservation_status: initial.reservation_status || "none",
          court_cost: initial.court_cost ?? 0,
          min_players: initial.min_players ?? 10,
          max_players: initial.max_players ?? 18,
          status: initial.status || "upcoming",
        }
      : {
          ...emptyMatchForm,
          venue_id: "",
          court_photo_url: "",
          allowed_tags: [],
          requires_reservation: false,
          reservation_owner_user_id: "",
          reservation_notes: "",
          preferred_dates_input: "",
          preferred_time_range: "",
          reservation_status: "none",
          court_cost: 0,
        },
  );
  const [formError, setFormError] = useState("");
  const [newTag, setNewTag] = useState("");

  function updateForm(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function handleVenueChange(venueId) {
    const venue = venues.find((v) => v.id === venueId);
    updateForm({
      venue_id: venueId,
      venue: venue?.name || form.venue,
      court_cost: venue?.default_cost ?? form.court_cost,
      court_photo_url: venue?.photo_url || form.court_photo_url || "",
    });
  }

  function toggleTag(tag) {
    const current = new Set(form.allowed_tags || []);
    if (current.has(tag)) current.delete(tag);
    else current.add(tag);
    updateForm({ allowed_tags: [...current] });
  }

  async function addNewTag() {
    const tag = newTag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!tag) return;
    const savedTag = onCreateGroupTag ? await onCreateGroupTag(tag) : tag;
    if (savedTag) {
      setNewTag("");
      updateForm({ allowed_tags: [...new Set([...(form.allowed_tags || []), savedTag])] });
    }
  }

  async function submit(event) {
    event.preventDefault();
    setFormError("");
    if (!form.title.trim()) { setFormError("El nombre del partido es obligatorio."); return; }
    if (!form.match_date) { setFormError("La fecha es obligatoria."); return; }

    await onSave({
      title: form.title.trim(),
      match_date: form.match_date,
      start_time: form.start_time,
      venue: form.venue?.trim() || null,
      venue_id: form.venue_id || null,
      court_photo_url: form.court_photo_url || null,
      allowed_tags: form.allowed_tags || [],
      requires_reservation: Boolean(form.requires_reservation),
      reservation_owner_user_id: form.requires_reservation ? (form.reservation_owner_user_id || null) : null,
      reservation_notes: form.requires_reservation ? (form.reservation_notes?.trim() || null) : null,
      preferred_dates: form.requires_reservation ? inputToDateList(form.preferred_dates_input) : [],
      preferred_time_range: form.requires_reservation ? (form.preferred_time_range?.trim() || null) : null,
      reservation_status: form.requires_reservation
        ? (form.reservation_status === "none" ? "pending" : form.reservation_status)
        : "none",
      court_cost: Number(form.court_cost) || 0,
      min_players: Number(form.min_players) || 10,
      max_players: Number(form.max_players) || 18,
      status: form.status,
    });
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

      <div className="form-wide tag-selector">
        <div>
          <strong>Visible para</strong>
          <small>Sin tags = todo el grupo. Con tags = solo esos subgrupos pueden verlo y apuntarse.</small>
        </div>
        <div className="tag-picker-row">
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) toggleTag(e.target.value);
            }}
          >
            <option value="">Seleccionar tag recurrente</option>
            {groupTags.map((tag) => (
              <option key={tag} value={tag}>{formatTag(tag)}</option>
            ))}
          </select>
          <input
            placeholder="Crear tag"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
          />
          <button className="secondary-button" type="button" onClick={addNewTag}>
            Guardar tag
          </button>
        </div>
        {(form.allowed_tags || []).length > 0 ? (
          <div className="tag-chip-grid">
            {form.allowed_tags.map((tag) => (
              <button className="tag-chip is-active" key={tag} type="button" onClick={() => toggleTag(tag)}>
                {formatTag(tag)} ×
              </button>
            ))}
          </div>
        ) : <small className="muted">Público para todo el grupo.</small>}
      </div>

      {canUseReservationAssistant && (
        <div className="form-wide reservation-assistant-fields">
          <label className="toggle-row">
            <span>
              <strong>Este partido requiere reserva</strong>
              <small>Usá esto para coordinar cancha o hablar con administración.</small>
            </span>
            <input
              checked={form.requires_reservation}
              type="checkbox"
              onChange={(e) => updateForm({
                requires_reservation: e.target.checked,
                reservation_status: e.target.checked ? "pending" : "none",
              })}
            />
          </label>

          {form.requires_reservation && (
            <div className="reservation-assistant-grid">
              <label>
                Responsable
                <select
                  value={form.reservation_owner_user_id}
                  onChange={(e) => updateForm({ reservation_owner_user_id: e.target.value })}
                >
                  <option value="">Seleccionar responsable</option>
                  {profiles.filter((p) => p.membership_is_active).map((profile) => (
                    <option key={profile.id} value={profile.id}>{displayName(profile)}</option>
                  ))}
                </select>
              </label>
              <label>
                Fechas sugeridas
                <input
                  placeholder="2026-07-02, 2026-07-04"
                  value={form.preferred_dates_input}
                  onChange={(e) => updateForm({ preferred_dates_input: e.target.value })}
                />
              </label>
              <label>
                Horario sugerido
                <input
                  placeholder="7:00 pm - 9:00 pm"
                  value={form.preferred_time_range}
                  onChange={(e) => updateForm({ preferred_time_range: e.target.value })}
                />
              </label>
              <label>
                Estado
                <select
                  value={form.reservation_status}
                  onChange={(e) => updateForm({ reservation_status: e.target.value })}
                >
                  <option value="pending">Pendiente</option>
                  <option value="confirmed">Confirmada</option>
                  <option value="failed">Fallida</option>
                </select>
              </label>
              <label className="form-wide">
                Notas de reserva
                <textarea
                  placeholder="Ej. pedir cancha techada, confirmar parqueo, preguntar precio"
                  rows={3}
                  value={form.reservation_notes}
                  onChange={(e) => updateForm({ reservation_notes: e.target.value })}
                />
              </label>
              <CopyReservationTextButton
                match={{
                  ...form,
                  preferred_dates: inputToDateList(form.preferred_dates_input),
                }}
                attendances={attendances}
                profiles={profiles}
                onCopied={onCopied}
              />
            </div>
          )}
        </div>
      )}

      <button type="submit">{isEdit ? "Guardar cambios" : "Crear partido"}</button>
      {onCancel && (
        <button className="secondary-button" type="button" onClick={onCancel}>
          Cancelar
        </button>
      )}
    </form>
  );
}
