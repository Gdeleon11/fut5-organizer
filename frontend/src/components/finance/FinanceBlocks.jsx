import { useEffect, useState } from "react";
import { Check, FileText, Link as LinkIcon, X } from "lucide-react";
import { copyToClipboard, formatMoney, proofUploadUrl } from "../../utils.js";
import { PROOF_LABELS, paymentStateLabel, paymentTone } from "../../finance/financeModel.js";

/*
 * Shared finance / reservation building blocks for both experiences.
 * Pure presentation: every action is a callback received from the page, so the
 * payment, fine and reservation rules stay in the pages and in App.jsx.
 */

export function Money({ value, signed, tone, className = "" }) {
  const n = Number(value || 0);
  // Ledger rows carry their direction in `signed`; plain figures keep the real sign of the value.
  const sign = signed ? (signed === "expense" ? "−" : "+") : n < 0 ? "−" : "";
  return <span className={`fx-money ${tone ? `is-${tone}` : ""} ${className}`}>{sign}{formatMoney(Math.abs(n))}</span>;
}

/** Status chip: tone drives the colour, label is always text (never colour only). */
export function StatusChip({ tone = "pending", children }) {
  return <span className={`fx-chip is-${tone}`}>{children}</span>;
}

export function PaymentChip({ payment }) {
  return <StatusChip tone={paymentTone(payment)}>{paymentStateLabel(payment)}</StatusChip>;
}

export function ProofStatusBadge({ status }) {
  if (!status || status === "pending") return null;
  return <span className={`fx-proof is-${status}`}><FileText size={12} aria-hidden="true" />{PROOF_LABELS[status] || status}</span>;
}

export function Meter({ value, label, tone }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <span className={`fx-meter ${tone ? `is-${tone}` : ""}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <i style={{ inlineSize: `${pct}%` }} />
    </span>
  );
}

/** Command ring gauge (conic gradient); value 0–100. */
export function Ring({ value, label, caption }) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  return (
    <div className="fx-ring" style={{ "--fx-pct": pct }} role="img" aria-label={`${label}: ${pct}%`}>
      <div><b>{pct}%</b><small>{caption || label}</small></div>
    </div>
  );
}

export function Kpis({ items, variant }) {
  return (
    <dl className={`fx-kpis is-${variant}`}>
      {items.map(({ label, value, hint, tone }) => (
        <div key={label} className={tone ? `is-${tone}` : ""}>
          <dt>{label}</dt>
          <dd>{value}</dd>
          {hint && <small>{hint}</small>}
        </div>
      ))}
    </dl>
  );
}

export function Section({ title, icon: Icon, aside, children, className = "", id }) {
  return (
    <section className={`fx-section ${className}`} id={id} aria-label={typeof title === "string" ? title : undefined}>
      <div className="mdd-head fx-head">
        <h2>{Icon && <Icon size={17} aria-hidden="true" />}{title}</h2>
        {aside && <div className="fx-head-aside">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }) {
  return <p className="fx-empty">{children}</p>;
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="pl-seg fx-seg" role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id} type="button" className={value === id ? "is-on" : ""} aria-pressed={value === id} onClick={() => onChange(id)}>{text}</button>
      ))}
    </div>
  );
}

/* -------------------------------------------------- Payment row actions */

export function CopyProofLinkButton({ payment, paymentType, disabled }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      const token = btoa(JSON.stringify({ pid: payment.id, uid: payment.profile_id, type: paymentType, gid: payment.group_id }));
      await copyToClipboard(proofUploadUrl(token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error generating proof link:", err);
      alert("No se pudo copiar el enlace. Revisá permisos del navegador e intentá de nuevo.");
    }
  }
  return (
    <button className="fx-act" type="button" onClick={handleCopy} disabled={disabled} title="Copiar link para subir comprobante">
      <LinkIcon size={15} aria-hidden="true" />{copied ? "Copiado" : "Link"}
    </button>
  );
}

export function CopyCollectionGroupLinkButton({ collection }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      const token = btoa(JSON.stringify({ cid: collection.id, gid: collection.group_id, type: "collection_group" }));
      const text = [
        "COBRO F5MANAGER",
        "",
        collection.title,
        `Monto: ${formatMoney(collection.amount_per_player)}`,
        collection.due_date ? `Vence: ${new Date(collection.due_date + "T12:00:00").toLocaleDateString("es-GT")}` : "",
        "",
        "Subí tu comprobante aquí:",
        proofUploadUrl(token),
      ].filter(Boolean).join("\n");
      await copyToClipboard(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error generating collection link:", err);
      alert("No se pudo copiar el enlace. Revisá permisos del navegador e intentá de nuevo.");
    }
  }
  return (
    <button className="md-btn md-btn-ghost" type="button" onClick={handleCopy}>
      <LinkIcon size={15} aria-hidden="true" />{copied ? "Link copiado" : "Link general"}
    </button>
  );
}

/** Admin actions on a pending/submitted payment; exactly the actions the old rows offered. */
export function PaymentActions({ payment, paymentType, onUpdatePayment, onOpenProof }) {
  const hasProof = payment.proof_url;
  return (
    <div className="fx-actions">
      {hasProof && payment.proof_status === "submitted" && (
        <button className="fx-act is-review" type="button" title="Ver comprobante" aria-label="Ver comprobante" onClick={() => onOpenProof(payment)}>
          <FileText size={15} aria-hidden="true" />Revisar
        </button>
      )}
      {!hasProof && payment.status === "pending" && <CopyProofLinkButton payment={payment} paymentType={paymentType} />}
      {payment.status === "pending" && (
        <>
          <button className="fx-icon is-approve" type="button" title="Marcar como pagado" aria-label="Marcar como pagado" onClick={() => onUpdatePayment(payment.id, { status: "paid" })}>
            <Check size={17} aria-hidden="true" />
          </button>
          <button className="fx-icon is-reject" type="button" title="Perdonar cuota" aria-label="Perdonar cuota" onClick={() => onUpdatePayment(payment.id, { status: "forgiven" })}>
            <X size={17} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------ Proof review modal */

export function ProofReviewModal({ payment, paymentType, playerName, amount, onClose, onReview }) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
    <div className="md-modal-overlay" onClick={onClose}>
      <div className="md-modal fx-proof-modal" role="dialog" aria-modal="true" aria-labelledby="fx-proof-title" onClick={(e) => e.stopPropagation()}>
        <header className="md-modal-head">
          <div>
            <p className="eyebrow">{paymentType === "collection" ? "Colaboración" : "Cuota de cancha"}</p>
            <h2 id="fx-proof-title">Revisar comprobante</h2>
            {(playerName || amount != null) && <small>{playerName}{amount != null ? ` · ${formatMoney(amount)}` : ""}</small>}
          </div>
          <button className="md-icon-btn" type="button" aria-label="Cerrar" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </header>
        <div className="md-modal-body fx-proof-body">
          <img src={payment.proof_url} alt="Comprobante de pago" />
          {showRejectForm && (
            <label className="fx-field">
              Motivo del rechazo (opcional)
              <input type="text" placeholder="Ej. El monto no coincide" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} autoFocus />
            </label>
          )}
        </div>
        <footer className="md-modal-foot">
          {!showRejectForm ? (
            <>
              <button className="md-btn md-btn-ghost fx-danger-text" type="button" onClick={() => setShowRejectForm(true)} disabled={reviewing}>Rechazar</button>
              <button className="md-btn md-btn-accent" type="button" onClick={handleApprove} disabled={reviewing}>{reviewing ? "Procesando…" : "Aprobar"}</button>
            </>
          ) : (
            <>
              <button className="md-btn md-btn-ghost" type="button" onClick={() => setShowRejectForm(false)} disabled={reviewing}>Cancelar</button>
              <button className="md-btn fx-btn-danger" type="button" onClick={handleReject} disabled={reviewing}>{reviewing ? "Procesando…" : "Confirmar rechazo"}</button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
