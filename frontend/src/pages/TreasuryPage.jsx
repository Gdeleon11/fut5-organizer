import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, BarChart3, BookOpen, PlusCircle, Trash2 } from "lucide-react";
import { CATEGORY_LABELS, expenseDistribution, treasuryLedger, treasurySummary } from "../finance/financeModel.js";
import { Empty, Kpis, Meter, Money, Ring, Section, Segmented } from "../components/finance/FinanceBlocks.jsx";
import { formatMoney } from "../utils.js";

const LEDGER_FILTERS = [["all", "Todos"], ["income", "Ingresos"], ["expense", "Egresos"]];

function monthLabel(date) {
  if (!date) return "Sin fecha";
  return new Date(date.slice(0, 7) + "-15T12:00:00").toLocaleDateString("es-GT", { month: "long", year: "numeric" });
}

function shortDate(date) {
  return date ? new Date(date + "T12:00:00").toLocaleDateString("es-GT", { day: "2-digit", month: "short" }) : "—";
}

function ExpenseForm({ onAddExpense }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("otros");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim() || !amount || Number(amount) <= 0) return;
    setIsSubmitting(true);
    try {
      await onAddExpense(description, Number(amount), category, expenseDate);
      setDescription("");
      setAmount("");
      setCategory("otros");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-grid md-form fx-form" aria-label="Registrar egreso manual">
      <label className="md-form-wide">
        Descripción del gasto
        <input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Compra de 2 balones oficiales" />
      </label>
      <label>
        Monto (Q)
        <input required type="number" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </label>
      <label>
        Fecha
        <input required type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
      </label>
      <label className="md-form-wide">
        Categoría
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <div className="md-form-actions">
        <button type="submit" className="md-btn md-btn-accent" disabled={isSubmitting}>{isSubmitting ? "Registrando…" : "Guardar egreso"}</button>
      </div>
    </form>
  );
}

function DeleteExpenseButton({ item, onDeleteExpense }) {
  return (
    <button
      className="fx-icon is-reject"
      type="button"
      title="Borrar egreso"
      aria-label={`Borrar ${item.title}`}
      onClick={() => { if (confirm(`¿Eliminar el egreso "${item.title}"?`)) onDeleteExpense(item.rawId); }}
    >
      <Trash2 size={15} aria-hidden="true" />
    </button>
  );
}

function LedgerPager({ total, visible, setVisible }) {
  return (
    <div className="fx-pager">
      {total > visible && <button className="md-btn md-btn-ghost" type="button" onClick={() => setVisible((c) => c + 10)}>Ver más ({total - visible} restantes)</button>}
      {visible > 8 && total <= visible && <button className="md-btn md-btn-ghost" type="button" onClick={() => setVisible(8)}>Ver menos</button>}
    </div>
  );
}

export default function TreasuryPage({
  variant = "editorial",
  summary: summaryProp,
  isAdmin,
  matches = [],
  fines = [],
  matchFees = [],
  collections = [],
  expenses = [],
  onAddExpense,
  onDeleteExpense,
}) {
  const [visibleLedgerCount, setVisibleLedgerCount] = useState(8);
  const [ledgerFilter, setLedgerFilter] = useState("all");

  const summary = useMemo(
    () => summaryProp || treasurySummary({ fines, matchFees, collections, expenses, matches }),
    [summaryProp, fines, matchFees, collections, expenses, matches],
  );
  const ledgerHistory = useMemo(
    () => treasuryLedger({ fines, matchFees, collections, expenses, matches }),
    [collections, fines, matchFees, matches, expenses],
  );
  const distribution = useMemo(
    () => (summary.totalExpense > 0 ? expenseDistribution(summary.categoryTotals, summary.totalExpense) : []),
    [summary],
  );

  const filtered = ledgerFilter === "all" ? ledgerHistory : ledgerHistory.filter((i) => i.type === ledgerFilter);
  const shown = filtered.slice(0, visibleLedgerCount);
  const balanceTone = summary.currentBalance >= 0 ? "good" : "bad";
  const incomeSources = [
    ["Cobrado cancha", summary.matchFeesIncome, "fees"],
    ["Colaboraciones", summary.collectionsIncome, "collections"],
    ["Multas pagadas", summary.finesIncome, "fines"],
  ];
  // Display-only ratio: what has been collected vs what is still owed. Not a money rule.
  const collectedShare = summary.totalIncome + summary.pendingReceivables > 0
    ? (summary.totalIncome / (summary.totalIncome + summary.pendingReceivables)) * 100
    : 0;

  const ledgerControls = (
    <>
      <Segmented label="Filtrar movimientos" options={LEDGER_FILTERS} value={ledgerFilter} onChange={(v) => { setLedgerFilter(v); setVisibleLedgerCount(8); }} />
      <span className="fx-count">{filtered.length} movimientos</span>
    </>
  );

  const distributionBlock = (
    <Section title="Distribución de egresos" icon={BarChart3} aside={summary.totalExpense > 0 ? <small>Total {formatMoney(summary.totalExpense)}</small> : null}>
      {distribution.length === 0 ? <Empty>Aún no hay egresos registrados.</Empty> : (
        <ul className="fx-bars">
          {distribution.map((d) => (
            <li key={d.key}>
              <span>{d.label}</span>
              <b>{formatMoney(d.amount)} <small>({d.percentage}%)</small></b>
              <Meter value={d.percentage} label={`${d.label} ${d.percentage}%`} tone={d.key === "canchas" ? "accent" : "muted"} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );

  const formBlock = isAdmin && (
    <Section title="Registrar egreso manual" icon={PlusCircle} className="fx-form-section">
      <p className="fx-hint">Gastos del grupo como balones, chalecos o arbitraje. Los alquileres de cancha entran solos al cerrar cada partido.</p>
      <ExpenseForm onAddExpense={onAddExpense} />
    </Section>
  );

  if (variant === "command") {
    return (
      <div className="fx-cc" data-view="treasury">
        <Kpis variant="command" items={[
          { label: "Saldo disponible", value: <Money value={summary.currentBalance} tone={balanceTone} />, tone: balanceTone, hint: "Ingresos − egresos" },
          { label: "Ingresos", value: <Money value={summary.totalIncome} />, hint: "Cuotas, colaboraciones y multas" },
          { label: "Egresos", value: <Money value={summary.totalExpense} />, hint: `Canchas ${formatMoney(summary.courtCostsTotal)}` },
          { label: "Por cobrar", value: <Money value={summary.pendingReceivables} />, tone: summary.pendingReceivables > 0 ? "warn" : undefined, hint: "Pendiente de jugadores" },
        ]} />

        <div className="fx-cc-grid">
          <Section title="Flujo de caja" icon={BarChart3} className="fx-cc-flow">
            <div className="fx-flow">
              <Ring value={collectedShare} label="Cobrado sobre total exigible" caption="cobrado" />
              <div className="fx-flow-bars">
                {incomeSources.map(([label, value, key]) => (
                  <div key={key}>
                    <span>{label}</span><b>{formatMoney(value)}</b>
                    <Meter value={summary.totalIncome ? (value / summary.totalIncome) * 100 : 0} label={label} tone="accent" />
                  </div>
                ))}
                <div className="is-split">
                  <span>Ingresos vs egresos</span>
                  <span className="fx-vs" aria-label={`Ingresos ${formatMoney(summary.totalIncome)}, egresos ${formatMoney(summary.totalExpense)}`}>
                    <i className="in" style={{ flexGrow: Math.max(summary.totalIncome, 0.0001) }} />
                    <i className="out" style={{ flexGrow: Math.max(summary.totalExpense, 0.0001) }} />
                  </span>
                </div>
              </div>
            </div>
          </Section>
          {distributionBlock}
        </div>

        <Section title="Movimientos" icon={BookOpen} aside={ledgerControls}>
          {shown.length === 0 ? <Empty>Aún no hay transacciones registradas.</Empty> : (
            <ul className="fx-feed">
              {shown.map((item) => (
                <li key={item.id} className={`is-${item.type}`}>
                  <span className="fx-feed-ico" aria-hidden="true">{item.type === "income" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
                  <span className="fx-feed-main"><b>{item.title}</b><small>{item.description}</small></span>
                  <span className="fx-feed-amt"><Money value={item.amount} signed={item.type} tone={item.type === "income" ? "good" : "bad"} /><small>{shortDate(item.date)}</small></span>
                  {isAdmin && item.isManual ? <DeleteExpenseButton item={item} onDeleteExpense={onDeleteExpense} /> : <span />}
                </li>
              ))}
            </ul>
          )}
          <LedgerPager total={filtered.length} visible={visibleLedgerCount} setVisible={setVisibleLedgerCount} />
        </Section>

        {formBlock}
      </div>
    );
  }

  // Editorial: balance statement + ledger table, side column with distribution and form.
  let lastMonth = null;
  return (
    <div className="fx-ed" data-view="treasury">
      <section className="fx-statement" aria-label="Balance general del grupo">
        <div><small>Ingresos totales</small><Money value={summary.totalIncome} /></div>
        <div><small>Egresos totales</small><Money value={summary.totalExpense} /></div>
        <div className={`is-total is-${balanceTone}`}><small>Saldo disponible</small><Money value={summary.currentBalance} tone={balanceTone} /></div>
      </section>
      <dl className="fx-leaders">
        {incomeSources.map(([label, value, key]) => <div key={key}><dt>{label}</dt><dd>{formatMoney(value)}</dd></div>)}
        <div className={summary.pendingReceivables > 0 ? "is-warn" : ""}><dt>Por cobrar</dt><dd>{formatMoney(summary.pendingReceivables)}</dd></div>
      </dl>

      <div className="fx-ed-cols">
        <Section title="Libro de movimientos" icon={BookOpen} aside={ledgerControls} className="fx-ledger-section">
          {shown.length === 0 ? <Empty>Aún no hay transacciones registradas.</Empty> : (
            <table className="fx-table fx-ledger">
              <thead><tr><th scope="col">Fecha</th><th scope="col">Concepto</th><th scope="col" className="num">Monto</th>{isAdmin && <th scope="col"><span className="sr-only">Acciones</span></th>}</tr></thead>
              <tbody>
                {shown.map((item) => {
                  const m = monthLabel(item.date);
                  const header = m !== lastMonth;
                  lastMonth = m;
                  return [
                    header && <tr key={`${item.id}-m`} className="fx-month"><th colSpan={isAdmin ? 4 : 3} scope="rowgroup">{m}</th></tr>,
                    <tr key={item.id} className={`is-${item.type}`}>
                      <td className="fx-date">{shortDate(item.date)}</td>
                      <td><b>{item.title}</b><small>{item.description}</small></td>
                      <td className="num"><Money value={item.amount} signed={item.type} tone={item.type === "income" ? "good" : "bad"} /></td>
                      {isAdmin && <td className="fx-row-act">{item.isManual && <DeleteExpenseButton item={item} onDeleteExpense={onDeleteExpense} />}</td>}
                    </tr>,
                  ];
                })}
              </tbody>
            </table>
          )}
          <LedgerPager total={filtered.length} visible={visibleLedgerCount} setVisible={setVisibleLedgerCount} />
        </Section>
        <aside className="fx-ed-side">
          {distributionBlock}
          {formBlock}
        </aside>
      </div>
    </div>
  );
}
