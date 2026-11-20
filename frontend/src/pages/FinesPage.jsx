import { useState } from "react";
import { AlertTriangle, PlusCircle } from "lucide-react";
import { Empty, Kpis, Money, Section, Segmented, StatusChip } from "../components/finance/FinanceBlocks.jsx";
import { DATE_RANGES, fineTotals, visibleFinesFor } from "../finance/financeModel.js";
import { displayName, fineLabel, fineReasonLabel, formatMatchDate } from "../utils.js";

const CUSTOM_FINE_REASONS = [
  { id: "custom", label: "Otra multa" },
  { id: "damaged_equipment", label: "Equipo dañado" },
  { id: "late_arrival", label: "Llegó tarde" },
  { id: "other", label: "Otro motivo" },
];

const FINE_TONE = { open: "pending", paid: "paid", forgiven: "forgiven" };

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
    <form className="form-grid md-form fx-form fx-create" onSubmit={submit} aria-label="Nueva multa">
      {error && <p className="form-message" role="alert">{error}</p>}
      <label>
        Jugador
        <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
          <option value="">Seleccionar jugador</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{displayName(p)}</option>)}
        </select>
      </label>
      <label>
        Motivo
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {CUSTOM_FINE_REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </label>
      {reason === "custom" && (
        <label className="md-form-wide">
          Motivo personalizado
          <input placeholder="Ej. Rompió el balón" value={customReason} onChange={(e) => setCustomReason(e.target.value)} />
        </label>
      )}
      <label>
        Monto (Q)
        <input min="1" step="1" type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <div className="md-form-actions">
        <button className="md-btn md-btn-ghost" type="button" onClick={onCancel}>Cancelar</button>
        <button className="md-btn md-btn-accent" type="submit">Crear multa</button>
      </div>
    </form>
  );
}

export default function FinesPage({
  variant = "editorial",
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

  const visibleFines = visibleFinesFor({ fines, isAdmin, profileId: profile?.id, range: dateRange });
  const totals = fineTotals(visibleFines);

  const kpis = [
    { label: "Saldo pendiente", value: <Money value={totals.openTotal} />, tone: totals.openTotal > 0 ? "warn" : undefined },
    { label: "Multas abiertas", value: totals.open },
    { label: "Pagadas", value: totals.paid },
  ];

  const actions = (fine) => isAdmin && fine.status === "open" && (
    <span className="fx-actions">
      <button className="md-btn md-btn-accent fx-btn-sm" type="button" onClick={() => onPay(fine)}>Marcar pagada</button>
      <button className="md-btn md-btn-ghost fx-btn-sm" type="button" onClick={() => onForgive(fine)}>Perdonar</button>
    </span>
  );

  const titleOf = (fine) => (isAdmin ? displayName(profileById.get(fine.profile_id)) : fineReasonLabel(fine.reason));
  const metaOf = (fine) => {
    const match = matchById.get(fine.match_id);
    return `${fineReasonLabel(fine.reason)}${match ? ` · ${formatMatchDate(match)}` : ""}`;
  };

  return (
    <div className={`fx-fines is-${variant}`} data-view="fines">
      <Kpis variant={variant} items={kpis} />

      <Section
        title={isAdmin ? "Libro de multas" : "Mis multas"}
        icon={AlertTriangle}
        aside={isAdmin && (
          <button className={`md-btn ${showForm ? "md-btn-ghost" : "md-btn-accent"}`} type="button" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancelar" : <><PlusCircle size={15} aria-hidden="true" /> Multa</>}
          </button>
        )}
      >
        {showForm && (
          <CustomFineForm
            profiles={profiles}
            groupId={activeGroupId}
            onCreate={async (payload) => { await onCreateFine(payload); setShowForm(false); }}
            onCancel={() => setShowForm(false)}
          />
        )}
        <div className="fx-toolbar">
          <Segmented label="Rango de fechas" options={DATE_RANGES.map((r) => [r.id, r.label])} value={dateRange} onChange={setDateRange} />
          <span className="fx-count">{visibleFines.length} multas</span>
        </div>

        {visibleFines.length === 0 ? <Empty>No hay multas.</Empty> : variant === "command" ? (
          <ul className="fx-fine-grid">
            {visibleFines.map((fine) => (
              <li key={fine.id} className={`fx-fine st-${fine.status}`}>
                <span className="fx-fine-top"><b>{titleOf(fine)}</b><StatusChip tone={FINE_TONE[fine.status] || "pending"}>{fineLabel(fine.status)}</StatusChip></span>
                <small>{metaOf(fine)}</small>
                <span className="fx-fine-foot"><Money value={fine.amount} className="fx-fine-amt" />{actions(fine)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <table className="fx-table fx-fines-table">
            <thead><tr><th scope="col">{isAdmin ? "Jugador" : "Motivo"}</th><th scope="col">Estado</th><th scope="col" className="num">Monto</th>{isAdmin && <th scope="col"><span className="sr-only">Acciones</span></th>}</tr></thead>
            <tbody>
              {visibleFines.map((fine) => (
                <tr key={fine.id} className={`st-${fine.status}`}>
                  <td><b>{titleOf(fine)}</b><small>{metaOf(fine)}</small></td>
                  <td><StatusChip tone={FINE_TONE[fine.status] || "pending"}>{fineLabel(fine.status)}</StatusChip></td>
                  <td className="num"><Money value={fine.amount} /></td>
                  {isAdmin && <td className="fx-row-act">{actions(fine)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
