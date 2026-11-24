/**
 * "Mi partido" summary on the match page. Official stats come only from the Postpartido flow
 * (validated events): this card shows them read-only and points to the place where you report data.
 */
export default function SelfStatsCard({ match, profile, matchStats }) {
  const mine = (matchStats || []).find((s) => s.match_id === match?.id && s.player_id === profile?.id) || null;
  const goTo = () => document.getElementById("postpartido")?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <section className="self-performance" data-self-stats>
      <header className="section-heading">
        <div><p className="eyebrow">Rendimiento individual</p><h3>Mi partido</h3></div>
        {mine && <span className="count-pill">Oficial</span>}
      </header>
      {mine ? (
        <p className="muted">{mine.goals || 0} goles · {mine.assists || 0} asistencias{mine.clean_sheet ? " · valla invicta" : ""}{mine.mvp ? " · MVP" : ""}</p>
      ) : (
        <p className="muted">Todavía no hay datos oficiales tuyos en este partido.</p>
      )}
      <button type="button" className="secondary-button" onClick={goTo}>Cargar o corregir en el Postpartido</button>
    </section>
  );
}
