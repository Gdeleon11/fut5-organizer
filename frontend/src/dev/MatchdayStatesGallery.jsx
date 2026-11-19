import React, { useEffect } from "react";
import MatchesPage from "../pages/MatchesPage.jsx";
import { applyAppearance } from "../appearance/appearance.js";
import { MATCH_STATES } from "../matchday/matchdayModel.js";

/**
 * DEV-ONLY visual harness (never bundled in production: gated by import.meta.env.DEV).
 * Renders the real MatchesPage for each of the 7 states with clearly-labelled test fixtures,
 * so screenshots/QA can cover states the demo data does not reach (waitlist, full, cancelled…).
 * Open with: /?f5-gallery=1&design=editorial|command&palette=neon|midnight|gold|light[&state=…]
 */
const NOW = new Date();
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const TODAY = iso(NOW);
const LAST_WEEK = iso(new Date(NOW.getTime() - 7 * 86400000));
const IN_3_DAYS = iso(new Date(NOW.getTime() + 3 * 86400000));

const NAMES = ["Prueba A", "Prueba B", "Prueba C", "Prueba D", "Prueba E", "Prueba F", "Prueba G", "Prueba H",
  "Prueba I", "Prueba J", "Prueba K", "Prueba L", "Prueba M", "Prueba N", "Prueba O", "Prueba P"];
const ME = { id: "me", nickname: "Yo (prueba)", full_name: "Yo (prueba)", is_active: true };
const OTHERS = NAMES.map((n, i) => ({ id: `p${i}`, nickname: n, full_name: n }));
const PROFILES = [ME, ...OTHERS];

const baseMatch = (over = {}) => ({
  id: "m-now", title: "Cancha de prueba", venue: "Cancha de prueba", match_date: TODAY, start_time: "19:00",
  max_players: 15, status: "upcoming", ...over,
});
const later = { id: "m-later", title: "Segunda cancha de prueba", venue: "Segunda cancha de prueba", match_date: IN_3_DAYS, start_time: "20:00", max_players: 18, status: "upcoming" };
const past = { id: "m-past", title: "Partido anterior (prueba)", venue: "Cancha de prueba", match_date: LAST_WEEK, start_time: "19:00", max_players: 15, status: "closed" };

const att = (matchId, profileId, status, i = 0) => ({
  id: `${matchId}-${profileId}`, match_id: matchId, profile_id: profileId, status, checked_in: false,
  created_at: new Date(NOW.getTime() - (100 - i) * 60000).toISOString(),
});
const confirmedOthers = (matchId, n) => OTHERS.slice(0, n).map((p, i) => att(matchId, p.id, "confirmed", i));

function fixture(state) {
  const pastAtt = confirmedOthers("m-past", 10);
  const laterAtt = confirmedOthers("m-later", 3);
  switch (state) {
    case "confirmed": {
      const m = baseMatch();
      return { nextMatch: m, matches: [m, later], pastMatches: [past], attendances: [att(m.id, "me", "confirmed"), ...confirmedOthers(m.id, 6), ...laterAtt, ...pastAtt] };
    }
    case "available": {
      const m = baseMatch();
      return { nextMatch: m, matches: [m, later], pastMatches: [past], attendances: [...confirmedOthers(m.id, 7), ...laterAtt, ...pastAtt] };
    }
    case "waitlist": {
      const m = baseMatch();
      return { nextMatch: m, matches: [m, later], pastMatches: [past], attendances: [...confirmedOthers(m.id, 15), att(m.id, "p15", "waitlist", 1), att(m.id, "me", "waitlist", 2), ...laterAtt, ...pastAtt] };
    }
    case "full": {
      const m = baseMatch();
      return { nextMatch: m, matches: [m, later], pastMatches: [past], attendances: [...confirmedOthers(m.id, 15), ...laterAtt, ...pastAtt] };
    }
    case "cancelled": {
      const m = baseMatch({ status: "canceled" });
      return { nextMatch: null, matches: [later], pastMatches: [m, past], attendances: [att(m.id, "me", "confirmed"), ...confirmedOthers(m.id, 6), ...laterAtt, ...pastAtt] };
    }
    case "finished": {
      const m = baseMatch({ status: "closed" });
      return { nextMatch: null, matches: [], pastMatches: [m, past], attendances: [att(m.id, "me", "confirmed"), ...confirmedOthers(m.id, 9), ...pastAtt] };
    }
    default:
      return { nextMatch: null, matches: [], pastMatches: [past], attendances: pastAtt };
  }
}

const noop = async () => {};

export default function MatchdayStatesGallery() {
  const params = new URLSearchParams(window.location.search);
  const design = params.get("design") === "command" ? "command" : "editorial";
  const palette = params.get("palette") || "neon";
  const only = params.get("state");
  const states = only ? [only] : MATCH_STATES;

  useEffect(() => applyAppearance({ design, palette }), [design, palette]);

  return (
    <div className="md-gallery" style={{ padding: 24, display: "grid", gap: 48 }}>
      <p style={{ margin: 0, color: "var(--md-text-3)", font: "600 12px var(--md-ui)", letterSpacing: ".16em", textTransform: "uppercase" }}>
        Galería DEV · datos de prueba · {design} · {palette}
      </p>
      {states.map((s) => {
        const f = fixture(s);
        return (
          <div key={s} data-gallery-state={s} style={{ display: "grid", gap: 12 }}>
            <small style={{ color: "var(--md-text-3)", letterSpacing: ".18em", textTransform: "uppercase" }}>{s}</small>
            <MatchesPage
              forceDesign={design}
              isAdmin={params.get("admin") !== "0"}
              matches={f.matches}
              pastMatches={f.pastMatches}
              nextMatch={f.nextMatch}
              attendances={f.attendances}
              profiles={PROFILES}
              profile={ME}
              clearance={{ clear: true, total: 0 }}
              fineAmount={25}
              guests={{}}
              venues={[]}
              groupName="Grupo de prueba"
              onConfirm={noop}
              onCancel={noop}
              onJoinWaitlist={noop}
              onOpenMatch={() => {}}
              onCreateMatch={noop}
              onDeleteMatch={noop}
              onOpenPizarra={() => {}}
              now={NOW}
            />
          </div>
        );
      })}
    </div>
  );
}
