import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, MessageCircle, Share2, X } from "lucide-react";
import { useAppearance } from "../../appearance/AppearanceProvider.jsx";
import { copyShareText, downloadPngBlob, shareToWhatsApp } from "../../share/shareActions.js";
import "../../share/share.css";

/**
 * Reusable Share & Invite modal that renders a live PNG preview from the active palette/design,
 * exposes optional privacy toggles, and offers WhatsApp share, PNG download, and text copy.
 */
export default function ShareSheetModal({
  open,
  onClose,
  eyebrow = "Compartir",
  title = "Compartir imagen",
  subtitle = "",
  filename = "f5-manager.png",
  shareText = "",
  copyLabel = "Copiar texto",
  whatsappLabel = "Compartir por WhatsApp",
  renderPng,
  toggles = [],
  privacyNote = "",
  testId = "share-sheet-modal",
}) {
  const { palette, design } = useAppearance();
  const [blob, setBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeBtnRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || typeof renderPng !== "function") return undefined;
    let alive = true;
    let createdUrl = "";
    setRendering(true);
    setError("");

    Promise.resolve(renderPng({ palette, design }))
      .then((nextBlob) => {
        if (!alive) return;
        setBlob(nextBlob);
        if (nextBlob) {
          createdUrl = URL.createObjectURL(nextBlob);
          setPreviewUrl(createdUrl);
        } else {
          setPreviewUrl("");
        }
      })
      .catch((err) => {
        if (!alive) return;
        setError(err?.message || "No se pudo generar la imagen.");
      })
      .finally(() => {
        if (alive) setRendering(false);
      });

    return () => {
      alive = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [open, renderPng, palette, design]);

  if (!open) return null;

  async function handleWhatsApp() {
    setStatusMsg("");
    const res = await shareToWhatsApp({
      blob,
      filename,
      title,
      text: shareText,
    });
    if (res.method === "web-share") {
      setStatusMsg("Compartido desde tu dispositivo.");
    } else if (res.method === "whatsapp-fallback") {
      setStatusMsg("Imagen PNG descargada y WhatsApp abierto con el mensaje listo.");
    }
  }

  function handleDownload() {
    if (!blob) return;
    downloadPngBlob(blob, filename);
    setStatusMsg("Imagen PNG descargada.");
  }

  async function handleCopy() {
    await copyShareText(shareText);
    setCopied(true);
    setStatusMsg("Texto copiado al portapapeles.");
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="md-modal-overlay" onClick={onClose}>
      <div
        className="md-modal f5s-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="f5s-modal-title"
        data-testid={testId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="md-modal-head">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id="f5s-modal-title">{title}</h2>
            {subtitle && <small>{subtitle}</small>}
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="md-icon-btn"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="f5s-body">
          {toggles.length > 0 && (
            <div className="f5s-toggles" role="group" aria-label="Opciones de privacidad">
              {toggles.map((tg) => (
                <label key={tg.id} className="f5s-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(tg.checked)}
                    onChange={(e) => tg.onChange?.(e.target.checked)}
                  />
                  <span>{tg.label}</span>
                </label>
              ))}
            </div>
          )}

          <div className="f5s-preview-wrap" data-testid={`${testId}-preview`}>
            {rendering && <p className="f5s-loading">Generando imagen PNG…</p>}
            {!rendering && error && <p className="form-message" role="alert">{error}</p>}
            {!rendering && !error && previewUrl && (
              <img
                className="f5s-preview-img"
                src={previewUrl}
                alt={`Vista previa PNG: ${title}`}
              />
            )}
          </div>

          {statusMsg && <p className="f5s-status" role="status">{statusMsg}</p>}

          <div className="f5s-actions">
            <button
              type="button"
              className="md-btn md-btn-accent f5s-primary"
              onClick={handleWhatsApp}
              disabled={rendering || !blob}
              data-share-action="whatsapp"
            >
              <MessageCircle size={16} aria-hidden="true" /> {whatsappLabel}
            </button>
            <a
              className="md-btn md-btn-ghost"
              href={previewUrl || undefined}
              download={filename.endsWith(".png") ? filename : `${filename}.png`}
              aria-disabled={rendering || !previewUrl}
              onClick={(e) => {
                if (rendering || !previewUrl) {
                  e.preventDefault();
                  return;
                }
                setStatusMsg("Imagen PNG descargada.");
              }}
              data-share-action="download"
            >
              <Download size={16} aria-hidden="true" /> Descargar imagen
            </a>
            <button
              type="button"
              className="md-btn md-btn-ghost"
              onClick={handleCopy}
              data-share-action="copy"
            >
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {copied ? "Copiado" : copyLabel}
            </button>
          </div>

          {shareText && (
            <details className="f5s-text-preview">
              <summary>Ver mensaje para WhatsApp</summary>
              <pre>{shareText}</pre>
            </details>
          )}

          {privacyNote && <p className="f5s-note">{privacyNote}</p>}
        </div>
      </div>
    </div>
  );
}

/** Small consistent trigger button used across MatchDetail, Teams, Results, and Mi FIFA. */
export function ShareTriggerButton({ label = "Compartir", onClick, variant = "ghost", testId }) {
  return (
    <button
      type="button"
      className={`md-btn ${variant === "accent" ? "md-btn-accent" : "md-btn-ghost"} md-btn-sm`}
      onClick={onClick}
      data-testid={testId}
    >
      <Share2 size={15} aria-hidden="true" /> {label}
    </button>
  );
}
