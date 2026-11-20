import { useMemo, useState } from "react";
import { CalendarClock, CheckCheck, HandCoins, MessageCircle, Pencil, PlusCircle, Receipt, Trophy, X } from "lucide-react";
import ExportCard from "../components/ExportCard.jsx";
import {
  CopyCollectionGroupLinkButton,
  CopyProofLinkButton,
  Empty,
  Kpis,
  Meter,
  Money,
  PaymentActions,
  PaymentChip,
  ProofReviewModal,
  ProofStatusBadge,
  Ring,
  Section,
  Segmented,
  StatusChip,
} from "../components/finance/FinanceBlocks.jsx";
import {
  collectionsWhatsappSummary,
  filterPaymentsByStatus,
  myPendingDebts,
  myProofPillLabel,
  sortPaymentsByName,
  summarizeCollections,
  summarizeMatchFee,
} from "../finance/financeModel.js";
import { displayName, formatMatchDate, formatMoney } from "../utils.js";

const STATUS_FILTERS = [["pending", "Pendientes"], ["paid", "Pagados"], ["forgiven", "Perdonados"], ["all", "Todos"]];

function dueLabel(dateStr) {
  return dateStr ? new Date(dateStr + "T12:00:00").toLocaleDateString("es-GT") : null;
}

function formatForDateTimeLocal(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Inline due-date editor shared by match fees (datetime) and collections (date). */
function DueEditor({ type, initial, onSave, onCancel }) {
  const [value, setValue] = useState(initial);
  return (
    <span className="fx-due-edit">
      <input type={type} value={value} onChange={(e) => setValue(e.target.value)} aria-label="Nueva fecha de vencimiento" />
      <button className="fx-icon is-approve" type="button" aria-label="Guardar vencimiento" onClick={() => onSave(value)}><CheckCheck size={16} aria-hidden="true" /></button>
      <button className="fx-icon is-reject" type="button" aria-label="Cancelar" onClick={onCancel}><X size={16} aria-hidden="true" /></button>
    </span>
  );
}

function PaymentRows({ payments, profileById, paymentType, onUpdatePayment, onOpenProof, select }) {
  return (
    <ul className="fx-pay-list">
      {payments.map((payment) => {
        const player = profileById.get(payment.profile_id);
        return (
          <li key={payment.id} className={`fx-pay st-${payment.status}`}>
            <span className="fx-pay-name">
              {select ? (
                <label className="fx-check">
                  <input type="checkbox" checked={select.selected.includes(payment.id)} onChange={() => select.toggle(payment.id)} />
                  <b>{displayName(player)}</b>
                </label>
              ) : <b>{displayName(player)}</b>}
              <ProofStatusBadge status={payment.proof_status} />
            </span>
            <PaymentChip payment={payment} />
            <PaymentActions payment={payment} paymentType={paymentType} onUpdatePayment={onUpdatePayment} onOpenProof={onOpenProof} />
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------- Match fees */

function MatchFeeCard({ match, fee, variant, profileById, onUpdatePayment, onUpdateMatchFee, onReviewProof }) {
  const [modalPayment, setModalPayment] = useState(null);
  const [editing, setEditing] = useState(false);
  const s = summarizeMatchFee(fee);
  const sortedPayments = sortPaymentsByName(fee.match_fee_payments || [], profileById);

  async function handleSaveFeeDueBefore(value) {
    try {
      await onUpdateMatchFee(fee.id, { due_before: value ? new Date(value).toISOString() : null });
      setEditing(false);
    } catch (err) {
      alert("Error al actualizar la fecha: " + err.message);
    }
  }

  const due = editing ? (
    <DueEditor type="datetime-local" initial={formatForDateTimeLocal(fee.due_before)} onSave={handleSaveFeeDueBefore} onCancel={() => setEditing(false)} />
  ) : (
    <span className="fx-due">
      <CalendarClock size={14} aria-hidden="true" />
      {fee.due_before
        ? `Vence el ${new Date(fee.due_before).toLocaleDateString("es-GT")} a las ${new Date(fee.due_before).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}`
        : "Sin fecha límite"}
      <button className="fx-icon is-ghost" type="button" title="Editar vencimiento" aria-label="Editar vencimiento" onClick={() => setEditing(true)}><Pencil size={14} aria-hidden="true" /></button>
    </span>
  );

  return (
    <article className={`fx-fee is-${variant}`} aria-label={`Cobro de cancha: ${match.title || "Partido"}`}>
      <header className="fx-fee-head">
        {variant === "command" && <Ring value={s.progress} label="Pagaron" caption={`${s.paid}/${s.total}`} />}
        <div className="fx-fee-title">
          <small>{formatMatchDate(match)}</small>
          <h3>{match.title || "Partido"}</h3>
          <p><b>{formatMoney(fee.per_player_amount)}</b> por jugador · {due}</p>
        </div>
        <dl className="fx-fee-nums">
          <div><dt>Cobrado</dt><dd>{formatMoney(s.collected)}</dd></div>
          <div><dt>Pagaron</dt><dd>{s.paid}/{s.total}</dd></div>
          {s.toReview > 0 && <div className="is-warn"><dt>Por revisar</dt><dd>{s.toReview}</dd></div>}
        </dl>
      </header>
      {variant !== "command" && <Meter value={s.progress} label={`${s.paid} de ${s.total} pagaron`} tone="accent" />}
      <PaymentRows payments={sortedPayments} profileById={profileById} paymentType="match_fee" onUpdatePayment={onUpdatePayment} onOpenProof={setModalPayment} />
      {modalPayment && (
        <ProofReviewModal
          payment={modalPayment}
          paymentType="match_fee"
          playerName={displayName(profileById.get(modalPayment.profile_id))}
          amount={fee.per_player_amount}
          onClose={() => setModalPayment(null)}
          onReview={onReviewProof}
        />
      )}
    </article>
  );
}

/* ------------------------------------------------------------- Collections */

function CollectionForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ title: "", description: "", amount_per_player: "", due_date: "" });
  const [error, setError] = useState("");
  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) { setError("El título es obligatorio."); return; }
    if (!form.amount_per_player || Number(form.amount_per_player) <= 0) { setError("El monto debe ser mayor a 0."); return; }
    await onSave({
      title: form.title.trim(),
      description: form.description.trim() || null,
      amount_per_player: Number(form.amount_per_player),
      due_date: form.due_date || null,
      status: "open",
    });
  }

  return (
    <form className="form-grid md-form fx-form fx-create" onSubmit={submit} aria-label="Nueva colaboración">
      {error && <p className="form-message" role="alert">{error}</p>}
      <label className="md-form-wide">
        Título
        <input placeholder="Ej. Balón nuevo, pago de cancha mensual" value={form.title} onChange={(e) => update({ title: e.target.value })} />
      </label>
      <label className="md-form-wide">
        Descripción
        <input placeholder="Opcional" value={form.description} onChange={(e) => update({ description: e.target.value })} />
      </label>
      <label>
        Monto por jugador (Q)
        <input min="1" step="1" type="number" inputMode="numeric" value={form.amount_per_player} onChange={(e) => update({ amount_per_player: e.target.value })} />
      </label>
      <label>
        Fecha límite
        <input type="date" value={form.due_date} onChange={(e) => update({ due_date: e.target.value })} />
      </label>
      <div className="md-form-actions">
        <button className="md-btn md-btn-ghost" type="button" onClick={onCancel}>Cancelar</button>
        <button className="md-btn md-btn-accent" type="submit">Crear colaboración</button>
      </div>
    </form>
  );
}

function CollectionCard({ summary, variant, statusFilter, profileById, onUpdateCollection, onUpdatePayment, onCloseCollection, onDeleteCollection, onReviewProof }) {
  const { col, payments, pending, paid, forgiven, progress, totalCollected } = summary;
  const [modalPayment, setModalPayment] = useState(null);
  const [selected, setSelected] = useState([]);
  const [editing, setEditing] = useState(false);
  const visiblePayments = sortPaymentsByName(filterPaymentsByStatus(payments, statusFilter), profileById);
  const isOpen = col.status === "open";

  async function handleSaveColDueDate(value) {
    try {
      await onUpdateCollection(col.id, { due_date: value || null });
      setEditing(false);
    } catch (err) {
      alert("Error al actualizar la fecha: " + err.message);
    }
  }

  function toggle(paymentId) {
    setSelected((cur) => (cur.includes(paymentId) ? cur.filter((id) => id !== paymentId) : [...cur, paymentId]));
  }

  async function markSelectedPaid() {
    if (selected.length === 0) return;
    await Promise.all(selected.map((id) => onUpdatePayment(id, { status: "paid" })));
    setSelected([]);
  }

  const due = isOpen ? (
    editing ? (
      <DueEditor type="date" initial={col.due_date || ""} onSave={handleSaveColDueDate} onCancel={() => setEditing(false)} />
    ) : (
      <span className="fx-due">
        <CalendarClock size={14} aria-hidden="true" />
        {col.due_date ? `Vence ${dueLabel(col.due_date)}` : "Sin fecha límite"}
        <button className="fx-icon is-ghost" type="button" title="Editar vencimiento" aria-label="Editar vencimiento" onClick={() => setEditing(true)}><Pencil size={14} aria-hidden="true" /></button>
      </span>
    )
  ) : col.due_date ? <span className="fx-due"><CalendarClock size={14} aria-hidden="true" />Vence {dueLabel(col.due_date)}</span> : null;

  return (
    <article className={`fx-fee fx-collection is-${variant} ${isOpen ? "" : "is-closed"}`} aria-label={`Colaboración: ${col.title}`}>
      <header className="fx-fee-head">
        {variant === "command" && <Ring value={progress} label="Pagaron" caption={`${paid.length}/${payments.length}`} />}
        <div className="fx-fee-title">
          <small>Colaboración {isOpen ? "" : "· cerrada"}</small>
          <h3>{col.title}</h3>
          {col.description && <p className="fx-desc">{col.description}</p>}
          <p><b>{formatMoney(col.amount_per_player)}</b> por jugador {due && <>· {due}</>}</p>
        </div>
        <dl className="fx-fee-nums">
          <div><dt>Recaudado</dt><dd>{formatMoney(totalCollected)}</dd></div>
          <div><dt>Estado</dt><dd>{isOpen ? `${paid.length}/${payments.length}` : <StatusChip tone="paid">Cerrada</StatusChip>}</dd></div>
        </dl>
      </header>
      {variant !== "command" && <Meter value={progress} label={`${paid.length} de ${payments.length} pagaron`} tone="accent" />}
      <p className="fx-breakdown">
        <span>Pendientes <b>{pending.length}</b></span>
        <span>Pagados <b>{paid.length}</b></span>
        <span>Perdonados <b>{forgiven.length}</b></span>
      </p>

      {isOpen && (
        <>
          {visiblePayments.length > 0 && (
            <div className="fx-batch">
              <CopyCollectionGroupLinkButton collection={col} />
              <button className="md-btn md-btn-ghost" type="button" onClick={() => setSelected(visiblePayments.map((p) => p.id))}>Seleccionar visibles</button>
              <button className="md-btn md-btn-accent" type="button" disabled={selected.length === 0} onClick={markSelectedPaid}>Marcar pagados ({selected.length})</button>
            </div>
          )}
          {visiblePayments.length === 0
            ? <Empty>No hay pagos con ese filtro.</Empty>
            : <PaymentRows payments={visiblePayments} profileById={profileById} paymentType="collection" onUpdatePayment={onUpdatePayment} onOpenProof={setModalPayment} select={{ selected, toggle }} />}
        </>
      )}

      <footer className="fx-fee-foot">
        {isOpen ? (
          <button className="md-btn md-btn-ghost" type="button" onClick={() => onCloseCollection(col.id)}>Cerrar colaboración</button>
        ) : (
          <button className="md-btn md-btn-ghost fx-danger-text" type="button" onClick={() => { if (confirm("¿Eliminar esta colaboración cerrada?")) onDeleteCollection(col.id); }}>Eliminar</button>
        )}
      </footer>

      {modalPayment && (
        <ProofReviewModal
          payment={modalPayment}
          paymentType="collection"
          playerName={displayName(profileById.get(modalPayment.profile_id))}
          amount={col.amount_per_player}
          onClose={() => setModalPayment(null)}
          onReview={onReviewProof}
        />
      )}
    </article>
  );
}

function CollectionsPanel({ variant, collections, profileById, onCreateCollection, ...handlers }) {
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("pending");
  const summaries = useMemo(() => summarizeCollections(collections, profileById), [collections, profileById]);
  const whatsappSummary = useMemo(() => collectionsWhatsappSummary(summaries), [summaries]);

  return (
    <Section
      title="Colaboraciones extra"
      icon={HandCoins}
      aside={<button className={`md-btn ${showForm ? "md-btn-ghost" : "md-btn-accent"}`} type="button" onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : <><PlusCircle size={15} aria-hidden="true" /> Nueva</>}</button>}
    >
      {showForm && (
        <CollectionForm
          onSave={async (payload) => { await onCreateCollection(payload); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}
      <div className="fx-toolbar">
        <Segmented label="Filtrar pagos" options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
      </div>
      {collections.length === 0 && !showForm && <Empty>No hay colaboraciones activas.</Empty>}
      <div className={`fx-fee-list is-${variant}`}>
        {summaries.map((summary) => (
          <CollectionCard key={summary.col.id} summary={summary} variant={variant} statusFilter={statusFilter} profileById={profileById} {...handlers} />
        ))}
      </div>
      <details className="fx-details">
        <summary><MessageCircle size={15} aria-hidden="true" /> Resumen para WhatsApp</summary>
        <ExportCard label="Resumen para WhatsApp" text={whatsappSummary} />
      </details>
    </Section>
  );
}

/* --------------------------------------------------------------- My fees */

function MyDebtRow({ title, meta, amount, payment, paymentType, extra }) {
  return (
    <li className="fx-debt">
      <span className="fx-debt-main">
        <b>{title}</b>
        {meta && <small>{meta}</small>}
        {extra}
        <ProofStatusBadge status={payment.proof_status} />
      </span>
      <Money value={amount} className="fx-debt-amt" />
      {payment.proof_status === "pending"
        ? <CopyProofLinkButton payment={payment} paymentType={paymentType} />
        : <StatusChip tone={payment.proof_status === "submitted" ? "review" : payment.proof_status === "approved" ? "paid" : "rejected"}>{myProofPillLabel(payment.proof_status)}</StatusChip>}
    </li>
  );
}

function MyFeesPanel({ variant, matchFees, collections, matches, profile }) {
  const { myMatchDebts, myCollectionDebts, totalDebt } = myPendingDebts({ matchFees, collections, matches, profileId: profile.id });
  const none = myMatchDebts.length === 0 && myCollectionDebts.length === 0;

  return (
    <div className={`fx-mine is-${variant}`} data-view="my-fees">
      {variant === "command" ? (
        <Kpis variant="command" items={[
          { label: "Total pendiente", value: <Money value={totalDebt} />, tone: totalDebt > 0 ? "warn" : "good" },
          { label: "Cobros de cancha", value: myMatchDebts.length },
          { label: "Colaboraciones", value: myCollectionDebts.length },
        ]} />
      ) : (
        <section className="fx-statement is-single" aria-label="Mi saldo">
          <div className={`is-total is-${totalDebt > 0 ? "warn" : "good"}`}><small>Total pendiente</small><Money value={totalDebt} /></div>
          <p className="fx-hint">{none ? "Estás al día con el grupo." : `${myMatchDebts.length} cobro(s) de cancha y ${myCollectionDebts.length} colaboración(es) pendientes. Usá “Link” para subir tu comprobante.`}</p>
        </section>
      )}

      {myMatchDebts.length > 0 && (
        <Section title="Cobros de cancha pendientes" icon={Trophy}>
          <ul className="fx-debts">
            {myMatchDebts.map(({ fee, payment, match }) => (
              <MyDebtRow
                key={fee.id}
                title={match?.title || "Partido"}
                meta={`${match ? formatMatchDate(match) : ""}${fee.due_before ? ` · vence ${new Date(fee.due_before).toLocaleDateString("es-GT")}` : ""}`}
                amount={fee.per_player_amount}
                payment={payment}
                paymentType="match_fee"
              />
            ))}
          </ul>
        </Section>
      )}

      {myCollectionDebts.length > 0 && (
        <Section title="Colaboraciones pendientes" icon={HandCoins}>
          <ul className="fx-debts">
            {myCollectionDebts.map(({ col, payment }) => (
              <MyDebtRow
                key={col.id}
                title={col.title}
                meta={[col.description, col.due_date ? `Vence ${dueLabel(col.due_date)}` : null].filter(Boolean).join(" · ")}
                amount={col.amount_per_player}
                payment={payment}
                paymentType="collection"
              />
            ))}
          </ul>
        </Section>
      )}

      {none && <Section title="Mis cobros" icon={Receipt}><Empty>No tenés cobros pendientes.</Empty></Section>}
    </div>
  );
}

/* ------------------------------------------------------------ Main export */

export default function FeesPage({
  variant = "editorial",
  collections,
  isAdmin,
  matchFees,
  matches,
  profile,
  profileById,
  onCreateCollection,
  onUpdateCollection,
  onUpdateCollectionPayment,
  onCloseCollection,
  onDeleteCollection,
  onUpdateMatchFee,
  onUpdateMatchFeePayment,
  onReviewProof,
}) {
  if (!isAdmin) {
    return <MyFeesPanel variant={variant} collections={collections} matchFees={matchFees} matches={matches} profile={profile} />;
  }

  // Admin: match fees per match + collections
  const matchesWithFees = matches
    .map((match) => ({ match, fee: matchFees.find((f) => f.match_id === match.id) || null }))
    .filter(({ fee }) => fee !== null);

  const feeStats = matchesWithFees.map(({ fee }) => ({ fee, s: summarizeMatchFee(fee) }));
  const pendingFeesAmount = feeStats.reduce((t, { fee, s }) => t + s.pending * Number(fee.per_player_amount || 0), 0);
  const toReview = feeStats.reduce((t, { s }) => t + s.toReview, 0)
    + (collections || []).reduce((t, c) => t + (c.collection_payments || []).filter((p) => p.proof_url && p.proof_status === "submitted").length, 0);
  const openCollections = (collections || []).filter((c) => c.status === "open").length;

  return (
    <div className={`fx-fees is-${variant}`} data-view="fees">
      <Kpis variant={variant} items={[
        { label: "Cuotas de cancha por cobrar", value: <Money value={pendingFeesAmount} />, tone: pendingFeesAmount > 0 ? "warn" : undefined },
        { label: "Comprobantes por revisar", value: toReview, tone: toReview > 0 ? "warn" : undefined },
        { label: "Colaboraciones abiertas", value: openCollections },
      ]} />

      <Section title="Cobros de cancha" icon={Trophy} aside={<span className="fx-count">{matchesWithFees.length} partidos</span>}>
        {matchesWithFees.length === 0 ? <Empty>No hay cuotas de cancha. Se generan al configurar el costo de un partido.</Empty> : (
          <div className={`fx-fee-list is-${variant}`}>
            {matchesWithFees.map(({ match, fee }) => (
              <MatchFeeCard
                key={match.id}
                match={match}
                fee={fee}
                variant={variant}
                profileById={profileById}
                onUpdatePayment={onUpdateMatchFeePayment}
                onUpdateMatchFee={onUpdateMatchFee}
                onReviewProof={onReviewProof}
              />
            ))}
          </div>
        )}
      </Section>

      <CollectionsPanel
        variant={variant}
        collections={collections}
        profileById={profileById}
        onCreateCollection={onCreateCollection}
        onUpdateCollection={onUpdateCollection}
        onUpdatePayment={onUpdateCollectionPayment}
        onCloseCollection={onCloseCollection}
        onDeleteCollection={onDeleteCollection}
        onReviewProof={onReviewProof}
      />
    </div>
  );
}
