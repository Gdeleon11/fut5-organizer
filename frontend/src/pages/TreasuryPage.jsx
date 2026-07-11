import { useState, useMemo } from "react";
import { formatMoney, classNames } from "../utils.js";

const CATEGORY_LABELS = {
  canchas: "⚽ Canchas",
  balones: "⚽ Balones",
  chalecos: "🎽 Chalecos",
  arbitraje: "🏁 Arbitraje",
  comida: "🍔 Comida/Bebida",
  otros: "🔧 Otros",
};

export default function TreasuryPage({
  isAdmin,
  activeGroupId,
  matches = [],
  attendances = [],
  fines = [],
  matchFees = [],
  collections = [],
  expenses = [],
  venues = [],
  onAddExpense,
  onDeleteExpense,
  profile,
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("otros");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visibleLedgerCount, setVisibleLedgerCount] = useState(8);

  // 1. Calculate Incomes
  const finesIncome = useMemo(() => {
    return fines
      .filter((f) => f.status === "paid")
      .reduce((sum, f) => sum + Number(f.amount || 0), 0);
  }, [fines]);

  const matchFeesIncome = useMemo(() => {
    return matchFees.reduce((sum, fee) => {
      const paidPaymentsCount = (fee.match_fee_payments || []).filter(
        (p) => p.status === "paid"
      ).length;
      return sum + paidPaymentsCount * Number(fee.per_player_amount || 0);
    }, 0);
  }, [matchFees]);

  const collectionsIncome = useMemo(() => {
    return (collections || []).reduce((sum, col) => {
      const paidPaymentsCount = (col.collection_payments || []).filter(
        (p) => p.status === "paid"
      ).length;
      return sum + paidPaymentsCount * Number(col.amount_per_player || 0);
    }, 0);
  }, [collections]);

  const totalIncome = useMemo(() => {
    return finesIncome + matchFeesIncome + collectionsIncome;
  }, [finesIncome, matchFeesIncome, collectionsIncome]);

  const pendingReceivables = useMemo(() => {
    const pendingFees = (matchFees || []).reduce((sum, fee) => {
      const pending = (fee.match_fee_payments || []).filter((p) => p.status === "pending").length;
      return sum + pending * Number(fee.per_player_amount || 0);
    }, 0);
    const pendingCollections = (collections || []).reduce((sum, col) => {
      const pending = (col.collection_payments || []).filter((p) => p.status === "pending").length;
      return sum + pending * Number(col.amount_per_player || 0);
    }, 0);
    const pendingFines = (fines || [])
      .filter((fine) => fine.status === "open")
      .reduce((sum, fine) => sum + Number(fine.amount || 0), 0);
    return pendingFees + pendingCollections + pendingFines;
  }, [collections, fines, matchFees]);

  // 2. Calculate Expenses
  const manualExpensesTotal = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  }, [expenses]);

  const courtCostsTotal = useMemo(() => {
    return matches
      .filter((m) => m.status === "closed")
      .reduce((sum, m) => sum + Number(m.court_cost || 0), 0);
  }, [matches]);

  const totalExpense = useMemo(() => {
    return manualExpensesTotal + courtCostsTotal;
  }, [manualExpensesTotal, courtCostsTotal]);

  const currentBalance = totalIncome - totalExpense;

  // 3. Compile transaction ledger history
  const ledgerHistory = useMemo(() => {
    const list = [];

    // Fines (Incomes)
    fines
      .filter((f) => f.status === "paid")
      .forEach((f) => {
        list.push({
          id: `fine-${f.id}`,
          type: "income",
          title: `Multa pagada - ${f.profiles?.full_name || "Jugador"}`,
          description: `Motivo: ${f.reason}`,
          amount: Number(f.amount || 0),
          date: f.created_at ? f.created_at.split("T")[0] : "",
        });
      });

    // Match fees (Incomes)
    matchFees.forEach((fee) => {
      const match = matches.find((m) => m.id === fee.match_id);
      const matchTitle = match ? match.title || "Partido" : "Partido";
      const matchDate = match ? match.match_date : "";

      (fee.match_fee_payments || [])
        .filter((p) => p.status === "paid")
        .forEach((p) => {
          list.push({
            id: `payment-${p.id}`,
            type: "income",
            title: `Cuota partido - ${p.profiles?.full_name || "Jugador"}`,
            description: `${matchTitle} (${matchDate})`,
            amount: Number(fee.per_player_amount || 0),
            date: p.created_at ? p.created_at.split("T")[0] : matchDate,
          });
        });
    });

    // Collections (Incomes)
    collections.forEach((col) => {
      (col.collection_payments || [])
        .filter((p) => p.status === "paid")
        .forEach((p) => {
          list.push({
            id: `collection-payment-${p.id}`,
            type: "income",
            title: `Colaboración - ${p.profiles?.full_name || "Jugador"}`,
            description: col.title || "Colaboración extra",
            amount: Number(col.amount_per_player || 0),
            date: p.created_at ? p.created_at.split("T")[0] : col.due_date || "",
          });
        });
    });

    // Concluded Match Court Costs (Expenses)
    matches
      .filter((m) => m.status === "closed" && Number(m.court_cost || 0) > 0)
      .forEach((m) => {
        list.push({
          id: `court-cost-${m.id}`,
          type: "expense",
          title: `Alquiler de cancha - ${m.title || "Partido"}`,
          description: `Sede: ${m.venue || "Cancha"}`,
          amount: Number(m.court_cost || 0),
          date: m.match_date || "",
        });
      });

    // Manual expenses (Expenses)
    expenses.forEach((exp) => {
      list.push({
        id: `expense-${exp.id}`,
        type: "expense",
        title: `Gasto: ${exp.description}`,
        description: `Categoría: ${CATEGORY_LABELS[exp.category] || exp.category}`,
        amount: Number(exp.amount || 0),
        date: exp.expense_date || "",
        isManual: true,
        rawId: exp.id,
      });
    });

    // Sort descending by date
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [collections, fines, matchFees, matches, expenses]);

  const categoryTotals = useMemo(() => {
    const totals = {
      canchas: courtCostsTotal,
      balones: 0,
      chalecos: 0,
      arbitraje: 0,
      comida: 0,
      otros: 0,
    };
    (expenses || []).forEach((exp) => {
      if (!exp) return;
      const cat = exp.category || "otros";
      if (totals[cat] !== undefined) {
        totals[cat] += Number(exp.amount || 0);
      } else {
        totals.otros += Number(exp.amount || 0);
      }
    });
    return totals;
  }, [courtCostsTotal, expenses]);

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
    <div className="page-grid">
      {/* Resumen de Caja Chica */}
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Caja Chica</p>
            <h2>Balance General del Grupo</h2>
          </div>
        </div>

        <div className="profile-summary" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
          <span>
            <strong style={{ color: "var(--emerald)" }}>{formatMoney(totalIncome)}</strong>
            <small>Ingresos Totales</small>
          </span>
          <span>
            <strong style={{ color: "var(--red)" }}>{formatMoney(totalExpense)}</strong>
            <small>Egresos Totales</small>
          </span>
          <span
            style={{
              background: currentBalance >= 0 ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
              borderRadius: "8px",
              padding: "0.25rem 0.5rem"
            }}
          >
            <strong style={{ color: currentBalance >= 0 ? "var(--emerald)" : "var(--red)" }}>
              {formatMoney(currentBalance)}
            </strong>
            <small>Saldo Disponible</small>
          </span>
        </div>

        <div className="finance-snapshot">
          <div>
            <small>Cobrado cancha</small>
            <strong>{formatMoney(matchFeesIncome)}</strong>
          </div>
          <div>
            <small>Colaboraciones</small>
            <strong>{formatMoney(collectionsIncome)}</strong>
          </div>
          <div>
            <small>Multas pagadas</small>
            <strong>{formatMoney(finesIncome)}</strong>
          </div>
          <div className={classNames(pendingReceivables > 0 && "is-warning")}>
            <small>Por cobrar</small>
            <strong>{formatMoney(pendingReceivables)}</strong>
          </div>
        </div>
      </section>

      {/* Distribución de Gastos */}
      {totalExpense > 0 && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Distribución de Egresos</h2>
              <small>Porcentaje del total de egresos ({formatMoney(totalExpense)})</small>
            </div>
          </div>
          <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
            {Object.entries(categoryTotals)
              .filter(([_, amount]) => amount > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([key, amount]) => {
                const percentage = Math.round((amount / totalExpense) * 100);
                return (
                  <div key={key}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                      <span>{CATEGORY_LABELS[key] || key}</span>
                      <strong>{formatMoney(amount)} ({percentage}%)</strong>
                    </div>
                    <div style={{ background: "var(--surface-3)", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                      <div
                        style={{
                          background: key === "canchas" ? "var(--primary)" : "var(--text-muted)",
                          height: "100%",
                          width: `${percentage}%`,
                          borderRadius: "4px",
                          transition: "width 0.5s ease-out"
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* Agregar Egreso (Solo Admin) */}
      {isAdmin && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Registrar Egreso Manual</h2>
              <small>Agrega gastos del grupo (ej: compra de balones, pago de árbitro).</small>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "1rem" }}>
              <div>
                <label className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.25rem", display: "block" }}>
                  Descripción del Gasto
                </label>
                <input
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej. Compra de 2 balones oficiales"
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.25rem", display: "block" }}>
                  Monto
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.25rem", display: "block" }}>
                  Categoría
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ width: "100%" }}
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.25rem", display: "block" }}>
                  Fecha
                </label>
                <input
                  required
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} style={{ marginTop: "0.5rem" }}>
              {isSubmitting ? "Registrando..." : "Guardar Egreso"}
            </button>
          </form>
        </section>
      )}

      {/* Historial de Transacciones (Ledger) */}
      <section className="panel">
        <div className="section-heading">
          <h2>Historial de Movimientos</h2>
          <span className="count-pill">{ledgerHistory.length} transacciones</span>
        </div>

        <div className="list">
          {ledgerHistory.length === 0 ? (
            <div className="empty-state compact">Aún no hay transacciones registradas.</div>
          ) : (
            ledgerHistory.slice(0, visibleLedgerCount).map((item) => {
              const isIncome = item.type === "income";
              return (
                <div
                  className="ledger-row"
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem 1rem",
                    borderBottom: "1px solid var(--border-light)",
                    gap: "1rem"
                  }}
                >
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", minWidth: 0 }}>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        fontSize: "1.1rem",
                        background: isIncome ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                        color: isIncome ? "var(--emerald)" : "var(--red)",
                        flexShrink: 0
                      }}
                    >
                      {isIncome ? "⬇" : "⬆"}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.title}
                      </strong>
                      <span className="muted" style={{ fontSize: "0.8rem", display: "block" }}>
                        {item.description}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          display: "block",
                          fontWeight: "bold",
                          color: isIncome ? "var(--emerald)" : "var(--red)"
                        }}
                      >
                        {isIncome ? "+" : "-"}{formatMoney(item.amount)}
                      </span>
                      <small className="muted" style={{ fontSize: "0.75rem" }}>
                        {item.date}
                      </small>
                    </div>

                    {isAdmin && item.isManual && (
                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => {
                          if (confirm(`¿Eliminar el egreso "${item.title}"?`)) {
                            onDeleteExpense(item.rawId);
                          }
                        }}
                        style={{
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.75rem",
                          height: "auto",
                          minHeight: "auto"
                        }}
                      >
                        Borrar
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {ledgerHistory.length > visibleLedgerCount && (
          <button
            className="show-more-btn"
            type="button"
            onClick={() => setVisibleLedgerCount((c) => c + 10)}
          >
            Ver más ({ledgerHistory.length - visibleLedgerCount} restantes)
          </button>
        )}
        {visibleLedgerCount > 8 && ledgerHistory.length <= visibleLedgerCount && (
          <button
            className="show-more-btn"
            type="button"
            onClick={() => setVisibleLedgerCount(8)}
          >
            Ver menos
          </button>
        )}
      </section>
    </div>
  );
}
