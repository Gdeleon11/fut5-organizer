/**
 * Browser-compatible share, download, and WhatsApp fallback helpers for F5 Share & Invite V1.
 */
import { copyToClipboard, waUrl } from "../utils.js";

export function downloadPngBlob(blob, filename = "f5-manager.png") {
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return true;
}

export function canNativeShareFile(blob, filename = "f5-manager.png") {
  if (typeof navigator === "undefined" || typeof File === "undefined") return false;
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  if (!blob) return false;
  try {
    const file = new File([blob], filename, { type: "image/png" });
    return Boolean(navigator.canShare({ files: [file] }));
  } catch {
    return false;
  }
}

/**
 * Shares image + text via Web Share API when supported; otherwise opens WhatsApp with the text
 * (and optionally downloads the PNG so the user can attach it cleanly on desktop/unsupported browsers).
 */
export async function shareToWhatsApp({ blob, filename, title, text }) {
  if (blob && canNativeShareFile(blob, filename)) {
    try {
      const file = new File([blob], filename, { type: "image/png" });
      await navigator.share({ files: [file], title, text });
      return { method: "web-share" };
    } catch (err) {
      if (err?.name === "AbortError") return { method: "canceled" };
      // Fall through to WhatsApp link fallback
    }
  }
  if (blob) {
    downloadPngBlob(blob, filename);
  }
  const href = waUrl(text);
  window.open(href, "_blank", "noopener,noreferrer");
  return { method: "whatsapp-fallback", href };
}

export async function copyShareText(text) {
  await copyToClipboard(text);
  return true;
}
