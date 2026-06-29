import { useMemo, useState } from "react";
import { copyToClipboard, formatMatchDate } from "../utils.js";

function escapeXml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function initials(title) {
  return (title || "F5Manager")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function SocialShareCard({ match, confirmedCount, waitlistCount = 0 }) {
  const [copied, setCopied] = useState(false);
  const title = match?.title || "Chamuscón";
  const venue = match?.venue || "Cancha pendiente";
  const slots = match?.max_players ? `${confirmedCount}/${match.max_players}` : `${confirmedCount}`;

  const svg = useMemo(() => {
    const safeTitle = escapeXml(title);
    const safeDate = escapeXml(formatMatchDate(match));
    const safeVenue = escapeXml(venue);
    const safeSlots = escapeXml(slots);
    const safeInitials = escapeXml(initials(title));

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#07130a"/>
      <stop offset="58%" stop-color="#123019"/>
      <stop offset="100%" stop-color="#39e55a"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" x2="1">
      <stop offset="0%" stop-color="#111f15" stop-opacity="0.96"/>
      <stop offset="100%" stop-color="#1e3625" stop-opacity="0.92"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1350" fill="url(#bg)"/>
  <circle cx="890" cy="120" r="240" fill="#6fd97b" opacity="0.12"/>
  <circle cx="170" cy="1190" r="280" fill="#ffffff" opacity="0.07"/>
  <rect x="70" y="86" width="940" height="1178" rx="34" fill="url(#panel)" stroke="#6fd97b" stroke-opacity="0.35" stroke-width="3"/>
  <text x="110" y="170" fill="#39e55a" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="800" letter-spacing="6">F5MANAGER</text>
  <text x="110" y="305" fill="#e8f5ea" font-family="Arial Black, Impact, sans-serif" font-size="86" font-weight="900">${safeTitle}</text>
  <text x="110" y="365" fill="#b8f0be" font-family="Arial, Helvetica, sans-serif" font-size="36">${safeDate}</text>
  <rect x="110" y="445" width="860" height="240" rx="26" fill="#0d1b10" stroke="#2e5237"/>
  <text x="150" y="525" fill="#8eb896" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800" letter-spacing="4">CANCHA</text>
  <text x="150" y="585" fill="#e8f5ea" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="800">${safeVenue}</text>
  <text x="150" y="645" fill="#8eb896" font-family="Arial, Helvetica, sans-serif" font-size="28">Confirmá para ver todos los detalles</text>
  <rect x="110" y="735" width="260" height="210" rx="24" fill="#e8faea" fill-opacity="0.1" stroke="#6fd97b" stroke-opacity="0.35"/>
  <text x="145" y="805" fill="#8eb896" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="800" letter-spacing="3">CUPOS</text>
  <text x="145" y="890" fill="#39e55a" font-family="Arial Black, Impact, sans-serif" font-size="68">${safeSlots}</text>
  <rect x="410" y="735" width="260" height="210" rx="24" fill="#e8faea" fill-opacity="0.1" stroke="#6fd97b" stroke-opacity="0.35"/>
  <text x="445" y="805" fill="#8eb896" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="800" letter-spacing="3">ESPERA</text>
  <text x="445" y="890" fill="#f5c842" font-family="Arial Black, Impact, sans-serif" font-size="68">${waitlistCount}</text>
  <rect x="710" y="735" width="260" height="210" rx="24" fill="#39e55a" fill-opacity="0.16" stroke="#6fd97b" stroke-opacity="0.45"/>
  <text x="745" y="805" fill="#b8f0be" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="800" letter-spacing="3">GRUPO</text>
  <text x="745" y="890" fill="#e8f5ea" font-family="Arial Black, Impact, sans-serif" font-size="62">${safeInitials}</text>
  <text x="110" y="1065" fill="#e8f5ea" font-family="Arial Black, Impact, sans-serif" font-size="64">¿Jugás?</text>
  <text x="110" y="1130" fill="#b8f0be" font-family="Arial, Helvetica, sans-serif" font-size="34">Confirmá asistencia en F5Manager.</text>
  <text x="110" y="1210" fill="#39e55a" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="800">f5manager.lat</text>
</svg>`;
  }, [confirmedCount, match, slots, title, venue, waitlistCount]);

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  async function copyCaption() {
    await copyToClipboard([
      "F5MANAGER",
      "",
      title,
      formatMatchDate(match),
      `Cancha: ${venue}`,
      `Cupos: ${slots}`,
      waitlistCount > 0 ? `Lista de espera: ${waitlistCount}` : "",
      "",
      "Confirmá en f5manager.lat",
    ].filter(Boolean).join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="social-share-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Redes</p>
          <h2>Arte para compartir</h2>
        </div>
        {copied && <span className="count-pill">Copiado</span>}
      </div>
      <img alt={`Arte social de ${title}`} src={dataUrl} />
      <div className="button-row">
        <a className="share-link" download={`fut5-${match?.id || "partido"}.svg`} href={dataUrl}>
          Descargar arte
        </a>
        <button className="secondary-button" type="button" onClick={copyCaption}>
          Copiar caption
        </button>
      </div>
    </div>
  );
}
