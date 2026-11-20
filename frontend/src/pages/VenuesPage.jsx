import { useEffect, useState } from "react";
import { Copy, MapPin, Pencil, PlusCircle } from "lucide-react";
import MapPicker from "../components/MapPicker.jsx";
import { Empty, Section } from "../components/finance/FinanceBlocks.jsx";
import { venueHistory, venueMapUrl, venueShareText } from "../finance/financeModel.js";
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

  useEffect(() => () => { if (photoPreview.startsWith("blob:")) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  function handlePhoto(e) {
    const file = e.target.files?.[0] || null;
    setPhotoFile(file);
    setPhotoPreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : initial?.photo_url || "";
    });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("El nombre de la cancha es obligatorio."); return; }
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
    <form className="form-grid md-form fx-form fx-venue-form" onSubmit={submit} aria-label={initial ? "Editar cancha" : "Agregar cancha"}>
      {error && <p className="form-message" role="alert">{error}</p>}
      <label>
        Nombre de la cancha
        <input value={form.name} onChange={(e) => update({ name: e.target.value })} />
      </label>
      <label>
        Costo típico (Q)
        <input min="0" step="1" type="number" inputMode="numeric" value={form.default_cost} onChange={(e) => update({ default_cost: e.target.value })} />
      </label>
      <label className="md-form-wide">
        Dirección
        <input placeholder="Opcional" value={form.address} onChange={(e) => update({ address: e.target.value })} />
      </label>
      <label className="md-form-wide">
        Notas
        <input placeholder="Ej. Cancha techada" value={form.notes} onChange={(e) => update({ notes: e.target.value })} />
      </label>
      <div className="md-form-wide fx-map-field">
        <span className="fx-label">Ubicación en el mapa</span>
        <MapPicker lat={form.lat} lng={form.lng} onChange={(lat, lng) => update({ lat, lng })} height="220px" />
      </div>
      <label className="md-form-wide fx-photo-field">
        Foto de la cancha
        {photoPreview
          ? <img alt="Vista previa" src={photoPreview} onError={() => setPhotoPreview("")} />
          : <span className="fx-photo-ph">Subí una foto</span>}
        <input accept="image/*" type="file" onChange={handlePhoto} />
      </label>
      <div className="md-form-actions">
        {onCancel && <button className="md-btn md-btn-ghost" type="button" onClick={onCancel}>Cancelar</button>}
        <button className="md-btn md-btn-accent" type="submit">{initial ? "Guardar cambios" : "Agregar cancha"}</button>
      </div>
    </form>
  );
}

function VenueStats({ history }) {
  return (
    <dl className="fx-venue-stats">
      <div><dt>Usos</dt><dd>{history.count}</dd></div>
      <div><dt>Total</dt><dd>{formatMoney(history.totalCost)}</dd></div>
      <div><dt>Promedio</dt><dd>{formatMoney(history.averageCost)}</dd></div>
      <div><dt>Última</dt><dd>{history.latestDate ? new Date(history.latestDate + "T12:00:00").toLocaleDateString("es-GT") : "—"}</dd></div>
    </dl>
  );
}

export default function VenuesPage({ variant = "editorial", groupId, profileId, venues, matches = [], onCreateVenue, onUpdateVenue, isAdmin }) {
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

  async function copyVenue(venue) {
    await copyToClipboard(venueShareText(venue));
    setCopiedId(venue.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  }

  return (
    <Section
      title="Catálogo de canchas"
      icon={MapPin}
      className={`fx-venues is-${variant}`}
      aside={<>
        <span className="fx-count">{venues.length} sedes</span>
        {isAdmin && !showForm && <button className="md-btn md-btn-accent" type="button" onClick={() => setShowForm(true)}><PlusCircle size={15} aria-hidden="true" /> Agregar cancha</button>}
      </>}
    >
      {isAdmin && showForm && <VenueForm onSave={handleCreate} onCancel={() => setShowForm(false)} />}
      {venues.length === 0 && !showForm && <Empty>Agregá las canchas donde juegan para reutilizarlas en cada partido.</Empty>}

      <ul className={`fx-venue-list is-${variant}`}>
        {venues.map((venue) => {
          const history = venueHistory(venue, matches);
          const photo = cleanImageUrl(venue.photo_url);
          const editing = editingId === venue.id;
          return (
            <li key={venue.id} className={`fx-venue ${editing ? "is-editing" : ""}`}>
              {photo && (
                <div className="fx-venue-photo">
                  <img alt={venue.name} src={photo} loading="lazy" onError={(e) => e.currentTarget.closest(".fx-venue-photo")?.remove()} />
                </div>
              )}
              <div className="fx-venue-body">
                <div className="fx-venue-head">
                  <h3>{venue.name}</h3>
                  <span className="fx-venue-cost">{venue.default_cost > 0 ? formatMoney(venue.default_cost) : "Gratis"}</span>
                </div>
                {venue.address && <p className="fx-venue-addr">{venue.address}</p>}
                {venue.notes && <p className="fx-venue-notes">{venue.notes}</p>}
                {venue.lat && venue.lng && <small className="fx-venue-geo"><MapPin size={12} aria-hidden="true" /> {venue.lat.toFixed(4)}, {venue.lng.toFixed(4)}</small>}
                <VenueStats history={history} />
                {editing ? (
                  <VenueForm initial={venue} onSave={handleUpdate} onCancel={() => setEditingId(null)} />
                ) : (
                  <div className="fx-venue-actions">
                    <a className="md-btn md-btn-ghost" href={venueMapUrl(venue)} target="_blank" rel="noreferrer"><MapPin size={15} aria-hidden="true" /> Mapa</a>
                    <button className="md-btn md-btn-ghost" type="button" onClick={() => copyVenue(venue)}><Copy size={15} aria-hidden="true" /> {copiedId === venue.id ? "Copiado" : "Copiar datos"}</button>
                    {isAdmin && <button className="md-btn md-btn-ghost" type="button" onClick={() => setEditingId(venue.id)}><Pencil size={15} aria-hidden="true" /> Editar</button>}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
