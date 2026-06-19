import { useState, useEffect } from "react";
import { api } from "../api.js";
import { formatMoney } from "../utils.js";

export default function ProofUploadPage({ token, session }) {
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    verifyToken();
  }, [token]);

  async function verifyToken() {
    try {
      setLoading(true);
      setError("");

      const result = await api.verifyProofToken(token);

      if (!result.valid) {
        setError(result.error || "Token inválido");
        return;
      }

      setPaymentInfo(result);

      // Check if user is logged in after we have payment info
      if (!session?.user) {
        setError("Debés iniciar sesión para subir un comprobante.");
        return;
      }

      if (session.user.id !== result.profile_id) {
        setError("Este comprobante no te pertenece.");
        return;
      }
    } catch (err) {
      setError(err.message || "Error al verificar el token");
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setError("Solo se permiten imágenes (PNG, JPEG, WebP, GIF)");
      return;
    }

    // Validate file size (8MB max)
    if (file.size > 8 * 1024 * 1024) {
      setError("La imagen no puede superar 8MB");
      return;
    }

    setSelectedFile(file);
    setError("");

    // Create preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }

  function handleRemoveFile() {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }

  async function handleUpload() {
    if (!selectedFile || !paymentInfo) return;

    try {
      setUploading(true);
      setError("");

      await api.uploadPaymentProof(
        paymentInfo.payment_id,
        paymentInfo.payment_type,
        selectedFile
      );

      setSuccess("Comprobante enviado correctamente. El admin lo revisará pronto.");
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      // Refresh payment info
      const updatedInfo = await api.verifyProofToken(token);
      if (updatedInfo.valid) {
        setPaymentInfo(updatedInfo);
      }
    } catch (err) {
      setError(err.message || "Error al subir el comprobante");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="app auth-shell">
        <section className="panel auth-panel">
          <div className="empty-state">Verificando enlace...</div>
        </section>
      </div>
    );
  }

  if (error && !paymentInfo) {
    return (
      <div className="app auth-shell">
        <section className="panel auth-panel">
          <div>
            <p className="eyebrow">fut5-organizer</p>
            <h1>Error</h1>
          </div>
          <div className="alert error">{error}</div>
          <p className="text-muted">
            El enlace puede haber expirado o ser inválido. Pedí uno nuevo al admin.
          </p>
        </section>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="app auth-shell">
        <section className="panel auth-panel">
          <div>
            <p className="eyebrow">fut5-organizer</p>
            <h1>Iniciar Sesión</h1>
          </div>
          <div className="alert info">
            Para subir tu comprobante, necesitás iniciar sesión primero.
          </div>
          <p className="text-muted">
            Cerrá esta página e iniciá sesión con tu cuenta, luego volvé a abrir el
            enlace.
          </p>
        </section>
      </div>
    );
  }

  if (session.user.id !== paymentInfo?.profile_id) {
    return (
      <div className="app auth-shell">
        <section className="panel auth-panel">
          <div>
            <p className="eyebrow">fut5-organizer</p>
            <h1>Error</h1>
          </div>
          <div className="alert error">Este comprobante no te pertenece.</div>
        </section>
      </div>
    );
  }

  const proofStatus = paymentInfo.proof_status;
  const isSubmitted = proofStatus === "submitted";
  const isApproved = proofStatus === "approved";
  const isRejected = proofStatus === "rejected";
  const canUpload = proofStatus === "pending" || isRejected;

  return (
    <div className="app auth-shell">
      <section className="panel auth-panel">
        <div>
          <p className="eyebrow">fut5-organizer</p>
          <h1>Subir Comprobante</h1>
        </div>

        {/* Payment Info */}
        <div className="proof-payment-info">
          <div className="proof-info-row">
            <span className="proof-label">Concepto:</span>
            <span className="proof-value">{paymentInfo.title}</span>
          </div>
          <div className="proof-info-row">
            <span className="proof-label">Monto:</span>
            <span className="proof-value amount">
              {formatMoney(paymentInfo.amount)}
            </span>
          </div>
          <div className="proof-info-row">
            <span className="proof-label">Estado:</span>
            <span className={`proof-status status-${proofStatus}`}>
              {proofStatus === "pending" && "Pendiente"}
              {proofStatus === "submitted" && "Enviado - Esperando revisión"}
              {proofStatus === "approved" && "Aprobado ✓"}
              {proofStatus === "rejected" && "Rechazado"}
            </span>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        {isRejected && paymentInfo.proof_rejection_reason && (
          <div className="alert warning">
            <strong>Motivo del rechazo:</strong> {paymentInfo.proof_rejection_reason}
          </div>
        )}

        {canUpload ? (
          <>
            <div className="proof-upload-section">
              <label className="proof-upload-label">
                Seleccioná una imagen de tu comprobante de pago
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp, image/gif"
                  onChange={handleFileSelect}
                  className="proof-file-input"
                />
              </label>

              {previewUrl && (
                <div className="proof-preview">
                  <img src={previewUrl} alt="Vista previa del comprobante" />
                  <button
                    type="button"
                    className="secondary-button remove-file-btn"
                    onClick={handleRemoveFile}
                  >
                    Quitar imagen
                  </button>
                </div>
              )}
            </div>

            <button
              className="upload-proof-btn"
              disabled={!selectedFile || uploading}
              onClick={handleUpload}
            >
              {uploading ? "Subiendo..." : "Enviar Comprobante"}
            </button>
          </>
        ) : isSubmitted ? (
          <div className="alert info">
            Tu comprobante fue enviado y está esperando revisión del admin.
          </div>
        ) : isApproved ? (
          <div className="alert success">
            Tu comprobante fue aprobado. ¡Gracias!
          </div>
        ) : null}
      </section>
    </div>
  );
}
