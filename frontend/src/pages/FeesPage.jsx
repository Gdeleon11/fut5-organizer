import { useMemo, useState } from "react";
import { Check, X, Link as LinkIcon, FileText } from "lucide-react";
import ExportCard from "../components/ExportCard.jsx";
import Stat from "../components/Stat.jsx";
import { api } from "../api.js";
import { classNames, displayName, formatMatchDate, formatMoney } from "../utils.js";

// ---------------------------------------------------------------------------
// Proof status badge
// ---------------------------------------------------------------------------

function ProofStatusBadge({ status }) {
  if (!status || status === "pending") return null;

  const labels = {
    submitted: "Comprobante enviado",
    approved: "Comprobante aprobado",
    rejected: "Comprobante rechazado",
  };

  return (
    <span className={`proof-status status-${status}`}>
      {labels[status] || status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Copy link button
// ---------------------------------------------------------------------------

function CopyProofLinkButton({ payment, paymentType, disabled }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    try {
      const tokenData = {
        pid: payment.id,
        uid: payment.profile_id,
        type: paymentType,
        gid: payment.group_id,
      };
      const token = btoa(JSON.stringify(tokenData));
      const proofUrl = `${window.location.origin}/proof/${token}`;

      navigator.clipboard.writeText(proofUrl)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch((err) => {
          console.error("Clipboard write failed:", err);
          alert("Error al generar el enlace. Intentá de nuevo.");
        });
    } catch (err) {
      console.error("Error generating proof link:", err);
      alert("Error al generar el enlace. Intentá de nuevo.");
    }
  }

  return (
    <button
      className="fee-btn-icon"
      type="button"
      onClick={handleCopy}
      disabled={disabled}
      title="Copiar link"
    >
      <LinkIcon />
      {copied ? "✓" : "Copiar"}
    </button>
  );
}

function CopyCollectionGroupLinkButton({ collection }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    try {
      const tokenData = {
        cid: collection.id,
        gid: collection.group_id,
        type: "collection_group",
      };
      const token = btoa(JSON.stringify(tokenData));
      const proofUrl = `${window.location.origin}/proof/${token}`;
      const text = [
        "COBRO F5MANAGER",
        "",
        collection.title,
        `Monto: ${formatMoney(collection.amount_per_player)}`,
        collection.due_date
          ? `Vence: ${new Date(collection.due_date + "T12:00:00").toLocaleDateString("es-GT")}`
          : "",
        "",
        "Subí tu comprobante aquí:",
        proofUrl,
      ].filter(Boolean).join("\n");

      navigator.clipboard.writeText(text)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch((err) => {
          console.error("Clipboard write failed:", err);
          alert("Error al generar el enlace. Intentá de nuevo.");
        });
    } catch (err) {
      console.error("Error generating collection link:", err);
      alert("Error al generar el enlace. Intentá de nuevo.");
    }
  }

  return (
    <button
      className="secondary-button"
      type="button"
      onClick={handleCopy}
    >
      {copied ? "Link copiado" : "Link general"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Proof review modal (admin)
// ---------------------------------------------------------------------------

function ProofReviewModal({ payment, paymentType, onClose, onReview }) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewing, setReviewing] = useState(false);

  async function handleApprove() {
    try {
      setReviewing(true);
      await onReview(payment.id, paymentType, "approved");
      onClose();
    } catch (err) {
      alert("Error al aprobar: " + err.message);
    } finally {
      setReviewing(false);
    }
  }

  async function handleReject() {
    try {
      setReviewing(true);
      await onReview(payment.id, paymentType, "rejected", rejectReason || null);
      onClose();
    } catch (err) {
      alert("Error al rechazar: " + err.message);
    } finally {
      setReviewing(false);
    }
  }

  return (
    <div className="proof-modal-overlay" onClick={onClose}>
      <div className="proof-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="proof-modal-close" type="button" onClick={onClose}>
          ×
        </button>

        <img src={payment.proof_url} alt="Comprobante de pago" />

        <div className="proof-review-actions">
          {!showRejectForm ? (
            <>
              <button
                className="approve-btn"
                type="button"
                onClick={handleApprove}
                disabled={reviewing}
              >
                {reviewing ? "Procesando..." : "Aprobar"}
              </button>
              <button
                className="secondary-button reject-btn"
                type="button"
                onClick={() => setShowRejectForm(true)}
                disabled={reviewing}
              >
                Rechazar
              </button>
            </>
          ) : (
            <div className="proof-reject-form">
              <input
                type="text"
                placeholder="Motivo del rechazo (opcional)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="button-row">
                <button
                  className="reject-btn"
                  type="button"
                  onClick={handleReject}
                  disabled={reviewing}
                >
                  {reviewing ? "Procesando..." : "Confirmar rechazo"}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setShowRejectForm(false)}
                  disabled={reviewing}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match fee panel — court cost for a specific match
// ---------------------------------------------------------------------------

function MatchFeePanel({
  fee,
  profileById,
  isAdmin,
  onUpdatePayment,
  onUpdateMatchFee,
  onReviewProof,
}) {
  const [modalPayment, setModalPayment] = useState(null);
  const [editingFeeId, setEditingFeeId] = useState(null);
  const [newFeeDueBefore, setNewFeeDueBefore] = useState("");

  const formatForDateTimeLocal = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  async function handleSaveFeeDueBefore(feeId) {
    try {
      await onUpdateMatchFee(feeId, { due_before: newFeeDueBefore ? new Date(newFeeDueBefore).toISOString() : null });
      setEditingFeeId(null);
    } catch (err) {
      alert("Error al actualizar la fecha: " + err.message);
    }
  }

  if (!fee) return null;

  const payments = fee.match_fee_payments || [];
  const sortedPayments = [...payments].sort((a, b) => {
    const nameA = displayName(profileById.get(a.profile_id)) || "";
    const nameB = displayName(profileById.get(b.profile_id)) || "";
    return nameA.localeCompare(nameB);
  });
  const paidCount = payments.filter((p) => p.status === "paid").length;

  return (
    <div className="detail-section">
      <div className="section-heading">
        <div>
          <h2>Costo de cancha</h2>
          <small>
            {formatMoney(fee.per_player_amount)} por jugador ·{" "}
            {isAdmin ? (
              editingFeeId === fee.id ? (
                <span className="edit-due-date-form">
                  <input
                    type="datetime-local"
                    value={newFeeDueBefore}
                    onChange={(e) => setNewFeeDueBefore(e.target.value)}
                  />
                  <button className="fee-btn-icon is-primary" type="button" onClick={() => handleSaveFeeDueBefore(fee.id)}>✓</button>
                  <button className="fee-btn-icon is-danger" type="button" onClick={() => setEditingFeeId(null)}>×</button>
                </span>
              ) : (
                <>
                  {fee.due_before
                    ? `vence el ${new Date(fee.due_before).toLocaleDateString("es-GT")} a las ${new Date(fee.due_before).toLocaleTimeString("es-GT", { hour: '2-digit', minute: '2-digit' })}`
                    : "sin fecha límite"}
                  <button
                    className="edit-due-btn"
                    type="button"
                    onClick={() => {
                      setEditingFeeId(fee.id);
                      setNewFeeDueBefore(formatForDateTimeLocal(fee.due_before));
                    }}
                    title="Editar vencimiento"
                  >
                    ✏️
                  </button>
                </>
              )
            ) : (
              fee.due_before
                ? `antes del ${new Date(fee.due_before).toLocaleDateString("es-GT")}`
                : "sin fecha límite"
            )}
          </small>
        </div>
        <span className="count-pill">
          {paidCount}/{payments.length} pagaron
        </span>
      </div>
      <div className="player-list">
        {sortedPayments.map((payment) => {
          const player = profileById.get(payment.profile_id);
          const proofStatus = payment.proof_status;
          const hasProof = payment.proof_url;

          return (
            <div className="fee-player-row" key={payment.id}>
              <div>
                <strong>{displayName(player)}</strong>
                <small>
                  {payment.status === "paid"
                    ? "Pagó"
                    : payment.status === "forgiven"
                      ? "Perdonado"
                      : proofStatus === "submitted"
                        ? "Esperando revisión"
                        : proofStatus === "approved"
                          ? "Comprobante aprobado"
                          : proofStatus === "rejected"
                            ? "Comprobante rechazado"
                            : "Pendiente"}
                </small>
                <ProofStatusBadge status={proofStatus} />
              </div>

              <div className="fee-actions">
                {isAdmin && payment.status === "pending" && (
                  <>
                    <button
                      className="fee-btn-icon is-primary"
                      type="button"
                      onClick={() => onUpdatePayment(payment.id, { status: "paid" })}
                    >
                      <Check /> Pagó
                    </button>
                    <button
                      className="fee-btn-icon is-danger"
                      type="button"
                      onClick={() =>
                        onUpdatePayment(payment.id, { status: "forgiven" })
                      }
                    >
                      <X /> Perdonar
                    </button>
                  </>
                )}

                {isAdmin && hasProof && proofStatus === "submitted" && (
                  <button
                    className="fee-btn-icon"
                    type="button"
                    onClick={() => setModalPayment(payment)}
                  >
                    <FileText /> Ver comp.
                  </button>
                )}

                {isAdmin && !hasProof && payment.status === "pending" && (
                  <CopyProofLinkButton
                    payment={payment}
                    paymentType="match_fee"
                  />
                )}

                {payment.status !== "pending" && !isAdmin && (
                  <span
                    className={classNames(
                      "status-pill",
                      payment.status === "paid" && "is-paid",
                      payment.status === "forgiven" && "is-forgiven",
                    )}
                  >
                    {payment.status === "paid" ? "Pagado" : "Perdonado"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modalPayment && (
        <ProofReviewModal
          payment={modalPayment}
          paymentType="match_fee"
          onClose={() => setModalPayment(null)}
          onReview={onReviewProof}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collection form
// ---------------------------------------------------------------------------

function CollectionForm({ onSave, onCancel }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    amount_per_player: "",
    due_date: "",
  });
  const [error, setError] = useState("");

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) {
      setError("El título es obligatorio.");
      return;
    }
    if (!form.amount_per_player || Number(form.amount_per_player) <= 0) {
      setError("El monto debe ser mayor a 0.");
      return;
    }
    await onSave({
      title: form.title.trim(),
      description: form.description.trim() || null,
      amount_per_player: Number(form.amount_per_player),
      due_date: form.due_date || null,
      status: "open",
    });
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      {error && <p className="form-message">{error}</p>}
      <label>
        Título
        <input
          placeholder="Ej. Balón nuevo, pago de cancha mensual"
          value={form.title}
          onChange={(e) => update({ title: e.target.value })}
        />
      </label>
      <label>
        Descripción
        <input
          placeholder="Opcional"
          value={form.description}
          onChange={(e) => update({ description: e.target.value })}
        />
      </label>
      <label>
        Monto por jugador (Q)
        <input
          min="1"
          step="1"
          type="number"
          value={form.amount_per_player}
          onChange={(e) => update({ amount_per_player: e.target.value })}
        />
      </label>
      <label>
        Fecha límite
        <input
          type="date"
          value={form.due_date}
          onChange={(e) => update({ due_date: e.target.value })}
        />
      </label>
      <button type="submit">Crear colaboración</button>
      <button className="secondary-button" type="button" onClick={onCancel}>
        Cancelar
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Collections panel
// ---------------------------------------------------------------------------

function CollectionsPanel({
  collections,
  profileById,
  isAdmin,
  onCreateCollection,
  onUpdateCollection,
  onUpdatePayment,
  onCloseCollection,
  onDeleteCollection,
  onReviewProof,
}) {
  const [showForm, setShowForm] = useState(false);
  const [modalPayment, setModalPayment] = useState(null);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selectedPayments, setSelectedPayments] = useState({});
  const [editingColId, setEditingColId] = useState(null);
  const [newColDueDate, setNewColDueDate] = useState("");

  async function handleSaveColDueDate(colId) {
    try {
      await onUpdateCollection(colId, { due_date: newColDueDate || null });
      setEditingColId(null);
    } catch (err) {
      alert("Error al actualizar la fecha: " + err.message);
    }
  }

  const collectionSummaries = useMemo(() => {
    console.log("collections loaded in FeesPage:", collections);
    return (collections || []).map((col) => {
      const payments = col.collection_payments || [];
      const pending = payments.filter((p) => p.status === "pending");
      const paid = payments.filter((p) => p.status === "paid");
      const forgiven = payments.filter((p) => p.status === "forgiven");
      const pendingNames = pending
        .map((p) => displayName(profileById.get(p.profile_id)))
        .sort((a, b) => a.localeCompare(b));
      const progress = payments.length ? Math.round((paid.length / payments.length) * 100) : 0;
      return { col, payments, pending, paid, forgiven, pendingNames, progress };
    });
  }, [collections, profileById]);

  const whatsappSummary = useMemo(() => {
    const lines = ["COBROS F5MANAGER", ""];
    collectionSummaries
      .filter(({ col, pending }) => col.status === "open" && pending.length > 0)
      .forEach(({ col, pendingNames }) => {
        lines.push(`${col.title} - ${formatMoney(col.amount_per_player)}`);
        lines.push(`Pendientes: ${pendingNames.join(", ")}`);
        if (col.due_date) {
          lines.push(`Vence: ${new Date(col.due_date + "T12:00:00").toLocaleDateString("es-GT")}`);
        }
        lines.push("");
      });
    if (lines.length === 2) lines.push("No hay pendientes abiertos.");
    return lines.join("\n").trim();
  }, [collectionSummaries]);

  function filteredPayments(payments) {
    if (statusFilter === "all") return payments;
    return payments.filter((payment) => payment.status === statusFilter);
  }

  function togglePayment(collectionId, paymentId) {
    setSelectedPayments((current) => {
      const selected = new Set(current[collectionId] || []);
      if (selected.has(paymentId)) selected.delete(paymentId);
      else selected.add(paymentId);
      return { ...current, [collectionId]: [...selected] };
    });
  }

  function selectFiltered(collectionId, payments) {
    setSelectedPayments((current) => ({
      ...current,
      [collectionId]: payments.map((payment) => payment.id),
    }));
  }

  async function markSelectedPaid(collectionId) {
    const ids = selectedPayments[collectionId] || [];
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => onUpdatePayment(id, { status: "paid" })));
    setSelectedPayments((current) => ({ ...current, [collectionId]: [] }));
  }

  return (
    <section className="panel collections-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Grupo</p>
          <h2>Colaboraciones extra</h2>
        </div>
        {isAdmin && (
          <button
            className="secondary-button"
            type="button"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "Cancelar" : "+ Nueva"}
          </button>
        )}
      </div>

      <div className="collections-toolbar">
        <div className="segmented-control">
          {[
            ["pending", "Pendientes"],
            ["paid", "Pagados"],
            ["forgiven", "Perdonados"],
            ["all", "Todos"],
          ].map(([value, label]) => (
            <button
              className={statusFilter === value ? "is-active" : ""}
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ExportCard label="Resumen para WhatsApp" text={whatsappSummary} />

      {showForm && (
        <CollectionForm
          onSave={async (payload) => {
            await onCreateCollection(payload);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {collections.length === 0 && !showForm && (
        <div className="empty-state compact">No hay colaboraciones activas.</div>
      )}

      {collectionSummaries.map(({ col, payments, pending, paid, forgiven, progress }) => {
        const visiblePayments = [...filteredPayments(payments)].sort((a, b) => {
          const nameA = displayName(profileById.get(a.profile_id)) || "";
          const nameB = displayName(profileById.get(b.profile_id)) || "";
          return nameA.localeCompare(nameB);
        });
        const paidCount = paid.length;
        const totalCollected = paidCount * col.amount_per_player;
        const selectedForCollection = selectedPayments[col.id] || [];

        return (
          <article className="collection-card" key={col.id}>
            <div className="collection-card-head">
              <div className="collection-title">
                <p className="eyebrow">Colaboración</p>
                <strong>{col.title}</strong>
                {col.description && <small>{col.description}</small>}
              </div>
              <div className="collection-stats">
                <div>
                  <small>Monto</small>
                  <span>{formatMoney(col.amount_per_player)}</span>
                </div>
                <div>
                  <small>Recaudado</small>
                  <span>{formatMoney(totalCollected)}</span>
                </div>
                <div>
                  <small>Estado</small>
                  <span
                    className={classNames(
                      "status-pill",
                      col.status === "closed" && "is-paid",
                    )}
                  >
                    {col.status === "closed" ? "Cerrada" : `${paidCount}/${payments.length}`}
                  </span>
                </div>
              </div>
              {isAdmin && col.status === "open" ? (
                editingColId === col.id ? (
                  <div className="edit-due-date-form">
                    <input
                      type="date"
                      value={newColDueDate}
                      onChange={(e) => setNewColDueDate(e.target.value)}
                    />
                    <button className="fee-btn-icon is-primary" type="button" onClick={() => handleSaveColDueDate(col.id)}>✓</button>
                    <button className="fee-btn-icon is-danger" type="button" onClick={() => setEditingColId(null)}>×</button>
                  </div>
                ) : (
                  <small className="collection-due">
                    {col.due_date
                      ? `Vence ${new Date(col.due_date + "T12:00:00").toLocaleDateString("es-GT")}`
                      : "Sin fecha límite"}
                    <button
                      className="edit-due-btn"
                      type="button"
                      onClick={() => {
                        setEditingColId(col.id);
                        setNewColDueDate(col.due_date || "");
                      }}
                      title="Editar vencimiento"
                    >
                      ✏️
                    </button>
                  </small>
                )
              ) : (
                col.due_date && (
                  <small className="collection-due">
                    Vence {new Date(col.due_date + "T12:00:00").toLocaleDateString("es-GT")}
                  </small>
                )
              )}
            </div>

            <div className="collection-progress">
              <span style={{ width: `${progress}%` }} />
            </div>

            <div className="collection-breakdown">
              <span>Pendientes: {pending.length}</span>
              <span>Pagados: {paid.length}</span>
              <span>Perdonados: {forgiven.length}</span>
            </div>

            {isAdmin && col.status === "open" && visiblePayments.length > 0 && (
              <div className="collection-batch-actions">
                <CopyCollectionGroupLinkButton collection={col} />
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => selectFiltered(col.id, visiblePayments)}
                >
                  Seleccionar visibles
                </button>
                <button
                  type="button"
                  disabled={selectedForCollection.length === 0}
                  onClick={() => markSelectedPaid(col.id)}
                >
                  Marcar pagados ({selectedForCollection.length})
                </button>
              </div>
            )}

            {isAdmin && col.status === "open" && (
              <div className="collection-player-grid">
                {visiblePayments.map((payment) => {
                  const player = profileById.get(payment.profile_id);
                  const proofStatus = payment.proof_status;
                  const hasProof = payment.proof_url;

                  return (
                    <div className="fee-player-row" key={payment.id}>
                      <div>
                        <label className="payment-select">
                          <input
                            checked={selectedForCollection.includes(payment.id)}
                            type="checkbox"
                            onChange={() => togglePayment(col.id, payment.id)}
                          />
                          <span>{displayName(player)}</span>
                        </label>
                        <small>
                          {payment.status === "paid"
                            ? "Pagó"
                            : payment.status === "forgiven"
                              ? "Perdonado"
                              : proofStatus === "submitted"
                                ? "Esperando revisión"
                                : proofStatus === "approved"
                                  ? "Comprobante aprobado"
                                  : proofStatus === "rejected"
                                    ? "Comprobante rechazado"
                                    : "Pendiente"}
                        </small>
                        <ProofStatusBadge status={proofStatus} />
                      </div>
                      <div className="fee-actions">
                        {payment.status === "pending" && (
                          <>
                            <button
                              className="fee-btn-icon is-primary"
                              type="button"
                              onClick={() =>
                                onUpdatePayment(payment.id, { status: "paid" })
                              }
                            >
                              <Check /> Pagó
                            </button>
                            <button
                              className="fee-btn-icon is-danger"
                              type="button"
                              onClick={() =>
                                onUpdatePayment(payment.id, { status: "forgiven" })
                              }
                            >
                              <X /> Perdonar
                            </button>
                          </>
                        )}

                        {hasProof && proofStatus === "submitted" && (
                          <button
                            className="fee-btn-icon"
                            type="button"
                            onClick={() => setModalPayment(payment)}
                          >
                            <FileText /> Ver comp.
                          </button>
                        )}

                        {!hasProof && payment.status === "pending" && (
                          <CopyProofLinkButton
                            payment={payment}
                            paymentType="collection"
                          />
                        )}

                        {payment.status !== "pending" && (
                          <span
                            className={classNames(
                              "status-pill",
                              payment.status === "paid" && "is-paid",
                              payment.status === "forgiven" && "is-forgiven",
                            )}
                          >
                            {payment.status === "paid" ? "Pagado" : "Perdonado"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {visiblePayments.length === 0 && (
                  <div className="empty-state compact">No hay pagos con ese filtro.</div>
                )}
              </div>
            )}

            {!isAdmin && (
              <div className="collection-player-grid">
                {payments
                  .filter((p) => p.profile_id === profileById.get("current")?.id)
                  .map((payment) => {
                    const proofStatus = payment.proof_status;
                    return (
                      <div className="fee-player-row" key={payment.id}>
                        <div>
                          <ProofStatusBadge status={proofStatus} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {isAdmin && col.status === "open" && (
              <div className="button-row ledger-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => onCloseCollection(col.id)}
                >
                  Cerrar colaboración
                </button>
              </div>
            )}

            {isAdmin && col.status === "closed" && (
              <div className="button-row ledger-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    if (confirm("¿Eliminar esta colaboración cerrada?")) {
                      onDeleteCollection(col.id);
                    }
                  }}
                >
                  Eliminar
                </button>
              </div>
            )}
          </article>
        );
      })}

      {modalPayment && (
        <ProofReviewModal
          payment={modalPayment}
          paymentType="collection"
          onClose={() => setModalPayment(null)}
          onReview={onReviewProof}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// My fees panel — player view
// ---------------------------------------------------------------------------

function MyFeesPanel({
  matchFees,
  collections,
  matches,
  profile,
  onCopyProofLink,
}) {
  const matchById = new Map(matches.map((m) => [m.id, m]));

  const myMatchDebts = matchFees
    .filter((fee) => {
      const myPayment = (fee.match_fee_payments || []).find(
        (p) => p.profile_id === profile.id,
      );
      return myPayment && myPayment.status === "pending";
    })
    .map((fee) => {
      const myPayment = fee.match_fee_payments.find(
        (p) => p.profile_id === profile.id,
      );
      return { fee, payment: myPayment, match: matchById.get(fee.match_id) };
    });

  const myCollectionDebts = collections
    .filter((col) => {
      const myPayment = (col.collection_payments || []).find(
        (p) => p.profile_id === profile.id,
      );
      return myPayment && myPayment.status === "pending";
    })
    .map((col) => {
      const myPayment = col.collection_payments.find(
        (p) => p.profile_id === profile.id,
      );
      return { col, payment: myPayment };
    });

  const totalDebt =
    myMatchDebts.reduce((s, { fee }) => s + Number(fee.per_player_amount), 0) +
    myCollectionDebts.reduce((s, { col }) => s + Number(col.amount_per_player), 0);

  return (
    <div className="page-grid">
      <section className="stat-grid">
        <Stat label="Total pendiente" value={formatMoney(totalDebt)} />
        <Stat label="Cobros de cancha" value={myMatchDebts.length} />
        <Stat label="Colaboraciones" value={myCollectionDebts.length} />
      </section>

      {myMatchDebts.length > 0 && (
        <section className="panel">
          <div className="section-heading">
            <h2>Cobros de cancha pendientes</h2>
          </div>
          <div className="ledger-list">
            {myMatchDebts.map(({ fee, payment, match }) => (
              <article className="ledger-row" key={fee.id}>
                <div>
                  <strong>{match?.title || "Partido"}</strong>
                  <small>
                    {match ? formatMatchDate(match) : ""}
                    {fee.due_before
                      ? ` · vence ${new Date(fee.due_before).toLocaleDateString("es-GT")}`
                      : ""}
                  </small>
                  <ProofStatusBadge status={payment.proof_status} />
                </div>
                <div className="ledger-meta">
                  <span className="fine-amount">
                    {formatMoney(fee.per_player_amount)}
                  </span>
                  {payment.proof_status === "pending" && (
                    <CopyProofLinkButton
                      payment={payment}
                      paymentType="match_fee"
                    />
                  )}
                  {payment.proof_status !== "pending" && (
                    <span className="status-pill">
                      {payment.proof_status === "submitted"
                        ? "Enviado"
                        : payment.proof_status === "approved"
                          ? "Aprobado"
                          : "Rechazado"}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {myCollectionDebts.length > 0 && (
        <section className="panel">
          <div className="section-heading">
            <h2>Colaboraciones pendientes</h2>
          </div>
          <div className="ledger-list">
            {myCollectionDebts.map(({ col, payment }) => (
              <article className="ledger-row" key={col.id}>
                <div>
                  <strong>{col.title}</strong>
                  {col.description && <small>{col.description}</small>}
                  {col.due_date && (
                    <small>
                      Vence{" "}
                      {new Date(col.due_date + "T12:00:00").toLocaleDateString("es-GT")}
                    </small>
                  )}
                  <ProofStatusBadge status={payment.proof_status} />
                </div>
                <div className="ledger-meta">
                  <span className="fine-amount">
                    {formatMoney(col.amount_per_player)}
                  </span>
                  {payment.proof_status === "pending" && (
                    <CopyProofLinkButton
                      payment={payment}
                      paymentType="collection"
                    />
                  )}
                  {payment.proof_status !== "pending" && (
                    <span className="status-pill">
                      {payment.proof_status === "submitted"
                        ? "Enviado"
                        : payment.proof_status === "approved"
                          ? "Aprobado"
                          : "Rechazado"}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {myMatchDebts.length === 0 && myCollectionDebts.length === 0 && (
        <section className="panel">
          <div className="empty-state compact">No tenés cobros pendientes.</div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export — switches between admin and player view
// ---------------------------------------------------------------------------

export default function FeesPage({
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
    return (
      <MyFeesPanel
        collections={collections}
        matchFees={matchFees}
        matches={matches}
        profile={profile}
      />
    );
  }

  // Admin: match fees per match + collections
  const matchesWithFees = matches
    .map((match) => ({
      match,
      fee: matchFees.find((f) => f.match_id === match.id) || null,
    }))
    .filter(({ fee }) => fee !== null);

  return (
    <div className="page-grid">
      {matchesWithFees.length > 0 && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Partidos</p>
              <h2>Cobros de cancha</h2>
            </div>
          </div>
          {matchesWithFees.map(({ match, fee }) => (
            <div className="detail-section" key={match.id}>
              <div className="section-heading">
                <div>
                  <strong>{match.title || "Partido"}</strong>
                  <small>{formatMatchDate(match)}</small>
                </div>
              </div>
              <MatchFeePanel
                fee={fee}
                isAdmin={isAdmin}
                profileById={profileById}
                onUpdatePayment={onUpdateMatchFeePayment}
                onUpdateMatchFee={onUpdateMatchFee}
                onReviewProof={onReviewProof}
              />
            </div>
          ))}
        </section>
      )}

      <CollectionsPanel
        collections={collections}
        isAdmin={isAdmin}
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
