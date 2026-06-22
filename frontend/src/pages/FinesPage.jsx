import { useState } from "react";
import Stat from "../components/Stat.jsx";
import SectionBanner from "../components/SectionBanner.jsx";
import { fineLabel, fineReasonLabel, formatMatchDate, formatMoney } from "../utils.js";
import { classNames, displayName } from "../utils.js";

const DATE_RANGES = [
  { id: "all", label: "Todas" },
  { id: "week", label: "Última semana" },
  { id: "month", label: "Último mes" },
  { id: "3months", label: "Últimos 3 meses" },
];

const CUSTOM_FINE_REASONS = [
  { id: "custom", label: "Otra multa" },
  { id: "damaged_equipment", label: "Equipo dañado" },
  { id: "late_arrival", label: "Llegó tarde" },
  { id: "other", label: "Otro motivo" },
];

function filterByDateRange(fines, range) {
  if (range === "all") return fines;
  const now = new Date();
  const cutoff = new Date();
  if (range === "week") cutoff.setDate(now.getDate() - 7);
  else if (range === "month") cutoff.setMonth(now.getMonth() - 1);
  else if (range === "3months") cutoff.setMonth(now.getMonth() - 3);
  return fines.filter((f) => new Date(f.created_at) >= cutoff);
}

function CustomFineForm({ profiles, groupId, onCreate, onCancel }) {
  const [profileId, setProfileId] = useState("");
  const [reason, setReason] = useState("custom");
  const [customReason, setCustomReason] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!profileId) { setError("Seleccioná un jugador."); return; }
    if (!amount || Number(amount) <= 0) { setError("El monto debe ser mayor a 0."); return; }
    const finalReason = reason === "custom" ? customReason.trim() || "Multa especial" : reason;
    await onCreate({
      group_id: groupId,
      profile_id: profileId,
      reason: finalReason,
      amount: Number(amount),
      status: "open",
    });
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      {error && <p className="form-message">{error}</p>}
      <label>
        Jugador
        <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
          <option value="">Seleccionar jugador</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{displayName(p)}</option>
          ))}
        </select>
      </label>
      <label>
        Motivo
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {CUSTOM_FINE_REASONS.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
      </label>
      {reason === "custom" && (
        <label>
          Moto personalizado
          <input
            placeholder="Ej. Rompió el balón"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
          />
        </label>
      )}
      <label>
        Monto (Q)
        <input
          min="1"
          step="1"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <button type="submit">Crear multa</button>
      <button className="secondary-button" type="button" onClick={onCancel}>
        Cancelar
      </button>
    </form>
  );
}

export default function FinesPage({
  fines,
  isAdmin,
  matches,
  onForgive,
  onPay,
  onCreateFine,
  profileById,
  profile,
  profiles,
  activeGroupId,
}) {
  const [dateRange, setDateRange] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const matchById = new Map(matches.map((match) => [match.id, match]));

  const visibleFines = isAdmin
    ? filterByDateRange(fines, dateRange)
    : filterByDateRange(
        fines.filter((f) => f.profile_id === profile?.id),
        dateRange,
      );

  const openTotal = visibleFines
    .filter((fine) => fine.status === "open")
    .reduce((total, fine) => total + Number(fine.amount || 0), 0);

  return (
    <div className="page-grid">
      <SectionBanner section="multas" />
      <section className="stat-grid">
        <Stat label="Saldo pendiente" value={formatMoney(openTotal)} />
        <Stat
          label="Multas abiertas"
          value={visibleFines.filter((fine) => fine.status === "open").length}
        />
        <Stat
          label="Pagadas"
          value={visibleFines.filter((fine) => fine.status === "paid").length}
        />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>{isAdmin ? "Libro de multas" : "Mis multas"}</h2>
            <div className="date-range-filter">
              {DATE_RANGES.map((range) => (
                <button
                  className={dateRange === range.id ? "" : "secondary-button"}
                  key={range.id}
                  type="button"
                  onClick={() => setDateRange(range.id)}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
          <div className="button-row">
            <span className="count-pill">{visibleFines.length}</span>
            {isAdmin && (
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowForm((v) => !v)}
              >
                {showForm ? "Cancelar" : "+ Multa"}
              </button>
            )}
          </div>
        </div>

        {showForm && (
          <CustomFineForm
            profiles={profiles}
            groupId={activeGroupId}
            onCreate={async (payload) => {
              const fine = await onCreateFine(payload);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        <div className="ledger-list">
          {visibleFines.length === 0 ? (
            <div className="empty-state compact">No hay multas.</div>
          ) : (
            visibleFines.map((fine) => {
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
