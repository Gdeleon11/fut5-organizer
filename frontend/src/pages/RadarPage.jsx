import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Crosshair, Inbox, MapPin, RefreshCw, Radar as RadarIcon, Send, Users, X } from "lucide-react";
import { api as defaultApi } from "../api.js";
import { useAppearance } from "../appearance/AppearanceProvider.jsx";
import { Empty, Section, StatusChip } from "../components/finance/FinanceBlocks.jsx";
import { POSITION_LABELS } from "../constants.js";
import {
  LEVEL_OPTIONS, MAX_MESSAGE, RADAR_POSITIONS, canCancelSpot, dateWindow, isLateCancel, levelLabel,
  money, occupancyLabel, positionsLabel, requestStatus, roundCoords, shortDate, slotsLabel, splitMyRequests,
} from "../radar/radarModel.js";

const TONE = { ok: "paid", warn: "pending", bad: "rejected", muted: "forgiven" };

function RequestChip({ status }) {
  if (!status) return null;
  const s = requestStatus(status);
  return <StatusChip tone={TONE[s.tone]}>{s.label}</StatusChip>;
}

function Facts({ item }) {
  return (
    <ul className="rd-facts">
      <li><CalendarDays size={14} aria-hidden="true" /> {shortDate(item.match_date, item.start_time)}</li>
      <li><MapPin size={14} aria-hidden="true" /> {item.venue_name} · {item.zone_label}{item.distance_bucket ? ` · ${item.distance_bucket}` : ""}</li>
      <li><Users size={14} aria-hidden="true" /> {occupancyLabel(item.occupancy, item.max_players)} · <b>{slotsLabel(item.radar_slots_left)}</b></li>
    </ul>
  );
}

function ListingRow({ item, variant, onOpen }) {
  const cost = money(item.cost_hint);
  return (
    <li>
      <button type="button" className={`rd-item is-${variant}`} onClick={() => onOpen(item.listing_id)} aria-label={`Ver partido del ${shortDate(item.match_date, item.start_time)} en ${item.venue_name}`}>
        <span className="rd-when">
          <b>{shortDate(item.match_date, null)}</b>
          <small>{(item.start_time || "").slice(0, 5)}</small>
        </span>
        <span className="rd-main">
          <b>{item.venue_name}</b>
          <small>{item.zone_label}{item.distance_bucket ? ` · ${item.distance_bucket}` : ""} · {item.organizer_label}</small>
          <span className="rd-tags">
            <span className="rd-tag">{levelLabel(item.level_band)}</span>
            <span className="rd-tag">{positionsLabel(item.positions)}</span>
            {cost && <span className="rd-tag">≈ {cost} c/u</span>}
          </span>
        </span>
        <span className="rd-side">
          <span className="rd-slots">{slotsLabel(item.radar_slots_left)}</span>
          <RequestChip status={item.my_request_status} />
        </span>
      </button>
    </li>
  );
}

function useDialog(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    ref.current?.querySelector("button, input, select, textarea")?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, onClose]);
  return ref;
}

function ListingSheet({ listingId, radarApi, onClose, onChanged }) {
  const [card, setCard] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [position, setPosition] = useState("Flexible");
  const [message, setMessage] = useState("");
  const ref = useDialog(true, onClose);

  const load = useCallback(async () => {
    try { setError(""); setCard(await radarApi.radarListingCard(listingId)); }
    catch (e) { setError(e.message || "Partido no disponible."); }
  }, [listingId, radarApi]);
  useEffect(() => { load(); }, [load]);

  async function request(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try { await radarApi.radarRequestSpot(listingId, position, message.trim()); await load(); onChanged?.(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function withdraw() {
    setBusy(true); setError("");
    try { await radarApi.radarWithdrawRequest(card.my_request.id); await load(); onChanged?.(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const mine = card?.my_request;
  const canRequest = card && (!mine || ["withdrawn", "canceled", "expired"].includes(mine.status))
    && card.listing_status === "open" && card.radar_slots_left > 0;

  return (
    <div className="rd-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rd-sheet" role="dialog" aria-modal="true" aria-labelledby="rd-sheet-title" ref={ref}>
        <header className="rd-sheet-head">
          <h2 id="rd-sheet-title">{card ? card.venue_name : "Partido en Radar"}</h2>
          <button type="button" className="md-icon-btn" aria-label="Cerrar" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </header>
        {error && <p className="form-message" role="alert">{error}</p>}
        {!card && !error && <p className="fx-empty" role="status">Cargando…</p>}
        {card && (
          <>
            <Facts item={card} />
            <p className="rd-meta">{levelLabel(card.level_band)} · {positionsLabel(card.positions)} · {card.organizer_label}</p>
            {card.note && <p className="rd-note">“{card.note}”</p>}
            <div className="rd-rules" aria-label="Reglas">
              <p><b>Pago:</b> en la cancha{card.cost_hint ? ` (≈ ${money(card.cost_hint)} por jugador)` : ""}.</p>
              <p><b>Cancelación:</b> con menos de {card.rules?.late_cancel_hours ?? 4} h hay multa de {money(card.rules?.late_cancel_fine_amount) || "Q25"}.</p>
              <p><b>Privacidad:</b> el organizador solo ve tu apodo, foto y posición. La dirección exacta se muestra si te aceptan.</p>
            </div>
            {mine && (
              <div className="rd-mine">
                <span>Tu solicitud</span> <RequestChip status={mine.status} />
                {mine.decision_note && <p className="rd-note">Organizador: “{mine.decision_note}”</p>}
                {mine.status === "pending" && (
                  <button type="button" className="md-btn md-btn-ghost" disabled={busy} onClick={withdraw}>Retirar solicitud</button>
                )}
                {mine.status === "approved" && card.private && (
                  <p className="rd-address"><MapPin size={14} aria-hidden="true" /> {card.private.venue_address || "Dirección no cargada por el grupo"}</p>
                )}
              </div>
            )}
            {canRequest && (
              <form className="md-form rd-form" onSubmit={request} aria-label="Solicitar cupo">
                <label>Posición
                  <select value={position} onChange={(e) => setPosition(e.target.value)}>
                    {RADAR_POSITIONS.map((p) => <option key={p} value={p}>{POSITION_LABELS[p] || p}</option>)}
                  </select>
                </label>
                <label className="md-form-wide">Mensaje para el organizador (opcional)
                  <textarea rows={3} maxLength={MAX_MESSAGE} value={message} onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ej. Juego de medio, llego 10 min antes." aria-describedby="rd-msg-count" />
                  <small id="rd-msg-count" className="rd-count">{message.length}/{MAX_MESSAGE}</small>
                </label>
                <button type="submit" className="md-btn md-btn-accent" disabled={busy}>
                  <Send size={15} aria-hidden="true" /> {busy ? "Enviando…" : "Solicitar cupo"}
                </button>
              </form>
            )}
            {!canRequest && !mine && <p className="fx-empty">Este partido ya no recibe solicitudes.</p>}
          </>
        )}
      </div>
    </div>
  );
}

function MyRequestCard({ item, radarApi, onChanged, variant }) {
  const [people, setPeople] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const l = item.listing || {};
  const late = isLateCancel(l.starts_at);
  const fineAmount = item.fine?.amount;

  async function cancel() {
    setBusy(true); setError("");
    try { await radarApi.radarCancelSpot(item.id); setConfirming(false); onChanged?.(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function withdraw() {
    setBusy(true); setError("");
    try { await radarApi.radarWithdrawRequest(item.id); onChanged?.(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function loadPeople() {
    try { setPeople(await radarApi.radarMatchPeople(l.listing_id)); }
    catch (e) { setError(e.message); }
  }

  return (
    <li className={`rd-req is-${variant}`} data-status={item.status}>
      <div className="rd-req-head">
        <b>{l.venue_name}</b>
        <RequestChip status={item.status} />
      </div>
      <Facts item={l} />
      {item.decision_note && <p className="rd-note">Organizador: “{item.decision_note}”</p>}
      {item.private && (
        <div className="rd-private">
          <p className="rd-address"><MapPin size={14} aria-hidden="true" /> {item.private.venue_address || "Dirección no cargada por el grupo"}</p>
          <p>Cuota: <b>{money(item.private.per_player_amount) || "por definir"}</b> · Pago: {item.private.payment_status === "paid" ? "registrado" : "en la cancha"}</p>
          {people ? (
            <ul className="rd-people" aria-label="Jugadores confirmados">
              {people.map((p, i) => <li key={p.profile_id || i} className={p.is_me ? "is-me" : ""}>{p.nickname}{p.is_radar ? " · Radar" : ""}</li>)}
            </ul>
          ) : (
            <button type="button" className="md-btn md-btn-ghost" onClick={loadPeople}><Users size={15} aria-hidden="true" /> Ver jugadores</button>
          )}
        </div>
      )}
      {fineAmount != null && <p className="rd-fine">Multa por cancelación tardía: <b>{money(fineAmount)}</b> ({item.fine.status === "paid" ? "pagada" : "pendiente, se paga al grupo"})</p>}
      {error && <p className="form-message" role="alert">{error}</p>}
      <div className="rd-req-actions">
        {item.status === "pending" && <button type="button" className="md-btn md-btn-ghost" disabled={busy} onClick={withdraw}>Retirar</button>}
        {canCancelSpot(item) && !confirming && (
          <button type="button" className="md-btn md-btn-ghost" disabled={busy} onClick={() => setConfirming(true)}>Cancelar mi cupo</button>
        )}
        {confirming && (
          <div className="rd-confirm" role="alertdialog" aria-label="Confirmar cancelación">
            <p>{late ? "Faltan menos de 4 horas: se generará una multa por cancelación tardía." : "Tu cupo quedará libre para otro jugador."}</p>
            <button type="button" className="md-btn md-btn-accent" disabled={busy} onClick={cancel}>Sí, cancelar</button>
            <button type="button" className="md-btn md-btn-ghost" onClick={() => setConfirming(false)}>Volver</button>
          </div>
        )}
      </div>
    </li>
  );
}

export default function RadarPage({ radarApi = defaultApi, initialTab = "near", hasGroup = true, onGoToGroups }) {
  const { design } = useAppearance();
  const variant = design === "command" ? "command" : "editorial";
  const [tab, setTab] = useState(initialTab);
  const [range, setRange] = useState("2w");
  const [level, setLevel] = useState("any");
  const [zone, setZone] = useState("");
  const [coords, setCoords] = useState(null); // rounded, memory only
  const [locating, setLocating] = useState(false);
  const [zones, setZones] = useState([]);
  const [items, setItems] = useState(null);
  const [mine, setMine] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);

  const loadNearby = useCallback(async () => {
    setError("");
    try {
      const { from, to } = dateWindow(range === "today" ? "today" : range === "week" ? "week" : "2w");
      const [rows, z] = await Promise.all([
        radarApi.radarNearby({ lat: coords?.lat, lng: coords?.lng, radiusKm: 15, from, to, level, zone: coords ? null : zone }),
        radarApi.radarZones(),
      ]);
      setItems(rows); setZones(z);
    } catch (e) { setError(e.message || "No se pudo cargar Radar."); setItems([]); }
  }, [radarApi, coords, range, level, zone]);

  const loadMine = useCallback(async () => {
    try { setMine(await radarApi.radarMyRequests()); }
    catch (e) { setError(e.message || "No se pudieron cargar tus solicitudes."); setMine([]); }
  }, [radarApi]);

  useEffect(() => { if (tab === "near") loadNearby(); }, [tab, loadNearby]);
  useEffect(() => { if (tab === "mine") loadMine(); }, [tab, loadMine]);

  function locate() {
    if (!navigator.geolocation) { setError("Tu dispositivo no comparte ubicación. Elegí una zona."); return; }
    setLocating(true); setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords(roundCoords(pos.coords.latitude, pos.coords.longitude)); setZone(""); setLocating(false); },
      () => { setError("No pudimos obtener tu ubicación. Elegí una zona."); setLocating(false); },
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 10000 },
    );
  }

  const split = useMemo(() => splitMyRequests(mine || []), [mine]);
  const pendingCount = split.active.filter((r) => r.status === "pending").length;
  const approvedCount = split.active.filter((r) => r.status === "approved").length;

  const header = variant === "command" ? (
    <div className="mdc-bar">
      <h1>Radar</h1>
      <span className="mdc-pill"><RadarIcon size={14} aria-hidden="true" /> <b>{items?.length ?? "–"}</b> partidos cerca</span>
      <span className="mdc-pill"><b>{approvedCount}</b> aceptadas · <b>{pendingCount}</b> pendientes</span>
    </div>
  ) : (
    <header className="fx-ed-hero">
      <span className="mde-crumb">Partidos abiertos cerca</span>
      <h1>Radar</h1>
      <p className="fx-ed-lede">Encontrá cupos en partidos de otros grupos. El organizador acepta cada solicitud y nunca compartimos tu ubicación.</p>
    </header>
  );

  return (
    <div className={`md-matches md-design-${variant} fx-page rd-page`} data-design={variant} data-view="radar">
      <div className={variant === "command" ? "mdc fx-shell" : "mde fx-shell"}>
        {header}
        {!hasGroup && (
          <p className="rd-banner">¿Tenés grupo propio? <button type="button" className="md-btn md-btn-ghost" onClick={onGoToGroups}>Crear o unirme a un grupo</button></p>
        )}
        <nav className="pl-tabs fx-tabs" aria-label="Secciones de Radar">
          <button type="button" className={tab === "near" ? "is-on" : ""} aria-current={tab === "near" ? "page" : undefined} onClick={() => setTab("near")}>
            <RadarIcon size={16} aria-hidden="true" /> Partidos cerca
          </button>
          <button type="button" className={tab === "mine" ? "is-on" : ""} aria-current={tab === "mine" ? "page" : undefined} onClick={() => setTab("mine")}>
            <Inbox size={16} aria-hidden="true" /> Mis partidos y solicitudes
          </button>
        </nav>
        {error && <p className="form-message" role="alert">{error}</p>}

        {tab === "near" && (
          <Section title="Partidos cerca" icon={RadarIcon}
            aside={<button type="button" className="md-btn md-btn-ghost" onClick={loadNearby} aria-label="Actualizar"><RefreshCw size={15} aria-hidden="true" /></button>}>
            <div className="rd-filters md-form" role="group" aria-label="Filtros">
              <div className="rd-where">
                <button type="button" className={`md-btn ${coords ? "md-btn-accent" : "md-btn-ghost"}`} onClick={locate} disabled={locating} aria-pressed={!!coords}>
                  <Crosshair size={15} aria-hidden="true" /> {locating ? "Buscando…" : coords ? "Cerca de mí" : "Usar mi ubicación"}
                </button>
                <label>Zona
                  <select value={coords ? "" : zone} onChange={(e) => { setCoords(null); setZone(e.target.value); }}>
                    <option value="">{coords ? "Cerca de mí (≈15 km)" : "Todas las zonas"}</option>
                    {zones.map((z) => <option key={z.zone_label} value={z.zone_label}>{z.zone_label} ({z.listings})</option>)}
                  </select>
                </label>
              </div>
              <label>Fecha
                <select value={range} onChange={(e) => setRange(e.target.value)}>
                  <option value="today">Hoy</option>
                  <option value="week">Próximos 7 días</option>
                  <option value="2w">Próximos 14 días</option>
                </select>
              </label>
              <label>Nivel
                <select value={level} onChange={(e) => setLevel(e.target.value)}>
                  {LEVEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            </div>
            {coords && <p className="rd-privacy">Usamos tu ubicación aproximada (≈1 km) solo para esta búsqueda. No se guarda.</p>}
            {items === null && <p className="fx-empty" role="status">Cargando…</p>}
            {items && items.length === 0 && <Empty>No hay partidos con cupos en Radar para estos filtros.</Empty>}
            {items && items.length > 0 && (
              <ul className={`rd-list is-${variant}`}>
                {items.map((it) => <ListingRow key={it.listing_id} item={it} variant={variant} onOpen={setOpenId} />)}
              </ul>
            )}
          </Section>
        )}

        {tab === "mine" && (
          <>
            <Section title="Activas" icon={Inbox}>
              {mine === null && <p className="fx-empty" role="status">Cargando…</p>}
              {mine && split.active.length === 0 && <Empty>No tenés solicitudes activas. Buscá un partido en “Partidos cerca”.</Empty>}
              <ul className="rd-reqs">
                {split.active.map((r) => <MyRequestCard key={r.id} item={r} radarApi={radarApi} onChanged={loadMine} variant={variant} />)}
              </ul>
            </Section>
            {split.history.length > 0 && (
              <Section title="Historial" icon={CalendarDays}>
                <ul className="rd-reqs is-history">
                  {split.history.map((r) => <MyRequestCard key={r.id} item={r} radarApi={radarApi} onChanged={loadMine} variant={variant} />)}
                </ul>
              </Section>
            )}
          </>
        )}
      </div>
      {openId && (
        <ListingSheet listingId={openId} radarApi={radarApi} onClose={() => setOpenId(null)}
          onChanged={() => { loadNearby(); loadMine(); }} />
      )}
    </div>
  );
}
