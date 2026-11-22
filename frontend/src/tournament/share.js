/* Championship sharing: WhatsApp-ready text and a PNG image of the table/round, drawn on a canvas
 * (no external service, nothing uploaded). Pure text builders are unit-tested. */
import { computeStandings, isKnockout, isPlayed, restingTeams } from "./championship.js";

const dayLabel = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("es-GT", { weekday: "short", day: "numeric", month: "short" }) : "Fecha por definir");

export function standingsText(t, teams, matches) {
  const table = computeStandings(teams, matches);
  const lines = table.map((r, i) => {
    const dg = r.goal_diff > 0 ? `+${r.goal_diff}` : `${r.goal_diff}`;
    return `${i + 1}. ${r.name} — ${r.points} pts (PJ ${r.played}, DG ${dg})`;
  });
  return `🏆 ${t.name}\nTabla de posiciones\n\n${lines.join("\n")}\n\nf5manager.lat`;
}

export function roundText(t, teams, matches, round, sources = new Map()) {
  const name = (id, slot, m) => teams.find((x) => x.id === id)?.name || sources.get(m.id)?.[slot] || "Por definir";
  const list = matches.filter((m) => m.round === round).sort((a, b) => (a.match_order || 0) - (b.match_order || 0));
  if (!list.length) return "";
  const ko = list.some(isKnockout);
  const title = ko ? (list.length === 1 ? list[0].playoff_label || "Final" : list[0].playoff_label?.replace(/ \d+$/, "") || "Eliminatoria") : `Jornada ${round}`;
  const when = `${dayLabel(list[0].match_date)}${list[0].match_time ? ` · ${list[0].match_time}` : ""}${list[0].venue ? ` · ${list[0].venue}` : ""}`;
  const rows = list.map((m) => (isPlayed(m)
    ? `${name(m.home_team_id, 0, m)} ${m.home_score}–${m.away_score} ${name(m.away_team_id, 1, m)}`
    : `${name(m.home_team_id, 0, m)} vs ${name(m.away_team_id, 1, m)}`));
  const rest = restingTeams(teams, list).map((x) => x.name);
  return `⚽ ${t.name} — ${title}\n${when}\n\n${rows.join("\n")}${rest.length ? `\n\nDescansa: ${rest.join(", ")}` : ""}\n\nf5manager.lat`;
}

export function championText(t, champion, runnerUp) {
  return `🏆 ¡${champion} es campeón de ${t.name}!${runnerUp ? `\nSubcampeón: ${runnerUp}` : ""}\n\nf5manager.lat`;
}

/** Draws a 1080-wide PNG of the table (or a round) and returns a Blob. Colours follow the current palette. */
export async function renderShareImage({ title, subtitle, rows, columns, accent = "#5be584", dark = true }) {
  const W = 1080; const pad = 64; const rowH = 74; const headH = 230;
  const H = headH + rows.length * rowH + 120;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const bg = dark ? "#0b0f0c" : "#f4f6f3"; const ink = dark ? "#f2f5f3" : "#0d1a12"; const sub = dark ? "#9aa8a0" : "#4b5a51"; const line = dark ? "#23302a" : "#d6ded7";
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = accent; g.fillRect(0, 0, W, 10);
  g.fillStyle = ink; g.font = "700 60px Oswald, 'Arial Narrow', Arial, sans-serif"; g.textBaseline = "alphabetic";
  g.fillText(title.toUpperCase().slice(0, 28), pad, 120);
  g.fillStyle = sub; g.font = "500 30px system-ui, Arial, sans-serif"; g.fillText(subtitle, pad, 170);
  const colX = columns.map((col, i) => (i === 0 ? pad : W - pad - (columns.length - 1 - i) * 110));
  g.font = "600 24px system-ui, Arial, sans-serif"; g.fillStyle = sub;
  columns.forEach((col, i) => { g.textAlign = i === 0 ? "left" : "right"; g.fillText(col, i === 0 ? colX[i] : colX[i] + 40, headH - 18); });
  rows.forEach((r, ri) => {
    const y = headH + ri * rowH;
    g.fillStyle = line; g.fillRect(pad, y, W - pad * 2, 2);
    r.forEach((cell, i) => {
      g.textAlign = i === 0 ? "left" : "right";
      g.fillStyle = i === r.length - 1 ? accent : ink;
      g.font = i === 0 ? "600 34px system-ui, Arial, sans-serif" : "700 34px system-ui, Arial, sans-serif";
      const text = String(cell);
      g.fillText(i === 0 ? text.slice(0, 30) : text, i === 0 ? colX[i] : colX[i] + 40, y + 50);
    });
  });
  g.textAlign = "left"; g.fillStyle = sub; g.font = "600 26px system-ui, Arial, sans-serif";
  g.fillText("F5 MANAGER · f5manager.lat", pad, H - 50);
  return new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png"));
}

export function standingsImageData(t, teams, matches) {
  const table = computeStandings(teams, matches);
  return {
    title: t.name,
    subtitle: "Tabla de posiciones",
    columns: ["Equipo", "PJ", "DG", "Pts"],
    rows: table.map((r, i) => [`${i + 1}. ${r.name}`, r.played, r.goal_diff > 0 ? `+${r.goal_diff}` : r.goal_diff, r.points]),
  };
}

export function roundImageData(t, teams, matches, round, sources = new Map()) {
  const name = (id, slot, m) => teams.find((x) => x.id === id)?.name || sources.get(m.id)?.[slot] || "Por definir";
  const list = matches.filter((m) => m.round === round).sort((a, b) => (a.match_order || 0) - (b.match_order || 0));
  const ko = list.some(isKnockout);
  return {
    title: t.name,
    subtitle: `${ko ? list[0]?.playoff_label?.replace(/ \d+$/, "") || "Eliminatoria" : `Jornada ${round}`} · ${dayLabel(list[0]?.match_date)}${list[0]?.match_time ? ` · ${list[0].match_time}` : ""}`,
    columns: ["Partido", "Resultado"],
    rows: list.map((m) => [`${name(m.home_team_id, 0, m)} vs ${name(m.away_team_id, 1, m)}`, isPlayed(m) ? `${m.home_score}–${m.away_score}` : "—"]),
  };
}
