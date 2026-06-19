import Stat from "../components/Stat.jsx";
import { fineLabel, fineReasonLabel, formatMatchDate, formatMoney } from "../utils.js";
import { classNames, displayName } from "../utils.js";

export default function FinesPage({
  fines,
  isAdmin,
  matches,
  onForgive,
  onPay,
  profileById,
}) {
  const openTotal = fines
    .filter((fine) => fine.status === "open")
    .reduce((total, fine) => total + Number(fine.amount || 0), 0);
  const matchById = new Map(matches.map((match) => [match.id, match]));

  return (
    <div className="page-grid">
      <section className="stat-grid">
        <Stat label="Saldo pendiente" value={formatMoney(openTotal)} />
        <Stat
          label="Multas abiertas"
          value={fines.filter((fine) => fine.status === "open").length}
        />
        <Stat
          label="Pagadas"
          value={fines.filter((fine) => fine.status === "paid").length}
        />
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>{isAdmin ? "Libro de multas" : "Mis multas"}</h2>
          <span className="count-pill">{fines.length}</span>
        </div>
        <div className="ledger-list">
          {fines.length === 0 ? (
            <div className="empty-state compact">No hay multas.</div>
          ) : (
            fines.map((fine) => {
              const player = profileById.get(fine.profile_id);
              const match = matchById.get(fine.match_id);
              const settled = fine.status !== "open";

              return (
                <article className="ledger-row" key={fine.id}>
                  <div>
                    <strong>
                      {isAdmin
                        ? displayName(player)
                        : fineReasonLabel(fine.reason)}
                    </strong>
                    <small>
                      {fineReasonLabel(fine.reason)}
                      {match ? ` · ${formatMatchDate(match)}` : ""}
                    </small>
                  </div>
                  <div className="ledger-meta">
                    <span className="fine-amount">{formatMoney(fine.amount)}</span>
                    <span
                      className={classNames(
                        "status-pill",
                        fine.status === "paid" && "is-paid",
                        fine.status === "forgiven" && "is-forgiven",
                      )}
                    >
                      {fineLabel(fine.status)}
                    </span>
                  </div>
                  {isAdmin && !settled && (
                    <div className="button-row ledger-actions">
                      <button type="button" onClick={() => onPay(fine)}>
                        Marcar pagada
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => onForgive(fine)}
                      >
                        Perdonar
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
