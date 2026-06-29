import { useMemo, useState } from "react";
import { copyToClipboard, formatMatchDate } from "../utils.js";

function topLine(stats, field) {
  return [...(stats || [])]
    .filter((row) => Number(row[field] || 0) > 0)
    .sort((a, b) => Number(b[field] || 0) - Number(a[field] || 0))
    .slice(0, 3);
}

export default function PostMatchSummaryCard({ match, stats = [], confirmedCount = 0 }) {
  const [copied, setCopied] = useState(false);
  const goals = stats.reduce((sum, row) => sum + Number(row.goals || 0), 0);
  const assists = stats.reduce((sum, row) => sum + Number(row.assists || 0), 0);
  const mvp = stats.find((row) => row.mvp);
  const scorers = topLine(stats, "goals");
  const assisters = topLine(stats, "assists");

  const summaryText = useMemo(() => {
    const lines = [
      "RESUMEN F5MANAGER",
      "",
      match?.title || "Chamuscón",
      formatMatchDate(match),
      `Asistencia: ${confirmedCount}`,
      `Goles registrados: ${goals}`,
      assists > 0 ? `Asistencias: ${assists}` : "",
      mvp ? `MVP: ${mvp.name}` : "",
      "",
    ].filter(Boolean);
    if (scorers.length > 0) {
      lines.push("Goleadores:");
      scorers.forEach((row) => lines.push(`- ${row.name}: ${row.goals}`));
      lines.push("");
    }
    if (assisters.length > 0) {
      lines.push("Asistencias:");
      assisters.forEach((row) => lines.push(`- ${row.name}: ${row.assists}`));
    }
    return lines.join("\n").trim();
  }, [assisters, assists, confirmedCount, goals, match, mvp, scorers]);

  async function copySummary() {
    await copyToClipboard(summaryText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="post-match-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Post-partido</p>
          <h2>Resumen compartible</h2>
        </div>
        {copied && <span className="count-pill">Copiado</span>}
      </div>
      <div className="post-match-stats">
        <div><small>Asistencia</small><strong>{confirmedCount}</strong></div>
        <div><small>Goles</small><strong>{goals}</strong></div>
        <div><small>Asistencias</small><strong>{assists}</strong></div>
        <div><small>MVP</small><strong>{mvp?.name || "-"}</strong></div>
      </div>
      <textarea readOnly value={summaryText} />
      <button type="button" onClick={copySummary}>Copiar resumen</button>
    </div>
  );
}
