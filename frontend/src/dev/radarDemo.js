/* DEV-only in-memory Radar API for local screenshots and Playwright (never imported in production
 * builds: App loads it with a dynamic import behind import.meta.env.DEV && isDemoMode).
 * It mirrors the shapes returned by the real radar_* RPCs, never the rules' enforcement. */

const iso = (days, time = "19:00") => {
  const d = new Date(Date.now() + days * 86400000);
  return { match_date: d.toISOString().slice(0, 10), start_time: time };
};
const startsAt = ({ match_date, start_time }) => new Date(`${match_date}T${start_time}:00-06:00`).toISOString();
let seq = 0;
const id = (p) => `${p}-demo-${++seq}`;

export function createRadarDemoApi({ groupId, adminMatchId } = {}) {
  const settings = { group_id: groupId, enabled: true, show_group_name: false };
  const ext = [
    { ...iso(1, "20:00"), venue_name: "Domo Zona 10", zone_label: "Zona 10", distance_bucket: "<2 km", bucket_rank: 1, max_players: 12, occupancy: 9, radar_slots_left: 2, level_band: "intermedio", positions: ["Goalkeeper"], note: "Falta portero, cancha techada.", cost_hint: 35, organizer_label: "Grupo privado" },
    { ...iso(2, "19:30"), venue_name: "Sintética Las Américas", zone_label: "Zona 14", distance_bucket: "2–5 km", bucket_rank: 2, max_players: 10, occupancy: 7, radar_slots_left: 3, level_band: "casual", positions: [], note: null, cost_hint: 30, organizer_label: "Los Martes FC" },
    { ...iso(4, "07:00"), venue_name: "Complejo Mixco", zone_label: "Mixco", distance_bucket: "5–10 km", bucket_rank: 3, max_players: 14, occupancy: 12, radar_slots_left: 1, level_band: "competitivo", positions: ["Defender", "Midfielder"], note: "Ritmo alto, puntualidad.", cost_hint: 40, organizer_label: "Grupo privado" },
    { ...iso(6, "18:00"), venue_name: "Cancha El Prado", zone_label: "Carretera a El Salvador", distance_bucket: "10–15 km", bucket_rank: 4, max_players: 10, occupancy: 6, radar_slots_left: 2, level_band: "any", positions: [], note: null, cost_hint: null, organizer_label: "Grupo privado" },
  ].map((x) => ({ ...x, listing_id: id("listing"), starts_at: startsAt(x), close_at: startsAt(x), listing_status: "open", match_status: "upcoming" }));

  const mine = [
    { id: id("req"), status: "approved", position: "Midfielder", message: "Llego 10 min antes.", decision_note: null, late_cancel: false, created_at: new Date(Date.now() - 7200000).toISOString(), listing: ext[1], private: { venue_address: "Av. Las Américas 12-40, Zona 14", per_player_amount: 30, payment_status: "pending" }, fine: null },
    { id: id("req"), status: "pending", position: "Goalkeeper", message: "Atajo los martes en mi grupo.", decision_note: null, late_cancel: false, created_at: new Date(Date.now() - 1800000).toISOString(), listing: ext[0], private: null, fine: null },
    { id: id("req"), status: "rejected", position: "Forward", message: null, decision_note: "Ya completamos, gracias.", late_cancel: false, created_at: new Date(Date.now() - 86400000 * 3).toISOString(), listing: { ...ext[3], starts_at: new Date(Date.now() - 86400000).toISOString() }, private: null, fine: null },
  ];
  ext[0].my_request_status = "pending";
  ext[1].my_request_status = "approved";

  let listing = adminMatchId ? { id: id("listing"), match_id: adminMatchId, group_id: groupId, status: "open", radar_slots: 3, level_band: "intermedio", positions: ["Goalkeeper"], note: "Buscamos portero.", zone_label: "Zona 15", close_at: null } : null;
  const inbox = [
    { request_id: id("req"), requester_id: id("p"), nickname: "Gato Ruiz", avatar_url: null, preferred_position: "Goalkeeper", position: "Goalkeeper", message: "Juego de portero hace 5 años.", status: "pending", decision_note: null, late_cancel: false, created_at: new Date(Date.now() - 900000).toISOString(), decided_at: null },
    { request_id: id("req"), requester_id: id("p"), nickname: "Pibe Morales", avatar_url: null, preferred_position: "Forward", position: "Flexible", message: null, status: "pending", decision_note: null, late_cancel: false, created_at: new Date(Date.now() - 3600000).toISOString(), decided_at: null },
    { request_id: id("req"), requester_id: id("p"), nickname: "Chino Paz", avatar_url: null, preferred_position: "Midfielder", position: "Midfielder", message: "¡Gracias!", status: "approved", decision_note: null, late_cancel: false, created_at: new Date(Date.now() - 86400000).toISOString(), decided_at: new Date(Date.now() - 80000000).toISOString() },
  ];
  const bans = [];
  const notes = [
    { id: id("n"), kind: "radar_request_received", title: "Nueva solicitud en Radar", body: "Gato Ruiz pidió un cupo · Zona 15", match_id: adminMatchId, created_at: new Date(Date.now() - 900000).toISOString(), read_at: null },
    { id: id("n"), kind: "radar_request_approved", title: "Te aceptaron en Radar", body: "Sintética Las Américas · Revisá la dirección en Radar → Mis partidos.", match_id: null, created_at: new Date(Date.now() - 7000000).toISOString(), read_at: null },
    { id: id("n"), kind: "radar_request_rejected", title: "Solicitud no aceptada", body: "Cancha El Prado · Ya completamos, gracias.", match_id: null, created_at: new Date(Date.now() - 86400000 * 3).toISOString(), read_at: new Date().toISOString() },
  ];
  const wait = (v) => new Promise((r) => setTimeout(() => r(v), 60));

  return {
    getRadarGroupSettings: async () => wait({ ...settings }),
    setRadarGroupSettings: async (_g, enabled, show) => { settings.enabled = enabled; settings.show_group_name = show; if (!enabled && listing) listing.status = "closed"; return wait({ ...settings }); },
    getRadarListingForMatch: async (matchId) => wait(listing && listing.match_id === matchId ? { ...listing } : null),
    listRadarListings: async () => wait(listing ? [listing] : []),
    publishRadarMatch: async (matchId, f) => { listing = { ...(listing || { id: id("listing") }), match_id: matchId, group_id: groupId, status: "open", radar_slots: Number(f.radarSlots), level_band: f.levelBand, positions: f.positions, note: f.note, zone_label: f.zoneLabel || "Zona 15" }; return wait({ ...listing }); },
    setRadarListingStatus: async (_l, status) => { listing = { ...listing, status }; return wait({ ...listing }); },
    radarAdminRequests: async () => wait(inbox.map((r) => ({ ...r }))),
    radarDecideRequest: async (reqId, approve, note) => {
      const r = inbox.find((x) => x.request_id === reqId);
      if (r) Object.assign(r, { status: approve ? "approved" : "rejected", decision_note: note || null, decided_at: new Date().toISOString() });
      return wait({ status: approve ? "approved" : "rejected", request_id: reqId, match_id: listing?.match_id, confirmed_profile_ids: [] });
    },
    radarBanRequester: async (reqId) => { const r = inbox.find((x) => x.request_id === reqId); if (r) { r.status = "rejected"; bans.push({ profile_id: r.requester_id, nickname: r.nickname, created_at: new Date().toISOString() }); } return wait({ banned: true }); },
    radarGroupBans: async () => wait([...bans]),
    radarUnban: async (_g, pid) => { const i = bans.findIndex((b) => b.profile_id === pid); if (i >= 0) bans.splice(i, 1); return wait({ banned: false }); },
    radarNearby: async ({ zone } = {}) => wait(ext.filter((x) => !zone || x.zone_label === zone)),
    radarZones: async () => wait(ext.map((x) => ({ zone_label: x.zone_label, listings: 1 }))),
    radarListingCard: async (listingId) => {
      const l = ext.find((x) => x.listing_id === listingId);
      if (!l) throw new Error("Partido no disponible.");
      const req = mine.find((m) => m.listing.listing_id === listingId);
      return wait({ ...l, rules: { late_cancel_hours: 4, late_cancel_fine_amount: 25, payment: "on_site" }, my_request: req ? { id: req.id, status: req.status, position: req.position, message: req.message, decision_note: req.decision_note } : null, private: req?.status === "approved" ? req.private : null });
    },
    radarRequestSpot: async (listingId, position, message) => {
      const l = ext.find((x) => x.listing_id === listingId);
      const r = { id: id("req"), status: "pending", position, message, decision_note: null, late_cancel: false, created_at: new Date().toISOString(), listing: l, private: null, fine: null };
      mine.unshift(r); l.my_request_status = "pending";
      return wait({ request_id: r.id, status: "pending" });
    },
    radarWithdrawRequest: async (reqId) => { const r = mine.find((m) => m.id === reqId); if (r) { r.status = "withdrawn"; r.listing.my_request_status = "withdrawn"; } return wait({ status: "withdrawn" }); },
    radarCancelSpot: async (reqId) => { const r = mine.find((m) => m.id === reqId); if (r) { r.status = "canceled"; r.private = null; } return wait({ status: "canceled", late_cancel: false, fine_amount: null }); },
    radarMyRequests: async () => wait(mine.map((m) => ({ ...m }))),
    radarMatchPeople: async () => wait([
      { profile_id: null, nickname: "Capi", is_radar: false, is_me: false },
      { profile_id: null, nickname: "Rulo", is_radar: false, is_me: false },
      { profile_id: "me", nickname: "Vos", is_radar: true, is_me: true },
    ]),
    radarGroupOutsiders: async () => wait(inbox.filter((r) => r.status === "approved").map((r) => ({ profile_id: r.requester_id, nickname: r.nickname, avatar_url: null, preferred_position: r.preferred_position }))),
    listNotifications: async () => wait(notes.map((n) => ({ ...n }))),
    countUnreadNotifications: async () => wait(notes.filter((n) => !n.read_at).length),
    markNotificationsRead: async (ids) => { notes.forEach((n) => { if (!ids || ids.includes(n.id)) n.read_at = n.read_at || new Date().toISOString(); }); return wait(1); },
  };
}
