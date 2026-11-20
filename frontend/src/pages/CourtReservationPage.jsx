import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Copy, LayoutGrid, List, MapPin, MessageCircle, PlusCircle, RefreshCw, Trash2, Upload, X } from "lucide-react";
import Avatar from "../components/Avatar.jsx";
import CopyReservationTextButton from "../components/CopyReservationTextButton.jsx";
import { Empty, Kpis, Section, Segmented, StatusChip } from "../components/finance/FinanceBlocks.jsx";
import { useAppearance } from "../appearance/AppearanceProvider.jsx";
import { api } from "../api.js";
import { activeReservationStatus, reservationStatusLabel } from "../reservationAssistant.js";
import {
  assistedReservationsFor,
  groupReservationsByDate,
  monthCalendar,
  reservationDateLabel,
  reservationToken,
  reservationWhatsappText,
  splitReservations,
  visibleLimit,
} from "../finance/financeModel.js";
import { appOrigin, classNames, copyToClipboard, displayName } from "../utils.js";
import { collectGroupTags } from "../tags.js";
import VenuesPage from "./VenuesPage.jsx";

const RES_TONE = { pending: "pending", confirmed: "paid", failed: "rejected", none: "forgiven" };
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function WhatsAppLink({ href, compact }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="md-btn fx-wa" title="Enviar por WhatsApp">
      <MessageCircle size={15} aria-hidden="true" />{compact ? <span className="sr-only">WhatsApp</span> : "WhatsApp"}
    </a>
  );
}

function ReservationRow({ index, venues, profiles, groupTags = [], onChange, onRemove }) {
  const [form, setForm] = useState({
    venue: "",
    reservation_date: "",
    reservation_time: "19:00",
    assigned_to: "",
    notes: "",
    allowed_tags: [],
  });
  const [selectedTags, setSelectedTags] = useState([]);

  function update(patch) {
    const next = { ...form, ...patch };
    setForm(next);
    onChange(index, next);
  }

  return (
    <fieldset className="md-form-group rv-row">
      <legend>
        Reserva {index + 1}
        {index > 0 && (
          <button className="md-icon-btn" type="button" aria-label={`Quitar reserva ${index + 1}`} onClick={() => onRemove(index)}><X size={16} aria-hidden="true" /></button>
        )}
      </legend>
      <label>
        Cancha
        {venues.length > 0 ? (
          <select value={form.venue} onChange={(e) => update({ venue: e.target.value })}>
            <option value="">Seleccionar</option>
            {venues.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
          </select>
        ) : (
          <input placeholder="Nombre de la cancha" value={form.venue} onChange={(e) => update({ venue: e.target.value })} />
        )}
      </label>
      <label>
        Fecha
        <input type="date" value={form.reservation_date} onChange={(e) => update({ reservation_date: e.target.value })} />
      </label>
      <label>
        Hora
        <input type="time" value={form.reservation_time} onChange={(e) => update({ reservation_time: e.target.value })} />
      </label>
      <label>
        Responsable
        <select value={form.assigned_to} onChange={(e) => update({ assigned_to: e.target.value })}>
          <option value="">Seleccionar jugador</option>
          {profiles.filter((p) => p.membership_is_active !== false).map((p) => (
            <option key={p.id} value={p.id}>{displayName(p)}</option>
          ))}
        </select>
      </label>
      <label className="rv-wide">
        Notas (opcional)
        <input placeholder="Ej. Reservar cancha 2" value={form.notes} onChange={(e) => update({ notes: e.target.value })} />
      </label>
      <div className="rv-wide rv-tags">
        <span className="fx-label">Restringir acceso por tags (opcional)</span>
        <div className="rv-tag-list">
          {groupTags.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  const next = isSelected ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag];
                  setSelectedTags(next);
                  update({ allowed_tags: next });
                }}
                className={`rv-tag ${isSelected ? "is-on" : ""}`}
              >
                #{tag}
              </button>
            );
          })}
        </div>
        {selectedTags.length === 0 && <small>Público para todo el grupo.</small>}
      </div>
    </fieldset>
  );
}

function ReservationCard({ reservation, variant, isAdmin, isSuperAdmin, currentUserId, onConfirm, onDelete, onUploadProof, onCopyLink, copiedId, isNewlyCreated }) {
  const [uploading, setUploading] = useState(false);
  const isAssigned = reservation.assigned_to === currentUserId;
  const canConfirm = isAdmin || isAssigned;
  const isPending = reservation.status === "pending";

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { await onUploadProof(reservation.id, file); } finally { setUploading(false); }
  }

  const dateStr = reservationDateLabel(reservation.reservation_date);
  const stage = !isPending ? "confirmed" : reservation.proof_url ? "proof" : "waiting";
  const stageLabel = { waiting: "Esperando comprobante", proof: "Comprobante listo", confirmed: "Partido creado" }[stage];

  return (
    <article className={classNames("rv-card", `is-${variant}`, `is-${stage}`, isNewlyCreated && "is-new")} aria-label={`Reserva ${reservation.venue} ${dateStr}`}>
      <header className="rv-card-head">
        <time className="rv-date" dateTime={reservation.reservation_date || undefined}>
          <b>{reservation.reservation_date ? new Date(reservation.reservation_date + "T12:00:00").getDate() : "—"}</b>
          <small>{reservation.reservation_date ? new Date(reservation.reservation_date + "T12:00:00").toLocaleDateString("es-GT", { month: "short" }) : ""}</small>
        </time>
        <div className="rv-card-title">
          <h3>{reservation.venue}</h3>
          <small>{dateStr}{reservation.reservation_time ? ` · ${reservation.reservation_time}` : ""}</small>
        </div>
        <span className="rv-card-status">
          {isNewlyCreated && <StatusChip tone="accent">¡Nueva!</StatusChip>}
          <StatusChip tone={isPending ? "pending" : "paid"}>{isPending ? "Pendiente" : "Confirmada"}</StatusChip>
        </span>
      </header>

      <ol className="rv-steps" aria-label={`Estado: ${stageLabel}`}>
        <li className="is-done">Asignada</li>
        <li className={stage !== "waiting" ? "is-done" : "is-now"}>Comprobante</li>
        <li className={stage === "confirmed" ? "is-done" : stage === "proof" ? "is-now" : ""}>Confirmada</li>
      </ol>

      <div className="rv-person">
        <Avatar profile={reservation.assigned_profile} size="sm" />
        <span><small>Responsable</small><b>{displayName(reservation.assigned_profile)}</b></span>
      </div>
      {reservation.notes && <p className="rv-notes">{reservation.notes}</p>}

      {reservation.proof_url && (
        <a className="rv-proof" href={reservation.proof_url} target="_blank" rel="noopener">
          <img src={reservation.proof_url} alt="Comprobante de la reserva" />
        </a>
      )}

      <div className="rv-actions">
        {isPending && (
          <>
            <WhatsAppLink href={`https://wa.me/?text=${encodeURIComponent(reservationWhatsappText(reservation, appOrigin(), dateStr))}`} />
            <button className="md-btn md-btn-ghost" type="button" onClick={() => onCopyLink(reservation.id)}>
              <Copy size={15} aria-hidden="true" />{copiedId === reservation.id ? "Copiado ✓" : "Copiar link"}
            </button>
          </>
        )}
        {isPending && canConfirm && (
          <>
            {!reservation.proof_url && (
              <label className="md-btn md-btn-ghost rv-upload">
                <Upload size={15} aria-hidden="true" />{uploading ? "Subiendo…" : "Subir comprobante"}
                <input type="file" accept="image/*" onChange={handleUpload} />
              </label>
            )}
            <button
              className="md-btn md-btn-accent"
              type="button"
              onClick={() => onConfirm(reservation)}
              disabled={!reservation.proof_url}
              title={!reservation.proof_url ? "Subí el comprobante primero" : ""}
            >
              Confirmar y crear partido
            </button>
          </>
        )}
        {isPending && isSuperAdmin && (
          <button className="md-btn md-btn-ghost fx-danger-text" type="button" onClick={() => { if (confirm("¿Eliminar?")) onDelete(reservation.id); }}>
            <Trash2 size={15} aria-hidden="true" />Eliminar
          </button>
        )}
        {!isPending && reservation.match_id && <small className="rv-done">Partido creado ✓</small>}
      </div>
    </article>
  );
}

function AssistedStatusSelect({ status, onChange, compact }) {
  return (
    <select className={compact ? "rv-select is-compact" : "rv-select"} aria-label="Cambiar estado de la reserva" value={status} onChange={(e) => onChange(e.target.value)}>
      <option value="pending">Pendiente</option>
      <option value="confirmed">Confirmada</option>
      <option value="failed">Fallida</option>
    </select>
  );
}

function AssistedReservationCard({ match, profiles, attendances, canEdit, onUpdateMatch, onNotice, variant }) {
  const status = activeReservationStatus(match);
  const owner = profiles.find((profile) => profile.id === match.reservation_owner_user_id);

  async function updateStatus(nextStatus) {
    await onUpdateMatch(match.id, { reservation_status: nextStatus, requires_reservation: true });
  }

  return (
    <article className={classNames("rv-card rv-assisted", `is-${variant}`, status === "confirmed" && "is-confirmed")} aria-label={`Reserva asistida ${match.title || "Chamuscón"}`}>
      <header className="rv-card-head">
        <span className="rv-badge"><ClipboardList size={18} aria-hidden="true" /></span>
        <div className="rv-card-title">
          <h3>{match.title || "Chamuscón"}</h3>
          <small>{match.venue || "Cancha pendiente"} · {match.preferred_time_range || match.start_time || "Horario pendiente"}</small>
        </div>
        <StatusChip tone={RES_TONE[status]}>{reservationStatusLabel(status)}</StatusChip>
      </header>
      <div className="rv-person">
        <Avatar profile={owner} size="sm" />
        <span><small>Responsable</small><b>{owner ? displayName(owner) : "Sin responsable"}</b></span>
      </div>
      {match.reservation_notes && <p className="rv-notes">{match.reservation_notes}</p>}
      <div className="rv-actions">
        <CopyReservationTextButton match={match} attendances={attendances} profiles={profiles} onCopied={onNotice} className="md-btn md-btn-ghost" />
        {canEdit && <AssistedStatusSelect status={status} onChange={updateStatus} />}
      </div>
    </article>
  );
}

function AssistedHistoryRow({ match, profiles, canEdit, onUpdateMatch }) {
  const status = activeReservationStatus(match);
  const owner = profiles.find((profile) => profile.id === match.reservation_owner_user_id);
  return (
    <li className="rv-hist">
      <span className="rv-hist-main">
        <b>{match.title || "Chamuscón"}</b>
        <small>{match.venue || "Cancha pendiente"} · {match.preferred_time_range || match.start_time || "Horario pendiente"}{owner ? ` · ${displayName(owner)}` : ""}</small>
      </span>
      <StatusChip tone={RES_TONE[status]}>{reservationStatusLabel(status)}</StatusChip>
      {canEdit && <AssistedStatusSelect compact status={status} onChange={(v) => onUpdateMatch(match.id, { reservation_status: v, requires_reservation: true })} />}
    </li>
  );
}

function ReservationCalendar({ variant, anchor, setAnchor, reservations, assisted, selectedDay, setSelectedDay }) {
  const cal = useMemo(() => monthCalendar(anchor, { reservations, assisted }), [anchor, reservations, assisted]);
  const todayKey = new Date().toLocaleDateString("en-CA");
  const monthItems = cal.cells.filter((c) => c.inMonth && c.items.length);
  const shift = (n) => { setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + n, 1)); setSelectedDay(null); };

  return (
    <div className={`rv-cal is-${variant}`}>
      <div className="rv-cal-bar">
        <button className="md-icon-btn" type="button" aria-label="Mes anterior" onClick={() => shift(-1)}><ChevronLeft size={18} aria-hidden="true" /></button>
        <h3 aria-live="polite">{cal.label}</h3>
        <button className="md-icon-btn" type="button" aria-label="Mes siguiente" onClick={() => shift(1)}><ChevronRight size={18} aria-hidden="true" /></button>
        <button className="md-btn md-btn-ghost rv-today" type="button" onClick={() => { setAnchor(new Date()); setSelectedDay(todayKey); }}>Hoy</button>
      </div>
      <div className="rv-grid" role="grid" aria-label={`Calendario de reservas ${cal.label}`}>
        <div className="rv-grid-row rv-grid-head" role="row">{WEEKDAYS.map((d) => <span key={d} role="columnheader">{d}</span>)}</div>
        {Array.from({ length: 6 }, (_, w) => (
          <div className="rv-grid-row" role="row" key={w}>
            {cal.cells.slice(w * 7, w * 7 + 7).map((c) => (
              <button
                key={c.key}
                type="button"
                role="gridcell"
                className={classNames("rv-day", !c.inMonth && "is-out", c.key === todayKey && "is-today", selectedDay === c.key && "is-sel", c.items.length && "has-items")}
                aria-selected={selectedDay === c.key}
                aria-label={`${c.day}${c.items.length ? `, ${c.items.length} reserva(s)` : ""}`}
                onClick={() => setSelectedDay(selectedDay === c.key ? null : c.key)}
              >
                <span className="rv-day-n">{c.day}</span>
                <span className="rv-day-items">
                  {c.items.slice(0, 2).map((it) => (
                    <i key={`${it.kind}-${it.id}`} className={`is-${it.kind} st-${it.status}`}>{it.time ? `${it.time} ` : ""}{it.venue || "Cancha"}</i>
                  ))}
                  {c.items.length > 2 && <i className="is-more">+{c.items.length - 2}</i>}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <ul className="rv-legend" aria-label="Leyenda">
        <li><i />Pendiente</li><li><i className="st-confirmed" />Confirmada</li><li><i className="is-assisted" />Asistida</li>
      </ul>
      {monthItems.length === 0 && <Empty>No hay reservas en {cal.label}.</Empty>}
    </div>
  );
}

export default function CourtReservationPage({
  activeGroupId,
  profiles,
  venues,
  matches = [],
  attendances = [],
  groupTags = [],
  isAdmin,
  isSuperAdmin,
  currentUserId,
  onUpdateMatch,
  onNotice,
  onCreateMatch,
  onCreateVenue,
  onUpdateVenue,
  isDemoMode = false,
  reservations = [],
  setReservations,
}) {
  const [showForm, setShowForm] = useState(false);
  const [rows, setRows] = useState([0]);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [recentlyCreated, setRecentlyCreated] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [view, setView] = useState(null); // null = design default | "calendar" | "cards" | "list"
  const [rangeFilter, setRangeFilter] = useState("3"); // "3" | "10" | "all"
  const [expandedPending, setExpandedPending] = useState(false);
  const [expandedConfirmed, setExpandedConfirmed] = useState(false);

  async function loadReservations() {
    if (!activeGroupId || isDemoMode) return;
    try {
      const rows = await api.listReservations(activeGroupId);
      setReservations(rows);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (!isDemoMode) {
      setLoading(true);
      loadReservations().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [activeGroupId, isDemoMode]);

  // Auto-refresh when tab becomes visible again
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") loadReservations();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [activeGroupId]);

  function handleRowChange(index, data) {
    setFormData((prev) => ({ ...prev, [index]: data }));
  }

  function addRow() {
    if (rows.length >= 3) return;
    setRows((prev) => [...prev, prev.length]);
  }

  function removeRow(index) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setFormData((prev) => {
      const next = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = Number(k);
        if (ki < index) next[ki] = v;
        else if (ki > index) next[ki - 1] = v;
      });
      return next;
    });
  }

  async function handleCreate() {
    setError(""); setNotice(""); setRecentlyCreated([]); setSaving(true);
    const allRows = rows.map((_, i) => formData[i]);
    const validEntries = allRows.filter((d) => d?.venue && d?.reservation_date && d?.assigned_to);
    const invalidCount = allRows.length - validEntries.length;
    
    if (validEntries.length === 0) {
      setError("Completá al menos una reserva con cancha, fecha y responsable.");
      setSaving(false);
      return;
    }

    const created = [];
    const errors = [];
    for (let i = 0; i < validEntries.length; i++) {
      try {
        const formRow = validEntries[i];
        const notesWithTags = formRow.allowed_tags && formRow.allowed_tags.length > 0
          ? `[Tags: ${formRow.allowed_tags.join(",")}] ${formRow.notes || ""}`
          : formRow.notes || null;

        const payload = {
          venue: formRow.venue,
          reservation_date: formRow.reservation_date,
          reservation_time: formRow.reservation_time || "19:00",
          assigned_to: formRow.assigned_to,
          notes: notesWithTags,
          group_id: activeGroupId,
          assigned_by: currentUserId,
        };

        let res;
        if (import.meta.env.DEV && isDemoMode) {
          res = {
            id: `res-mock-${Date.now()}-${i}`,
            ...payload,
            status: "pending",
            proof_url: null,
            created_at: new Date().toISOString()
          };
        } else {
          res = await api.createReservation(payload);
        }
        const assignedProf = profiles.find((p) => p.id === payload.assigned_to) || null;
        res.assigned_profile = assignedProf;
        created.push(res);
      } catch (err) {
        errors.push(`Reserva ${i + 1} (${validEntries[i].venue}): ${err.message}`);
      }
    }
    if (created.length > 0) {
      setReservations((c) => [...c, ...created]);
      setRecentlyCreated(created);
      setShowForm(false);
      setRows([0]);
      setFormData({});
      loadReservations();

      setTimeout(() => {
        const targetEl = document.getElementById("seguimiento-panel");
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 150);
    }
    if (errors.length > 0) {
      setError(`Errores: ${errors.join(" | ")}`);
    } else if (invalidCount > 0) {
      setNotice(`${created.length} reserva(s) creada(s). ${invalidCount} fila(s) incompleta(s) ignorada(s).`);
    } else {
      setNotice(`${created.length} reserva(s) creada(s).`);
    }
    setSaving(false);
  }

  async function handleUploadProof(reservationId, file) {
    try {
      let url;
      if (import.meta.env.DEV && isDemoMode) {
        url = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=300";
      } else {
        url = await api.uploadReservationProof(reservationId, file);
        await api.updateReservation(reservationId, { proof_url: url });
      }
      setReservations((c) => c.map((r) => r.id === reservationId ? { ...r, proof_url: url } : r));
    } catch (err) { setError(err.message); }
  }

  async function handleConfirm(reservation) {
    setError("");
    try {
      let match;
      if (import.meta.env.DEV && isDemoMode) {
        let allowedTags = [];
        let cleanTitle = `Partido en ${reservation.venue}`;

        if (reservation.notes) {
          const matchTags = reservation.notes.match(/^\[Tags:\s*([^\]]*)\]\s*(.*)/);
          if (matchTags) {
            const tagStr = matchTags[1];
            allowedTags = tagStr.split(",").map((t) => t.trim()).filter(Boolean);
            const restNotes = matchTags[2];
            if (restNotes) {
              cleanTitle = restNotes;
            }
          }
        }

        match = {
          id: `m-mock-${Date.now()}`,
          group_id: activeGroupId,
          title: cleanTitle,
          match_date: reservation.reservation_date,
          start_time: reservation.reservation_time || "19:00",
          venue: reservation.venue,
          status: "upcoming",
          allowed_tags: allowedTags
        };
      } else {
        match = await api.confirmReservation(
          reservation.id, activeGroupId, reservation.venue,
          reservation.reservation_date, reservation.reservation_time,
          `Partido en ${reservation.venue}`,
        );
      }
      setReservations((c) => c.map((r) => r.id === reservation.id ? { ...r, status: "confirmed", match_id: match.id } : r));
      if (onCreateMatch) onCreateMatch(match);
      setNotice("Partido creado desde la reserva (Simulación Local).");
    } catch (err) { setError(err.message); }
  }

  async function handleDelete(reservationId) {
    try {
      if (!isDemoMode) {
        await api.deleteReservation(reservationId);
      }
      setReservations((c) => c.filter((r) => r.id !== reservationId));
    } catch (err) { setError(err.message); }
  }

  async function copyLink(reservationId) {
    const token = reservationId.replace(/-/g, "");
    const link = `${appOrigin()}/reserve/${token}`;
    try {
      await copyToClipboard(link);
      setCopiedId(reservationId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Error copying reservation link:", err);
    }
  }

  const { design } = useAppearance();
  const variant = design === "command" ? "command" : "editorial";
  const [tab, setTab] = useState("agenda"); // "agenda" | "venues"
  const [calAnchor, setCalAnchor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  // Editorial opens on the calendar, Command on the operational cards; the user can switch.
  const effectiveView = view || (variant === "command" ? "cards" : "calendar");

  const newlyCreatedSet = new Set(recentlyCreated.map((r) => r.id));
  const { pending, confirmed } = splitReservations(reservations, newlyCreatedSet);
  const visiblePending = pending.slice(0, visibleLimit(rangeFilter, expandedPending, pending.length));
  const visibleConfirmed = confirmed.slice(0, visibleLimit(rangeFilter, expandedConfirmed, confirmed.length));
  const assisted = assistedReservationsFor({ matches, isAdmin, currentUserId });
  const { groups: groupedByDate, dates: sortedDates } = groupReservationsByDate(reservations);
  const withoutProof = pending.filter((r) => !r.proof_url).length;

  const cardProps = {
    variant,
    isAdmin,
    isSuperAdmin,
    currentUserId,
    onConfirm: handleConfirm,
    onDelete: handleDelete,
    onUploadProof: handleUploadProof,
    onCopyLink: copyLink,
    copiedId,
  };
  const renderCard = (r) => <ReservationCard key={r.id} reservation={r} {...cardProps} isNewlyCreated={newlyCreatedSet.has(r.id)} />;
  const dayReservations = selectedDay ? reservations.filter((r) => r.reservation_date === selectedDay) : [];
  const dayAssisted = selectedDay ? assisted.all.filter((m) => m.match_date === selectedDay) : [];

  const header = variant === "command" ? (
    <div className="mdc-bar">
      <h1>Reservas</h1>
      <span className="mdc-pill"><CalendarDays size={14} aria-hidden="true" /> <b>{pending.length}</b> pendientes</span>
      <span className="mdc-pill"><b>{confirmed.length}</b> confirmadas</span>
      <span className="mdc-pill"><MapPin size={14} aria-hidden="true" /> <b>{venues.length}</b> sedes</span>
    </div>
  ) : (
    <header className="fx-ed-hero">
      <span className="mde-crumb">Agenda de canchas</span>
      <h1>Reservas</h1>
      <p className="fx-ed-lede">
        <b className="fx-lede-num">{pending.length}</b> pendientes de confirmar · <b className="fx-lede-num">{confirmed.length}</b> confirmadas · <b className="fx-lede-num">{venues.length}</b> sedes en el catálogo
      </p>
    </header>
  );

  return (
    <div className={`md-matches md-design-${variant} fx-page rv-page`} data-design={variant} data-view="reservations">
      <div className={variant === "command" ? "mdc fx-shell" : "mde fx-shell"}>
        {header}
        <nav className="pl-tabs fx-tabs" aria-label="Secciones de Reservas">
          <button type="button" className={tab === "agenda" ? "is-on" : ""} aria-current={tab === "agenda" ? "page" : undefined} onClick={() => setTab("agenda")}><CalendarDays size={16} aria-hidden="true" /> Agenda</button>
          <button type="button" className={tab === "venues" ? "is-on" : ""} aria-current={tab === "venues" ? "page" : undefined} onClick={() => setTab("venues")}><MapPin size={16} aria-hidden="true" /> Sedes y canchas</button>
        </nav>

        {tab === "venues" && (
          <VenuesPage
            variant={variant}
            groupId={activeGroupId}
            profileId={currentUserId}
            venues={venues}
            matches={matches}
            onCreateVenue={onCreateVenue}
            onUpdateVenue={onUpdateVenue}
            isAdmin={isAdmin}
          />
        )}

        {tab === "agenda" && (
          <div className={`rv-agenda is-${variant}`}>
            {variant === "command" && (
              <Kpis variant="command" items={[
                { label: "Pendientes", value: pending.length, tone: pending.length ? "warn" : undefined },
                { label: "Sin comprobante", value: withoutProof, tone: withoutProof ? "bad" : undefined },
                { label: "Confirmadas", value: confirmed.length, tone: "good" },
                { label: "Asistidas pendientes", value: assisted.pending.length, hint: assisted.failed.length ? `${assisted.failed.length} fallidas` : undefined },
              ]} />
            )}

            {error && <p className="fx-alert is-bad" role="alert">{error}</p>}
            {notice && <p className="fx-alert is-good" role="status">{notice}</p>}

            <Section
              title="Delegación de cancha"
              icon={PlusCircle}
              className="rv-delegate"
              aside={<>
                <button className="md-icon-btn" type="button" onClick={loadReservations} title="Actualizar" aria-label="Actualizar"><RefreshCw size={16} aria-hidden="true" /></button>
                <button className={`md-btn ${showForm ? "md-btn-ghost" : "md-btn-accent"}`} type="button" onClick={() => setShowForm((v) => !v)}>
                  {showForm ? "Cancelar" : <><PlusCircle size={15} aria-hidden="true" /> Nueva reserva</>}
                </button>
              </>}
            >
              <p className="fx-hint">Delegá la reserva a un jugador. Sube el comprobante y se confirma creando el partido.</p>

              {recentlyCreated.length > 0 && (() => {
                const groupedByPlayer = {};
                recentlyCreated.forEach((r) => {
                  const key = r.assigned_to || "unassigned";
                  if (!groupedByPlayer[key]) groupedByPlayer[key] = [];
                  groupedByPlayer[key].push(r);
                });
                return (
                  <div className="rv-created" role="status">
                    <h3>¡Reserva(s) creada(s) exitosamente!</h3>
                    <p>Compartí el enlace con los jugadores responsables para que suban su comprobante:</p>
                    <ul>
                      {Object.entries(groupedByPlayer).map(([key, rList]) => {
                        const personName = displayName(rList[0]?.assigned_profile);
                        const tokens = rList.map((r) => reservationToken(r.id)).join("_");
                        const link = `${appOrigin()}/reserve/${tokens}`;
                        const count = rList.length;
                        let waMessage = "";
                        if (count > 1) {
                          const listSummary = rList.map((r) => `• *${r.venue}* (${reservationDateLabel(r.reservation_date)} ${r.reservation_time || ""})`).join("\n");
                          waMessage = encodeURIComponent(`¡Hola ${personName}! Te asigné ${count} reservas de cancha:\n${listSummary}\n\nPor favor subí tu(s) comprobante(s) acá:\n${link}`);
                        } else {
                          const r = rList[0];
                          waMessage = encodeURIComponent(`¡Hola ${personName}! Te asigné la reserva de la cancha *${r.venue}* (${reservationDateLabel(r.reservation_date)} ${r.reservation_time || ""}). Por favor subí tu comprobante acá:\n${link}`);
                        }
                        return (
                          <li key={key}>
                            <span>
                              <b>{count > 1 ? `${count} reservas para ${personName}` : rList[0].venue}</b>
                              {count > 1
                                ? rList.map((r) => <small key={r.id}>• {r.venue} ({reservationDateLabel(r.reservation_date)} {r.reservation_time || ""})</small>)
                                : <small>Responsable: {personName}</small>}
                            </span>
                            <span className="rv-actions">
                              <WhatsAppLink href={`https://wa.me/?text=${waMessage}`} />
                              <button type="button" className="md-btn md-btn-ghost" onClick={() => copyLink(rList[0].id, rList)}>
                                <Copy size={15} aria-hidden="true" />{copiedId === rList[0].id ? "Copiado ✓" : "Copiar link"}
                              </button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })()}

              {showForm && (
                <div className="form-grid md-form fx-form rv-form">
                  {rows.map((_, i) => (
                    <ReservationRow key={i} index={i} venues={venues} profiles={profiles} groupTags={groupTags} onChange={handleRowChange} onRemove={removeRow} />
                  ))}
                  {rows.length < 3 && (
                    <button className="md-btn md-btn-ghost rv-add" type="button" onClick={addRow}><PlusCircle size={15} aria-hidden="true" /> Agregar otra reserva</button>
                  )}
                  <div className="md-form-actions">
                    <button className="md-btn md-btn-ghost" type="button" onClick={() => { setShowForm(false); setRows([0]); setFormData({}); }}>Cancelar</button>
                    <button className="md-btn md-btn-accent" type="button" onClick={handleCreate} disabled={saving}>{saving ? "Guardando…" : `Crear ${rows.length} reserva(s)`}</button>
                  </div>
                </div>
              )}
            </Section>

            <Section
              title="Seguimiento"
              icon={CalendarDays}
              id="seguimiento-panel"
              className="rv-track"
              aside={<>
                <small>{pending.length} pendientes · {confirmed.length} confirmadas</small>
                <Segmented label="Vista de reservas" value={effectiveView} onChange={setView} options={[["calendar", "Calendario"], ["cards", "Tarjetas"], ["list", "Lista"]]} />
              </>}
            >
              {reservations.length === 0 && !loading && (
                <Empty>No hay reservas. Creá una para delegar la cancha.</Empty>
              )}

              {effectiveView === "calendar" && (
                <>
                  <ReservationCalendar variant={variant} anchor={calAnchor} setAnchor={setCalAnchor} reservations={reservations} assisted={assisted.all} selectedDay={selectedDay} setSelectedDay={setSelectedDay} />
                  {selectedDay && (
                    <div className="rv-day-detail" aria-live="polite">
                      <h3>{reservationDateLabel(selectedDay, { weekday: "long", day: "numeric", month: "long" })}</h3>
                      {dayReservations.length === 0 && dayAssisted.length === 0 ? <Empty>Sin reservas este día.</Empty> : (
                        <div className="rv-card-grid">
                          {dayReservations.map(renderCard)}
                          {dayAssisted.map((match) => (
                            <AssistedReservationCard key={match.id} variant={variant} match={match} profiles={profiles} attendances={attendances} canEdit={isAdmin || match.reservation_owner_user_id === currentUserId} onUpdateMatch={onUpdateMatch} onNotice={onNotice} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {effectiveView === "list" && reservations.length > 0 && (
                <table className="fx-table rv-table">
                  <thead><tr><th scope="col">Cancha</th><th scope="col">Hora</th><th scope="col">Responsable</th><th scope="col">Estado</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
                  <tbody>
                    {sortedDates.map((date) => [
                      <tr key={`${date}-h`} className="fx-month"><th colSpan={5} scope="rowgroup">{date !== "Sin fecha" ? reservationDateLabel(date, { weekday: "long", day: "numeric", month: "long" }) : "Sin fecha"}</th></tr>,
                      ...groupedByDate[date].map((r) => (
                        <tr key={r.id}>
                          <td><b>{r.venue}</b></td>
                          <td className="fx-date">{r.reservation_time || ""}</td>
                          <td><span className="rv-person is-inline"><Avatar profile={r.assigned_profile} size="sm" />{displayName(r.assigned_profile)}</span></td>
                          <td><StatusChip tone={r.status === "pending" ? "pending" : "paid"}>{r.status === "pending" ? "Pendiente" : "Confirmada"}</StatusChip>{r.proof_url && <span className="rv-clip" title="Con comprobante">📎</span>}</td>
                          <td className="fx-row-act">
                            {r.status === "pending" && (
                              <span className="rv-actions">
                                <WhatsAppLink compact href={`https://wa.me/?text=${encodeURIComponent(reservationWhatsappText(r, appOrigin(), r.reservation_date))}`} />
                                <button className="md-btn md-btn-ghost" type="button" onClick={() => copyLink(r.id)}>{copiedId === r.id ? "✓" : <><Copy size={15} aria-hidden="true" /> Link</>}</button>
                              </span>
                            )}
                          </td>
                        </tr>
                      )),
                    ])}
                  </tbody>
                </table>
              )}

              {effectiveView === "cards" && reservations.length > 0 && (
                <>
                  <div className="fx-toolbar">
                    <Segmented
                      label="Rango de reservas"
                      value={rangeFilter}
                      onChange={(v) => { setRangeFilter(v); const all = v === "all"; setExpandedPending(all); setExpandedConfirmed(all); }}
                      options={[["3", "Últimas 3"], ["10", "Últimas 10"], ["all", `Todas (${reservations.length})`]]}
                    />
                  </div>
                  {pending.length > 0 && (
                    <div className="rv-group">
                      <h3>Pendientes de confirmar <span className="fx-tab-badge">{pending.length}</span>{pending.length > visiblePending.length && <small>Mostrando {visiblePending.length} de {pending.length}</small>}</h3>
                      <div className="rv-card-grid">{visiblePending.map(renderCard)}</div>
                      {pending.length > visiblePending.length && <button type="button" className="md-btn md-btn-ghost rv-more" onClick={() => setExpandedPending(true)}>Ver todas las pendientes ({pending.length})</button>}
                      {expandedPending && pending.length > 3 && rangeFilter === "3" && <button type="button" className="md-btn md-btn-ghost rv-more" onClick={() => setExpandedPending(false)}>Ver menos pendientes</button>}
                    </div>
                  )}
                  {confirmed.length > 0 && (
                    <div className="rv-group">
                      <h3>Reservas confirmadas <span className="fx-tab-badge is-good">{confirmed.length}</span>{confirmed.length > visibleConfirmed.length && <small>Mostrando {visibleConfirmed.length} de {confirmed.length}</small>}</h3>
                      <div className="rv-card-grid">{visibleConfirmed.map(renderCard)}</div>
                      {confirmed.length > visibleConfirmed.length && <button type="button" className="md-btn md-btn-ghost rv-more" onClick={() => setExpandedConfirmed(true)}>Ver todas las confirmadas ({confirmed.length})</button>}
                      {expandedConfirmed && confirmed.length > 3 && rangeFilter === "3" && <button type="button" className="md-btn md-btn-ghost rv-more" onClick={() => setExpandedConfirmed(false)}>Ver menos confirmadas</button>}
                    </div>
                  )}
                </>
              )}
            </Section>

            <Section
              title="Reservas asistidas"
              icon={ClipboardList}
              className="rv-assisted-section"
              aside={<span className="fx-count">{assisted.pending.length} pendientes</span>}
            >
              <p className="fx-hint">Copiá el texto para la administración de la cancha y actualizá el estado.</p>
              {assisted.pending.length === 0 ? <Empty>No hay reservas asistidas pendientes.</Empty> : (
                <div className="rv-card-grid">
                  {assisted.pending.map((match) => (
                    <AssistedReservationCard key={match.id} variant={variant} match={match} profiles={profiles} attendances={attendances} canEdit={isAdmin || match.reservation_owner_user_id === currentUserId} onUpdateMatch={onUpdateMatch} onNotice={onNotice} />
                  ))}
                </div>
              )}
              {assisted.failed.length > 0 && (
                <div className="rv-failed">
                  <h3>Fallidas <span className="fx-tab-badge is-bad">{assisted.failed.length}</span></h3>
                  <ul>
                    {assisted.failed.map((match) => (
                      <AssistedHistoryRow key={match.id} match={match} profiles={profiles} canEdit={isAdmin || match.reservation_owner_user_id === currentUserId} onUpdateMatch={onUpdateMatch} />
                    ))}
                  </ul>
                </div>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
