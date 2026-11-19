import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { buildMatchdayModel } from "../matchday/matchdayModel.js";
import { EditorialHero } from "./matchday/EditorialMatchesView.jsx";
import { CommandArena } from "./matchday/CommandMatchesView.jsx";

const STAGE_WIDTH = 1100;

/** Sample data for the preview only — labelled "datos de ejemplo" in the UI, never shown as real. */
function sampleEntry() {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const names = ["Tú", "Ana", "Beto", "Caro", "Dani", "Eli", "Fede", "Gabi", "Hugo"];
  const profiles = names.map((n, i) => ({ id: `p${i}`, nickname: n, full_name: n, is_active: true }));
  const match = { id: "preview", title: "Cancha de ejemplo", venue: "Cancha de ejemplo", match_date: iso, start_time: "19:00", max_players: 15, status: "upcoming" };
  const attendances = profiles.map((p, i) => ({ id: `a${i}`, match_id: "preview", profile_id: p.id, status: "confirmed", created_at: new Date(2026, 0, 1, 0, i).toISOString() }));
  const model = buildMatchdayModel({ nextMatch: match, upcoming: [match], attendances, profiles, profile: profiles[0], clearance: { clear: true }, now: today });
  return { ...model.featured, place: "Vista previa" };
}

const noopActions = { run: () => {}, busyId: null };

/**
 * Renders the real hero component of a design (scaled down, inert) so users can see
 * what each experience looks like in the current palette before choosing it.
 */
export default function DesignPreview({ design }) {
  const boxRef = useRef(null);
  const stageRef = useRef(null);
  const [scale, setScale] = useState(0.3);
  const [height, setHeight] = useState(160);
  const entry = useMemo(() => sampleEntry(), []);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const stage = stageRef.current;
    if (!box || !stage) return undefined;
    const update = () => {
      const s = box.clientWidth / STAGE_WIDTH;
      setScale(s);
      setHeight(Math.round(stage.scrollHeight * s));
    };
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(box);
    return () => ro?.disconnect();
  }, [design]);

  return (
    <span className="md-preview" ref={boxRef} style={{ height }} aria-hidden="true" data-preview={design} inert="">
      <span className="md-preview-stage" ref={stageRef} style={{ width: STAGE_WIDTH, transform: `scale(${scale})` }}>
        {design === "command" ? (
          <span className="md-matches md-design-command"><span className="mdc"><CommandArena entry={entry} actions={noopActions} /></span></span>
        ) : (
          <span className="md-matches md-design-editorial"><span className="mde"><EditorialHero entry={entry} actions={noopActions} /></span></span>
        )}
      </span>
    </span>
  );
}
