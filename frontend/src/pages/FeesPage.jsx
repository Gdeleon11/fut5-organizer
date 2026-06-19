import { useState } from "react";
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

function CopyProofLinkButton({ paymentId, paymentType, disabled }) {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function handleCopy() {
    try {
      setGenerating(true);
      const token = await api.generateProofToken(paymentId, paymentType);
      const proofUrl = `${window.location.origin}/proof/${token}`;

      await navigator.clipboard.writeText(proofUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error generating proof link:", err);
      alert("Error al generar el enlace. Intentá de nuevo.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button
      className="secondary-button copy-link-btn"
      type="button"
      onClick={handleCopy}
      disabled={disabled || generating}
    >
      {generating ? "Generando..." : copied ? "Copiado ✓" : "Copiar link"}
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
  onReviewProof,
}) {
  const [modalPayment, setModalPayment] = useState(null);

  if (!fee) return null;

  const payments = fee.match_fee_payments || [];
  const paidCount = payments.filter((p) => p.status === "paid").length;

  return (
    <div className="detail-section">
      <div className="section-heading">
        <div>
          <h2>Costo de cancha</h2>
          <small>
            {formatMoney(fee.per_player_amount)} por jugador ·{" "}
            {fee.due_before
              ? `antes del ${new Date(fee.due_before).toLocaleDateString("es-GT")}`
              : "sin fecha límite"}
          </small>
        </div>
        <span className="count-pill">
          {paidCount}/{payments.length} pagaron
        </span>
      </div>
      <div className="player-list">
        {payments.map((payment) => {
          const player = profileById.get(payment.profile_id);
          const proofStatus = payment.proof_status;
          const hasProof = payment.proof_url;

          return (
            <div className="player-row" key={payment.id}>
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

              <div className="button-row">
                {isAdmin && payment.status === "pending" && (
                  <>
                    <button
                      type="button"
                      onClick={() => onUpdatePayment(payment.id, { status: "paid" })}
                    >
                      Marcar pagado
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() =>
                        onUpdatePayment(payment.id, { status: "forgiven" })
                      }
                    >
                      Perdonar
                    </button>
                  </>
                )}

                {isAdmin && hasProof && proofStatus === "submitted" && (
                  <button
                    type="button"
                    onClick={() => setModalPayment(payment)}
                  >
                    Ver comprobante
                  </button>
                )}

                {isAdmin && !hasProof && payment.status === "pending" && (
                  <CopyProofLinkButton
                    paymentId={payment.id}
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
  onUpdatePayment,
  onCloseCollection,
  onReviewProof,
}) {
  const [showForm, setShowForm] = useState(false);
  const [modalPayment, setModalPayment] = useState(null);

  return (
    <section className="panel">
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

      {collections.map((col) => {
        const payments = col.collection_payments || [];
        const paidCount = payments.filter((p) => p.status === "paid").length;
        const totalCollected = paidCount * col.amount_per_player;

        return (
          <div className="ledger-row" key={col.id}>
            <div>
              <strong>{col.title}</strong>
              {col.description && <small>{col.description}</small>}
              <small>
                {formatMoney(col.amount_per_player)} por jugador
                {col.due_date
                  ? ` · vence ${new Date(col.due_date + "T12:00:00").toLocaleDateString("es-GT")}`
                  : ""}
              </small>
            </div>
            <div className="ledger-meta">
              <span className="fine-amount">{formatMoney(totalCollected)}</span>
              <span
                className={classNames(
                  "status-pill",
                  col.status === "closed" && "is-paid",
                )}
              >
                {col.status === "closed" ? "Cerrada" : `${paidCount}/${payments.length}`}
              </span>
            </div>

            {isAdmin && col.status === "open" && (
              <div className="player-list">
                {payments.map((payment) => {
                  const player = profileById.get(payment.profile_id);
                  const proofStatus = payment.proof_status;
                  const hasProof = payment.proof_url;

                  return (
                    <div className="player-row" key={payment.id}>
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
                      <div className="button-row">
                        {payment.status === "pending" && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdatePayment(payment.id, { status: "paid" })
                              }
                            >
                              Pagó
                            </button>
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() =>
                                onUpdatePayment(payment.id, { status: "forgiven" })
                              }
                            >
                              Perdonar
                            </button>
                          </>
                        )}

                        {hasProof && proofStatus === "submitted" && (
                          <button
                            type="button"
                            onClick={() => setModalPayment(payment)}
                          >
                            Ver comprobante
                          </button>
                        )}

                        {!hasProof && payment.status === "pending" && (
                          <CopyProofLinkButton
                            paymentId={payment.id}
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
              </div>
            )}

            {!isAdmin && (
              <div className="player-list">
                {payments
                  .filter((p) => p.profile_id === profileById.get("current")?.id)
                  .map((payment) => {
                    const proofStatus = payment.proof_status;
                    return (
                      <div className="player-row" key={payment.id}>
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
          </div>
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
                      paymentId={payment.id}
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
                      paymentId={payment.id}
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
  onUpdateCollectionPayment,
  onCloseCollection,
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
        onUpdatePayment={onUpdateCollectionPayment}
        onCloseCollection={onCloseCollection}
        onReviewProof={onReviewProof}
      />
    </div>
  );
}
