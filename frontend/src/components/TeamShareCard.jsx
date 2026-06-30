import { useMemo, useState } from "react";
import { copyToClipboard, displayName, formatMatchDate } from "../utils.js";

function escapeXml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function memberName(member) {
  if (member?.guest_player_id) return member.guest_name || "Invitado";
  return displayName(member?.profiles);
}

export default function TeamShareCard({ match, teams = [] }) {
  const [copied, setCopied] = useState(false);
  const drawableTeams = useMemo(
    () => (teams || []).filter((team) => (team?.team_members || []).length > 0),
    [teams],
  );

  const svg = useMemo(() => {
    const title = escapeXml(match?.title || "Equipos F5Manager");
    const date = escapeXml(formatMatchDate(match));
    const teamBlocks = drawableTeams.slice(0, 4).map((team, teamIndex) => {
      const x = teamIndex % 2 === 0 ? 90 : 555;
      const y = teamIndex < 2 ? 330 : 780;
      const rows = (team.team_members || []).slice(0, 8).map((member, index) => (
        `<text x="${x + 34}" y="${y + 122 + index * 38}" fill="#e8f5ea" font-family="Arial, Helvetica, sans-serif" font-size="25">${escapeXml(memberName(member))}</text>`
      )).join("");
      return `<rect x="${x}" y="${y}" width="435" height="390" rx="24" fill="#111f15" stroke="${escapeXml(team.color || "#39e55a")}" stroke-width="4"/>
<text x="${x + 34}" y="${y + 70}" fill="${escapeXml(team.color || "#39e55a")}" font-family="Arial Black, Impact, sans-serif" font-size="38">${escapeXml(team.name)}</text>
${rows}`;
    }).join("\n");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
<rect width="1080" height="1350" fill="#0d1b10"/>
<circle cx="920" cy="130" r="230" fill="#39e55a" opacity="0.13"/>
<text x="90" y="150" fill="#39e55a" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="800" letter-spacing="6">EQUIPOS F5MANAGER</text>
<text x="90" y="250" fill="#e8f5ea" font-family="Arial Black, Impact, sans-serif" font-size="72">${title}</text>
<text x="90" y="302" fill="#8eb896" font-family="Arial, Helvetica, sans-serif" font-size="30">${date}</text>
${teamBlocks}
<text x="90" y="1260" fill="#39e55a" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="800">f5manager.lat</text>
</svg>`;
  }, [drawableTeams, match]);

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  if (drawableTeams.length === 0) return null;

  async function copyCaption() {
    const lines = ["EQUIPOS F5MANAGER", "", match?.title || "Chamuscón", formatMatchDate(match), ""];
    drawableTeams.forEach((team) => {
      lines.push(`${team.name}:`);
      (team.team_members || []).forEach((member) => lines.push(`- ${memberName(member)}`));
      lines.push("");
    });
    await copyToClipboard(lines.join("\n").trim());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="social-share-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Redes</p>
          <h2>Arte de equipos</h2>
        </div>
        {copied && <span className="count-pill">Copiado</span>}
      </div>
      <img alt="Arte social de equipos" src={dataUrl} />
      <div className="button-row">
        <a className="share-link" download={`equipos-${match?.id || "fut5"}.svg`} href={dataUrl}>
          Descargar equipos
        </a>
        <button className="secondary-button" type="button" onClick={copyCaption}>
          Copiar caption
        </button>
      </div>
    </div>
  );
}
