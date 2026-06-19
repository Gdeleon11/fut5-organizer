import { useState } from "react";
import { copyToClipboard, waUrl } from "../utils.js";

export default function ExportCard({ label, text }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await copyToClipboard(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="export-block">
      <div className="section-heading">
        <h2>{label}</h2>
        {copied && <span className="count-pill">Copiado</span>}
      </div>
      <textarea readOnly value={text} />
      <div className="button-row">
        <button type="button" onClick={copy}>
          Copiar texto
        </button>
        <a className="share-link" href={waUrl(text)} rel="noreferrer" target="_blank">
          Abrir WhatsApp
        </a>
      </div>
    </div>
  );
}
