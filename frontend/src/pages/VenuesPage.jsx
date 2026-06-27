import { useEffect, useState } from "react";
import MapPicker from "../components/MapPicker.jsx";
import { formatMoney } from "../utils.js";

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
  const [photoPreview, setPhotoPreview] = useState(initial?.photo_url || "");
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
    <form className="form-grid" onSubmit={submit}>
      {error && <p className="form-message">{error}</p>}
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
      <label>
        Ubicación en el mapa
        <MapPicker lat={form.lat} lng={form.lng} onChange={handleMapChange} />
      </label>
      <label className="media-upload">
        Foto de la cancha
        {photoPreview ? (
          <img alt="Vista previa" src={photoPreview} />
        ) : (
          <span className="media-placeholder">Subí una foto</span>
        )}
        <input accept="image/*" type="file" onChange={handlePhoto} />
      </label>
      <label>
        Notas
        <input
          placeholder="Ej. Cancha techada, estacionamiento disponible"
          value={form.notes}
          onChange={(e) => update({ notes: e.target.value })}
        />
      </label>
      <button type="submit">{initial ? "Guardar cambios" : "Agregar cancha"}</button>
      {onCancel && (
        <button className="secondary-button" type="button" onClick={onCancel}>
          Cancelar
        </button>
      )}
    </form>
  );
}

function VenueMiniMap({ lat, lng }) {
  const mapRef = { current: null };
  const [mapInstance, setMapInstance] = useState(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance) return;
    const L = require("leaflet");
    const map = L.map(mapRef.current).setView([lat, lng], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OSM',
    }).addTo(map);
    L.marker([lat, lng]).addTo(map);
    setMapInstance(map);
    return () => map.remove();
  }, [lat, lng]);

  return <div ref={mapRef} className="venue-map-small" />;
}

export default function VenuesPage({ groupId, profileId, venues, onCreateVenue, onUpdateVenue }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  async function handleCreate(payload, photoFile) {
    await onCreateVenue({ ...payload, group_id: groupId, created_by: profileId }, photoFile);
    setShowForm(false);
  }

  async function handleUpdate(payload, photoFile) {
    await onUpdateVenue(editingId, payload, photoFile);
    setEditingId(null);
  }

  return (
    <div className="page-grid">
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
              {venue.photo_url && (
                <div className="venue-thumb">
                  <img alt={venue.name} src={venue.photo_url} />
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
              {editingId === venue.id ? (
                <VenueForm
                  initial={venue}
                  onSave={handleUpdate}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="button-row ledger-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setEditingId(venue.id)}
                  >
                    Editar
                  </button>
                </div>
              )}
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
