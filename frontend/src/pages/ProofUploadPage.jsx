import { useState, useEffect } from "react";
import { api } from "../api.js";
import { formatMoney } from "../utils.js";
import { PubDetails, PubFilePicker, PubNotice, PubStatus, PublicShell } from "../components/public/PublicShell.jsx";

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
  }, [token, session?.user?.id]);

  async function verifyToken() {
    try {
      setLoading(true);
      setError("");

      const result = await api.verifyProofToken(token);
      console.log("verifyProofToken result:", result);

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

      if (result.profile_id && session.user.id !== result.profile_id) {
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
    return <PublicShell view="public-proof" eyebrow="Comprobante de pago" title="Verificando enlace…" />;
  }

  if (error && !paymentInfo) {
    return (
      <PublicShell view="public-proof" eyebrow="Comprobante de pago" title="Enlace no válido">
        <PubNotice tone="error">{error}</PubNotice>
        <p className="pub-lede">El enlace puede haber expirado o ser inválido. Pedí uno nuevo al admin.</p>
      </PublicShell>
    );
  }

  if (!session?.user) {
    return (
      <PublicShell view="public-proof" eyebrow="Comprobante de pago" title="Iniciá sesión">
        <PubNotice tone="info">Para subir tu comprobante, necesitás iniciar sesión primero.</PubNotice>
        <p className="pub-lede">Cerrá esta página e iniciá sesión con tu cuenta, luego volvé a abrir el enlace.</p>
      </PublicShell>
    );
  }

  if (paymentInfo?.profile_id && session.user.id !== paymentInfo.profile_id) {
    return (
      <PublicShell view="public-proof" eyebrow="Comprobante de pago" title="Sin acceso">
        <PubNotice tone="error">Este comprobante no te pertenece.</PubNotice>
      </PublicShell>
    );
  }

  const proofStatus = paymentInfo.proof_status;
  const isSubmitted = proofStatus === "submitted";
  const isApproved = proofStatus === "approved";
  const isRejected = proofStatus === "rejected";
  const canUpload = proofStatus === "pending" || isRejected;
  const statusView = {
    pending: ["pending", "Pendiente"],
    submitted: ["review", "Enviado · esperando revisión"],
    approved: ["done", "Aprobado"],
    rejected: ["bad", "Rechazado"],
  }[proofStatus] || ["pending", proofStatus];

  return (
    <PublicShell view="public-proof" eyebrow="Comprobante de pago" title="Subir comprobante">
      <PubDetails rows={[
        ["Concepto", paymentInfo.title],
        ["Monto", <span className="pub-amount" key="a">{formatMoney(paymentInfo.amount)}</span>],
        ["Estado", <PubStatus key="s" tone={statusView[0]}>{statusView[1]}</PubStatus>],
      ]} />

      {error && <PubNotice tone="error">{error}</PubNotice>}
      {success && <PubNotice tone="success">{success}</PubNotice>}
      {isRejected && paymentInfo.proof_rejection_reason && (
        <PubNotice tone="warning"><strong>Motivo del rechazo:</strong> {paymentInfo.proof_rejection_reason}</PubNotice>
      )}

      {canUpload ? (
        <>
          <PubFilePicker
            label="Seleccioná una imagen de tu comprobante"
            hint="PNG, JPEG, WebP o GIF · hasta 8 MB"
            accept="image/png, image/jpeg, image/webp, image/gif"
            onChange={handleFileSelect}
          />
          {previewUrl && (
            <div className="pub-preview">
              <img src={previewUrl} alt="Vista previa del comprobante" />
              <button type="button" className="pub-btn is-ghost" onClick={handleRemoveFile}>Quitar imagen</button>
            </div>
          )}
          <button type="button" className="pub-btn" disabled={!selectedFile || uploading} onClick={handleUpload}>
            {uploading ? "Subiendo…" : "Enviar comprobante"}
          </button>
        </>
      ) : isSubmitted && !success ? (
        <PubNotice tone="info">Tu comprobante fue enviado y está esperando revisión del admin.</PubNotice>
      ) : isApproved ? (
        <PubNotice tone="success">Tu comprobante fue aprobado. ¡Gracias!</PubNotice>
      ) : null}
    </PublicShell>
  );
}
