import { useEffect, useState } from "react";
import MapPicker from "../components/MapPicker.jsx";
import { cleanImageUrl, copyToClipboard, formatMoney } from "../utils.js";

function VenueForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    address: initial?.address || "",
    default_cost: initial?.default_cost ?? 0,
    notes: initial?.notes || "",
    lat: initial?.lat || null,
    lng: initial?.lng || null,
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(cleanImageUrl(initial?.photo_url));
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (photoPreview.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function handlePhoto(e) {
    const file = e.target.files?.[0] || null;
    setPhotoFile(file);
    setPhotoPreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : initial?.photo_url || "";
    });
  }

  function handleMapChange(lat, lng) {
    update({ lat, lng });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("El nombre de la cancha es obligatorio.");
      return;
    }
    await onSave(
      {
        name: form.name.trim(),
        address: form.address.trim() || null,
        default_cost: Number(form.default_cost) || 0,
        notes: form.notes.trim() || null,
        lat: form.lat,
        lng: form.lng,
      },
      photoFile,
    );
  }

  return (
    <form className="venue-form" onSubmit={submit}>
      {error && <p className="form-message">{error}</p>}

      <div className="venue-form-grid">
        <label>
          Nombre de la cancha
          <input value={form.name} onChange={(e) => update({ name: e.target.value })} />
        </label>
        <label>
          Dirección
          <input
            placeholder="Opcional"
            value={form.address}
            onChange={(e) => update({ address: e.target.value })}
          />
        </label>
        <label>
          Costo típico (Q)
          <input
            min="0"
            step="1"
            type="number"
            value={form.default_cost}
            onChange={(e) => update({ default_cost: e.target.value })}
          />
        </label>
        <label className="venue-form-wide">
          Notas
          <input
            placeholder="Ej. Cancha techada"
            value={form.notes}
            onChange={(e) => update({ notes: e.target.value })}
          />
        </label>
      </div>

      <label className="venue-form-wide">
        Ubicación en el mapa
        <MapPicker lat={form.lat} lng={form.lng} onChange={handleMapChange} height="220px" />
      </label>

      <label className="media-upload venue-photo-upload">
        Foto de la cancha
        {photoPreview ? (
          <img
            alt="Vista previa"
            src={photoPreview}
            onError={() => setPhotoPreview("")}
          />
        ) : (
          <span className="media-placeholder">Subí una foto</span>
        )}
        <input accept="image/*" type="file" onChange={handlePhoto} />
      </label>

      <div className="button-row">
        <button type="submit">{initial ? "Guardar cambios" : "Agregar cancha"}</button>
        {onCancel && (
          <button className="secondary-button" type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

export default function VenuesPage({ groupId, profileId, venues, matches = [], onCreateVenue, onUpdateVenue }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  async function handleCreate(payload, photoFile) {
    await onCreateVenue({ ...payload, group_id: groupId, created_by: profileId }, photoFile);
    setShowForm(false);
  }

  async function handleUpdate(payload, photoFile) {
    await onUpdateVenue(editingId, payload, photoFile);
    setEditingId(null);
  }

  function mapUrl(venue) {
    if (venue.lat && venue.lng) return `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([venue.name, venue.address].filter(Boolean).join(" "))}`;
  }

  async function copyVenue(venue) {
    const text = [
      "CANCHA F5MANAGER",
      "",
      venue.name,
      venue.address ? `Dirección: ${venue.address}` : "",
      Number(venue.default_cost || 0) > 0 ? `Costo típico: ${formatMoney(venue.default_cost)}` : "",
      venue.notes ? `Notas: ${venue.notes}` : "",
      `Mapa: ${mapUrl(venue)}`,
    ].filter(Boolean).join("\n");
    await copyToClipboard(text);
    setCopiedId(venue.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  }

  function venueHistory(venue) {
    const usedMatches = (matches || []).filter((match) =>
      match && (match.venue_id === venue.id || match.venue === venue.name)
    );
    const totalCost = usedMatches.reduce((sum, match) => sum + Number(match.court_cost || 0), 0);
    const withCost = usedMatches.filter((match) => Number(match.court_cost || 0) > 0);
    const latest = [...usedMatches]
      .filter((match) => match.match_date)
      .sort((a, b) => b.match_date.localeCompare(a.match_date))[0];
    return {
      count: usedMatches.length,
      totalCost,
      averageCost: withCost.length ? totalCost / withCost.length : Number(venue.default_cost || 0),
      latestDate: latest?.match_date || null,
    };
  }

  return (
    <div className="page-grid venues-page">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Infraestructura</p>
            <h2>Catálogo de canchas</h2>
          </div>
          <span className="count-pill">{venues.length}</span>
        </div>

        {venues.length === 0 && !showForm && (
          <div className="empty-state compact">
            Agregá las canchas donde juegan para reutilizarlas en cada partido.
          </div>
        )}

        <div className="list">
          {venues.map((venue) => (
            <article className="ledger-row" key={venue.id}>
              {(() => {
                const history = venueHistory(venue);
                return (
                  <>
              {venue.photo_url && (
                <div className="venue-thumb">
                  <img
                    alt={venue.name}
                    src={cleanImageUrl(venue.photo_url)}
                    onError={(event) => {
                      event.currentTarget.closest(".venue-thumb")?.remove();
                    }}
                  />
                </div>
              )}
              <div>
                <strong>{venue.name}</strong>
                {venue.address && <small>{venue.address}</small>}
                {venue.notes && <small className="muted">{venue.notes}</small>}
                {venue.lat && venue.lng && (
                  <small className="muted">📍 {venue.lat.toFixed(4)}, {venue.lng.toFixed(4)}</small>
                )}
              </div>
              <div className="ledger-meta">
                <span className="count-pill">
                  {venue.default_cost > 0
                    ? formatMoney(venue.default_cost)
                    : "Gratis"}
                </span>
              </div>
              <div className="venue-history">
                <span><small>Usos</small><strong>{history.count}</strong></span>
                <span><small>Total</small><strong>{formatMoney(history.totalCost)}</strong></span>
                <span><small>Promedio</small><strong>{formatMoney(history.averageCost)}</strong></span>
                <span><small>Última</small><strong>{history.latestDate ? new Date(history.latestDate + "T12:00:00").toLocaleDateString("es-GT") : "-"}</strong></span>
              </div>
              {editingId === venue.id ? (
                <VenueForm
                  initial={venue}
                  onSave={handleUpdate}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="button-row ledger-actions">
                  <a className="share-link" href={mapUrl(venue)} target="_blank" rel="noreferrer">
                    Mapa
                  </a>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => copyVenue(venue)}
                  >
                    {copiedId === venue.id ? "Copiado" : "Copiar datos"}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setEditingId(venue.id)}
                  >
                    Editar
                  </button>
                </div>
              )}
                  </>
                );
              })()}
            </article>
          ))}
        </div>

        {showForm ? (
          <VenueForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
        ) : (
          <button type="button" onClick={() => setShowForm(true)}>
            + Agregar cancha
          </button>
        )}
      </section>
    </div>
  );
}
