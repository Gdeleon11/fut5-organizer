/**
 * Pure Canvas 2D PNG renderer for F5 Share & Invite V1.
 * Zero external libraries; works reliably across all 4 Premium palettes and both designs.
 * Formats: 1080x1350 (4:5 vertical, optimized for WhatsApp) with dynamic height for large rosters.
 */
import { resolveShareTheme } from "./sharePalette.js";
import { positionColor } from "../positionColors.js";

const DISPLAY_FONT = "'Oswald', 'Arial Narrow', 'Impact', Arial, sans-serif";
const BODY_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function truncateText(ctx, text, maxWidth) {
  const str = String(text || "");
  if (ctx.measureText(str).width <= maxWidth) return str;
  let out = str;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out.trim()}…`;
}

function wrapText(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length === maxLines - 1) {
        const rest = [current, ...words.slice(i + 1)].join(" ");
        lines.push(truncateText(ctx, rest, maxWidth));
        return lines;
      }
    }
  }
  lines.push(truncateText(ctx, current, maxWidth));
  return lines;
}

function drawBackdrop(ctx, W, H, t) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, t.bg);
  grad.addColorStop(1, t.bgGrad);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle decorative tactical pitch arcs (non-intrusive)
  ctx.save();
  ctx.strokeStyle = t.borderSoft;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(W - 90, 120, 260, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(120, H - 140, 220, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Top accent bar
  ctx.fillStyle = t.accent;
  ctx.fillRect(0, 0, W, 12);
}

function drawHeader(ctx, W, pad, t, eyebrow) {
  // Brand pill
  const label = "F5 MANAGER";
  ctx.font = `800 24px ${BODY_FONT}`;
  const lw = ctx.measureText(label).width;
  roundRect(ctx, pad, 56, lw + 44, 48, 24);
  ctx.fillStyle = t.accentSoft;
  ctx.fill();
  ctx.strokeStyle = t.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = t.accent;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(label, pad + 22, 81);

  if (eyebrow) {
    ctx.font = `700 24px ${BODY_FONT}`;
    ctx.fillStyle = t.muted;
    ctx.textAlign = "right";
    ctx.fillText(eyebrow.toUpperCase(), W - pad, 81);
    ctx.textAlign = "left";
  }
}

function drawFooter(ctx, W, H, pad, t, note = "f5manager.lat") {
  ctx.strokeStyle = t.borderSoft;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, H - 96);
  ctx.lineTo(W - pad, H - 96);
  ctx.stroke();

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `700 26px ${BODY_FONT}`;
  ctx.fillStyle = t.accent;
  ctx.fillText(note, pad, H - 52);

  ctx.textAlign = "right";
  ctx.font = `600 22px ${BODY_FONT}`;
  ctx.fillStyle = t.subtle;
  ctx.fillText("Organizá tu chamusca", W - pad, H - 52);
  ctx.textAlign = "left";
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    if (!canvas || typeof canvas.toBlob !== "function") {
      reject(new Error("Canvas toBlob no disponible en este navegador."));
      return;
    }
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("No se pudo generar la imagen PNG."));
    }, "image/png");
  });
}

function loadImageSafe(url) {
  return new Promise((resolve) => {
    if (!url || typeof Image === "undefined") {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 3500);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

/* ============================================================================
 * PRIORITY A — CONVOCATORIA PNG (1080 x 1350)
 * ============================================================================ */

export async function renderInvitePng(data, { palette = "neon", design = "editorial" } = {}) {
  const t = resolveShareTheme(palette, design);
  const W = 1080;
  const H = 1350;
  const pad = 72;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  drawBackdrop(ctx, W, H, t);
  drawHeader(ctx, W, pad, t, "Convocatoria");

  let y = 165;
  if (data.groupName) {
    ctx.font = `700 28px ${BODY_FONT}`;
    ctx.fillStyle = t.accent;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(truncateText(ctx, data.groupName.toUpperCase(), W - pad * 2), pad, y);
    y += 44;
  }

  // Title (up to 2 lines)
  ctx.font = `700 84px ${DISPLAY_FONT}`;
  ctx.fillStyle = t.ink;
  ctx.textBaseline = "alphabetic";
  const titleLines = wrapText(ctx, data.title.toUpperCase(), W - pad * 2, 2);
  titleLines.forEach((line) => {
    ctx.fillText(line, pad, y + 66);
    y += 90;
  });

  // Date & Time hero panel
  y += 26;
  roundRect(ctx, pad, y, W - pad * 2, 190, 28);
  ctx.fillStyle = t.surface;
  ctx.fill();
  ctx.strokeStyle = t.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = `700 22px ${BODY_FONT}`;
  ctx.fillStyle = t.muted;
  ctx.fillText("FECHA Y HORA", pad + 38, y + 54);

  ctx.font = `700 44px ${BODY_FONT}`;
  ctx.fillStyle = t.ink;
  ctx.fillText(truncateText(ctx, data.dateLabel, W - pad * 2 - 76), pad + 38, y + 110);

  if (data.timeLabel) {
    ctx.font = `700 34px ${BODY_FONT}`;
    ctx.fillStyle = t.accent;
    ctx.fillText(data.timeLabel, pad + 38, y + 158);
  }
  y += 222;

  // Venue panel (only when included)
  if (data.venue) {
    roundRect(ctx, pad, y, W - pad * 2, 154, 28);
    ctx.fillStyle = t.surface;
    ctx.fill();
    ctx.strokeStyle = t.borderSoft;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `700 22px ${BODY_FONT}`;
    ctx.fillStyle = t.muted;
    ctx.fillText("CANCHA", pad + 38, y + 54);

    ctx.font = `700 40px ${BODY_FONT}`;
    ctx.fillStyle = t.ink;
    ctx.fillText(truncateText(ctx, data.venue, W - pad * 2 - 76), pad + 38, y + 114);
    y += 186;
  }

  // Spots & Status block
  const cardW = (W - pad * 2 - 24) / 2;
  const cardH = 196;

  // Left card: Confirmed / Capacity
  roundRect(ctx, pad, y, cardW, cardH, 28);
  ctx.fillStyle = t.surfaceAlt;
  ctx.fill();
  ctx.strokeStyle = t.borderSoft;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = `700 22px ${BODY_FONT}`;
  ctx.fillStyle = t.muted;
  ctx.fillText("CONFIRMADOS", pad + 34, y + 54);
  ctx.font = `700 74px ${DISPLAY_FONT}`;
  ctx.fillStyle = t.ink;
  ctx.fillText(`${data.confirmedCount}/${data.capacity}`, pad + 34, y + 144);

  // Right card: Free spots
  const rx = pad + cardW + 24;
  roundRect(ctx, rx, y, cardW, cardH, 28);
  ctx.fillStyle = t.accentSoft;
  ctx.fill();
  ctx.strokeStyle = t.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = `700 22px ${BODY_FONT}`;
  ctx.fillStyle = t.accent;
  ctx.fillText(data.freeSpots > 0 ? "CUPOS LIBRES" : "LISTA DE ESPERA", rx + 34, y + 54);
  ctx.font = `700 74px ${DISPLAY_FONT}`;
  ctx.fillStyle = t.accent;
  ctx.fillText(String(data.freeSpots > 0 ? data.freeSpots : data.waitlistCount), rx + 34, y + 144);

  // CTA banner near bottom
  const ctaY = H - 270;
  roundRect(ctx, pad, ctaY, W - pad * 2, 134, 28);
  ctx.fillStyle = t.accent;
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 38px ${BODY_FONT}`;
  ctx.fillStyle = t.accentInk;
  ctx.fillText(truncateText(ctx, data.ctaText, W - pad * 2 - 64), W / 2, ctaY + 52);

  ctx.font = `600 24px ${BODY_FONT}`;
  ctx.fillStyle = t.accentInk;
  ctx.fillText("Abrí el enlace del mensaje para confirmar tu lugar", W / 2, ctaY + 98);
  ctx.textAlign = "left";

  drawFooter(ctx, W, H, pad, t);
  return canvasToBlob(canvas);
}

/* ============================================================================
 * PRIORITY B — EQUIPOS PNG (1080 x dynamic >= 1350)
 * ============================================================================ */

export async function renderTeamsPng(data, { palette = "neon", design = "editorial" } = {}) {
  const t = resolveShareTheme(palette, design);
  const W = 1080;
  const pad = 64;
  const teams = data.teams || [];
  const cols = teams.length === 1 ? 1 : 2;
  const rowsOfTeams = Math.max(1, Math.ceil(teams.length / cols));

  // Formación por líneas de posición (portero → defensa → medio → delantero).
  const SHORT_TO_POS = { POR: "Goalkeeper", DEF: "Defender", MED: "Midfielder", DEL: "Forward", FLX: "Flexible", INV: "Flexible" };
  const LINE_ORDER = ["Goalkeeper", "Defender", "Midfielder", "Forward", "Flexible"];
  const tokenW = 76, tokenGap = 10, lineH = 84, rowGapF = 10;
  const colGap = 28;
  const colW = cols === 1 ? W - pad * 2 : (W - pad * 2 - colGap) / 2;
  const maxTokens = Math.max(1, Math.floor((colW - 56) / (tokenW + tokenGap)));

  const formationHeight = (tm) => {
    const byLine = {};
    tm.members.forEach((m) => {
      const pos = SHORT_TO_POS[m.positionShort] || "Flexible";
      (byLine[pos] || (byLine[pos] = [])).push(m);
    });
    let rows = 0;
    Object.values(byLine).forEach((lineMembers) => { rows += Math.ceil(lineMembers.length / maxTokens); });
    return boxHeadH + Object.keys(byLine).length * 30 + rows * (lineH + rowGapF) + boxFootPad;
  };

  const boxHeadH = 92;
  const boxFootPad = 24;
  const rowGap = 28;
  const rowHeights = Array.from({ length: rowsOfTeams }, (_, r) => {
    const slice = teams.slice(r * cols, r * cols + cols);
    return Math.max(1, ...slice.map((tm) => formationHeight(tm)));
  });
  const headerH = 296;
  const footerH = 128;
  const contentH = rowHeights.reduce((a, b) => a + b, 0) + (rowsOfTeams - 1) * rowGap;
  const H = Math.max(1350, headerH + contentH + footerH);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  drawBackdrop(ctx, W, H, t);
  drawHeader(ctx, W, pad, t, `${teams.length} Equipos · ${data.totalPlayers} Jugadores`);

  // Title & meta
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 68px ${DISPLAY_FONT}`;
  ctx.fillStyle = t.ink;
  ctx.fillText(truncateText(ctx, data.title.toUpperCase(), W - pad * 2), pad, 198);

  const metaParts = [data.dateLabel, data.timeLabel, data.venue].filter(Boolean).join(" · ");
  ctx.font = `600 28px ${BODY_FONT}`;
  ctx.fillStyle = t.muted;
  ctx.fillText(truncateText(ctx, metaParts, W - pad * 2), pad, 246);

  // Team cards grid
  let curY = headerH;

  for (let r = 0; r < rowsOfTeams; r += 1) {
    const boxH = rowHeights[r];
    for (let c = 0; c < cols; c += 1) {
      const team = teams[r * cols + c];
      if (!team) continue;
      const x = pad + c * (colW + colGap);

      roundRect(ctx, x, curY, colW, boxH, 26);
      ctx.fillStyle = t.surface;
      ctx.fill();
      ctx.strokeStyle = t.borderSoft;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Team color bar
      roundRect(ctx, x, curY, colW, 12, 6);
      ctx.fillStyle = team.color || t.accent;
      ctx.fill();

      // Team header
      ctx.beginPath();
      ctx.arc(x + 34, curY + 52, 11, 0, Math.PI * 2);
      ctx.fillStyle = team.color || t.accent;
      ctx.fill();

      ctx.font = `700 34px ${DISPLAY_FONT}`;
      ctx.fillStyle = t.ink;
      ctx.textBaseline = "middle";
      ctx.fillText(truncateText(ctx, team.name.toUpperCase(), colW - 140), x + 58, curY + 53);

      ctx.textAlign = "right";
      ctx.font = `700 22px ${BODY_FONT}`;
      ctx.fillStyle = t.muted;
      ctx.fillText(`${team.members.length} jug.`, x + colW - 26, curY + 53);
      ctx.textAlign = "left";

      // Divider
      ctx.fillStyle = t.borderSoft;
      ctx.fillRect(x + 24, curY + 84, colW - 48, 2);

      // Members en formación por línea de posición (portero → defensa → medio → delantero).
      // Solo nombre deportivo, posición corta y color: sin ratings ni datos privados.
      const LINE_LABEL = { Goalkeeper: "POR", Defender: "DEF", Midfielder: "MED", Forward: "DEL", Flexible: "FLX" };
      const byLine = {};
      team.members.forEach((m) => {
        const pos = SHORT_TO_POS[m.positionShort] || "Flexible";
        (byLine[pos] || (byLine[pos] = [])).push(m);
      });
      const drawToken = (tx, ty, m) => {
        const fullPos = SHORT_TO_POS[m.positionShort] || "Flexible";
        const pc = positionColor(fullPos);
        roundRect(ctx, tx, ty, tokenW, lineH, 10);
        ctx.fillStyle = t.surfaceAlt;
        ctx.fill();
        ctx.strokeStyle = pc;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = `700 20px ${DISPLAY_FONT}`;
        ctx.fillStyle = pc;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(m.positionShort || "FLX", tx + tokenW / 2, ty + 28);
        ctx.font = `600 15px ${BODY_FONT}`;
        ctx.fillStyle = t.ink;
        ctx.textBaseline = "alphabetic";
        ctx.fillText(truncateText(ctx, m.name, tokenW - 10), tx + tokenW / 2, ty + lineH - 14);
        ctx.textAlign = "left";
      };
      let my = curY + boxHeadH + 16;
      LINE_ORDER.forEach((line) => {
        const members = byLine[line];
        if (!members || members.length === 0) return;
        ctx.font = `700 18px ${BODY_FONT}`;
        ctx.fillStyle = t.muted;
        ctx.textBaseline = "middle";
        ctx.fillText(LINE_LABEL[line], x + 26, my);
        my += 24;
        let rowCount = 0;
        members.forEach((m) => {
          if (rowCount >= maxTokens) {
            my += lineH + rowGapF;
            rowCount = 0;
          }
          drawToken(x + 26 + rowCount * (tokenW + tokenGap), my, m);
          rowCount += 1;
        });
        my += lineH + rowGapF + 6;
      });
    }
    curY += boxH + rowGap;
  }

  drawFooter(ctx, W, H, pad, t);
  return canvasToBlob(canvas);
}

/* ============================================================================
 * PRIORITY C — MI FIFA PNG (1080 x 1350)
 * ============================================================================ */

export async function renderFifaPng(data, { palette = "neon", design = "editorial" } = {}) {
  const t = resolveShareTheme(palette, design);
  const W = 1080;
  const H = 1350;
  const pad = 72;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  drawBackdrop(ctx, W, H, t);
  drawHeader(ctx, W, pad, t, "Tarjeta Deportiva");

  // Hero card with avatar + name + position
  const heroY = 138;
  roundRect(ctx, pad, heroY, W - pad * 2, 260, 30);
  ctx.fillStyle = t.surface;
  ctx.fill();
  ctx.strokeStyle = t.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Avatar circle (photo if allowed & loaded, otherwise crisp initials)
  const cx = pad + 124;
  const cy = heroY + 130;
  const r = 86;
  const img = data.avatarUrl ? await loadImageSafe(data.avatarUrl) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img) {
    const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = t.accentSoft;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.font = `700 62px ${DISPLAY_FONT}`;
    ctx.fillStyle = t.accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(data.initials, cx, cy + 2);
    ctx.textAlign = "left";
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = t.accent;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Position badge & player sports name
  const infoX = pad + 244;
  const infoMaxW = W - pad - infoX - 30;
  roundRect(ctx, infoX, heroY + 46, 92, 38, 10);
  ctx.fillStyle = t.accent;
  ctx.fill();
  ctx.font = `800 22px ${BODY_FONT}`;
  ctx.fillStyle = t.accentInk;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(data.positionShort, infoX + 46, heroY + 66);
  ctx.textAlign = "left";

  ctx.font = `700 58px ${DISPLAY_FONT}`;
  ctx.fillStyle = t.ink;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(truncateText(ctx, data.name.toUpperCase(), infoMaxW), infoX, heroY + 158);

  const posText = data.secondaryPosition
    ? `${data.positionLabel} · También ${data.secondaryPosition}`
    : data.positionLabel;
  ctx.font = `600 28px ${BODY_FONT}`;
  ctx.fillStyle = t.muted;
  ctx.fillText(truncateText(ctx, posText, infoMaxW), infoX, heroY + 206);

  // Verified stats section (4 tiles)
  let y = heroY + 292;
  ctx.font = `700 22px ${BODY_FONT}`;
  ctx.fillStyle = t.muted;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("ESTADÍSTICAS CONFIRMADAS", pad, y);
  y += 22;

  const statTiles = [
    { label: "PARTIDOS", value: data.verified.played },
    { label: "GOLES", value: data.verified.goals },
    { label: "ASISTENCIAS", value: data.verified.assists },
    { label: "MVP OFICIAL", value: data.verified.mvps },
  ];
  const tileGap = 18;
  const tileW = (W - pad * 2 - tileGap * 3) / 4;
  const tileH = 148;
  statTiles.forEach((tile, idx) => {
    const tx = pad + idx * (tileW + tileGap);
    roundRect(ctx, tx, y, tileW, tileH, 22);
    ctx.fillStyle = t.surface;
    ctx.fill();
    ctx.strokeStyle = t.borderSoft;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.font = `700 58px ${DISPLAY_FONT}`;
    ctx.fillStyle = idx === 3 && tile.value > 0 ? t.gold : t.ink;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(String(tile.value), tx + tileW / 2, y + 86);

    ctx.font = `700 18px ${BODY_FONT}`;
    ctx.fillStyle = t.muted;
    ctx.fillText(tile.label, tx + tileW / 2, y + 124);
  });
  ctx.textAlign = "left";
  y += tileH + 34;

  // Self-declared style panel (clearly labelled!)
  const styleBoxH = data.hasStyle ? 344 : 136;
  roundRect(ctx, pad, y, W - pad * 2, styleBoxH, 26);
  ctx.fillStyle = t.surface;
  ctx.fill();
  ctx.strokeStyle = t.borderSoft;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = `700 24px ${BODY_FONT}`;
  ctx.fillStyle = t.ink;
  ctx.textBaseline = "middle";
  ctx.fillText("ESTILO DE JUEGO", pad + 34, y + 46);

  // Explicit badge: AUTODECLARADO
  const badgeTxt = "AUTODECLARADO";
  ctx.font = `700 18px ${BODY_FONT}`;
  const bw = ctx.measureText(badgeTxt).width + 28;
  roundRect(ctx, W - pad - 34 - bw, y + 28, bw, 34, 17);
  ctx.fillStyle = t.accentSoft;
  ctx.fill();
  ctx.fillStyle = t.accent;
  ctx.textAlign = "center";
  ctx.fillText(badgeTxt, W - pad - 34 - bw / 2, y + 46);
  ctx.textAlign = "left";

  if (data.hasStyle) {
    const barLeft = pad + 260;
    const barW = W - pad * 2 - 360;
    data.styleBars.forEach((b, i) => {
      const by = y + 104 + i * 48;
      ctx.font = `600 24px ${BODY_FONT}`;
      ctx.fillStyle = t.muted;
      ctx.fillText(b.label, pad + 34, by);

      roundRect(ctx, barLeft, by - 9, barW, 18, 9);
      ctx.fillStyle = t.surfaceAlt;
      ctx.fill();

      const fillW = Math.max(0, (b.value / 10) * barW);
      if (fillW > 0) {
        roundRect(ctx, barLeft, by - 9, Math.max(18, fillW), 18, 9);
        ctx.fillStyle = t.accent;
        ctx.fill();
      }

      ctx.textAlign = "right";
      ctx.font = `700 24px ${BODY_FONT}`;
      ctx.fillStyle = t.ink;
      ctx.fillText(`${b.value}/10`, W - pad - 34, by);
      ctx.textAlign = "left";
    });
  } else {
    ctx.font = `500 24px ${BODY_FONT}`;
    ctx.fillStyle = t.muted;
    ctx.fillText("Estilo autodeclarado aún no configurado por el jugador.", pad + 34, y + 98);
  }
  y += styleBoxH + 34;

  // Confirmed achievements
  if (data.awards.length > 0) {
    ctx.font = `700 22px ${BODY_FONT}`;
    ctx.fillStyle = t.muted;
    ctx.textBaseline = "alphabetic";
    ctx.fillText("RECONOCIMIENTOS CONFIRMADOS", pad, y);
    y += 22;

    let px = pad;
    let py = y;
    ctx.font = `700 24px ${BODY_FONT}`;
    data.awards.forEach((a) => {
      const tw = ctx.measureText(a.label).width + 44;
      if (px + tw > W - pad) {
        px = pad;
        py += 62;
      }
      roundRect(ctx, px, py, tw, 48, 24);
      ctx.fillStyle = t.accentSoft;
      ctx.fill();
      ctx.strokeStyle = t.border;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = t.accent;
      ctx.textBaseline = "middle";
      ctx.fillText(a.label, px + 22, py + 25);
      px += tw + 16;
    });
  }

  drawFooter(ctx, W, H, pad, t);
  return canvasToBlob(canvas);
}

/* ============================================================================
 * PRIORITY D — RESULTADO FINAL PNG (1080 x 1350)
 * ============================================================================ */

export async function renderResultPng(data, { palette = "neon", design = "editorial" } = {}) {
  const t = resolveShareTheme(palette, design);
  const W = 1080;
  const H = 1350;
  const pad = 72;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  drawBackdrop(ctx, W, H, t);
  drawHeader(ctx, W, pad, t, "Resultado Final");

  // Title & Date
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 68px ${DISPLAY_FONT}`;
  ctx.fillStyle = t.ink;
  ctx.fillText(truncateText(ctx, data.title.toUpperCase(), W - pad * 2), pad, 200);

  const when = [data.dateLabel, data.timeLabel].filter(Boolean).join(" · ");
  ctx.font = `600 28px ${BODY_FONT}`;
  ctx.fillStyle = t.muted;
  ctx.fillText(truncateText(ctx, when, W - pad * 2), pad, 248);

  // Scoreboard panel
  let y = 286;
  const boardH = data.teams.length > 2 ? 250 : 230;
  roundRect(ctx, pad, y, W - pad * 2, boardH, 30);
  ctx.fillStyle = t.surface;
  ctx.fill();
  ctx.strokeStyle = t.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  if (data.teams.length === 2) {
    const [a, b] = data.teams;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Team A
    ctx.font = `700 32px ${DISPLAY_FONT}`;
    ctx.fillStyle = a.color || t.accent;
    ctx.fillText(truncateText(ctx, a.name.toUpperCase(), 320), pad + 200, y + 66);
    ctx.font = `700 108px ${DISPLAY_FONT}`;
    ctx.fillStyle = t.ink;
    ctx.fillText(String(a.goals), pad + 200, y + 152);

    // VS separator
    ctx.font = `700 54px ${DISPLAY_FONT}`;
    ctx.fillStyle = t.subtle;
    ctx.fillText("–", W / 2, y + 146);

    // Team B
    ctx.font = `700 32px ${DISPLAY_FONT}`;
    ctx.fillStyle = b.color || t.accent;
    ctx.fillText(truncateText(ctx, b.name.toUpperCase(), 320), W - pad - 200, y + 66);
    ctx.font = `700 108px ${DISPLAY_FONT}`;
    ctx.fillStyle = t.ink;
    ctx.fillText(String(b.goals), W - pad - 200, y + 152);
    ctx.textAlign = "left";
  } else if (data.teams.length > 2) {
    const stepW = (W - pad * 2 - 40) / data.teams.length;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    data.teams.forEach((tm, i) => {
      const tx = pad + 20 + stepW * i + stepW / 2;
      ctx.font = `700 28px ${DISPLAY_FONT}`;
      ctx.fillStyle = tm.color || t.accent;
      ctx.fillText(truncateText(ctx, tm.name.toUpperCase(), stepW - 20), tx, y + 72);
      ctx.font = `700 84px ${DISPLAY_FONT}`;
      ctx.fillStyle = t.ink;
      ctx.fillText(String(tm.goals), tx, y + 162);
    });
    ctx.textAlign = "left";
  } else {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 84px ${DISPLAY_FONT}`;
    ctx.fillStyle = t.accent;
    ctx.fillText(`${data.totalGoals} GOLES`, W / 2, y + 98);
    ctx.font = `600 28px ${BODY_FONT}`;
    ctx.fillStyle = t.muted;
    ctx.fillText(`${data.confirmedCount} jugadores · ${data.totalAssists} asistencias`, W / 2, y + 166);
    ctx.textAlign = "left";
  }
  y += boardH + 28;

  // Official MVP banner — ONLY rendered when officialMvp exists (never invented!)
  if (data.officialMvp) {
    roundRect(ctx, pad, y, W - pad * 2, 134, 26);
    ctx.fillStyle = t.accentSoft;
    ctx.fill();
    ctx.strokeStyle = t.border;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textBaseline = "alphabetic";
    ctx.font = `700 22px ${BODY_FONT}`;
    ctx.fillStyle = t.accent;
    ctx.fillText("MVP OFICIAL DEL PARTIDO", pad + 36, y + 48);

    ctx.font = `700 48px ${DISPLAY_FONT}`;
    ctx.fillStyle = t.ink;
    ctx.fillText(truncateText(ctx, data.officialMvp.toUpperCase(), W - pad * 2 - 72), pad + 36, y + 106);
    y += 164;
  }

  // Confirmed stats columns (Scorers & Assisters)
  const panelH = H - y - 134;
  const hasScorers = data.scorers.length > 0;
  const hasAssisters = data.assisters.length > 0;
  if (hasScorers || hasAssisters) {
    const cols = hasScorers && hasAssisters ? 2 : 1;
    const gap = 24;
    const cw = cols === 2 ? (W - pad * 2 - gap) / 2 : W - pad * 2;

    const drawListPanel = (px, heading, items, unit) => {
      roundRect(ctx, px, y, cw, Math.min(panelH, 420), 26);
      ctx.fillStyle = t.surface;
      ctx.fill();
      ctx.strokeStyle = t.borderSoft;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textBaseline = "alphabetic";
      ctx.font = `700 22px ${BODY_FONT}`;
      ctx.fillStyle = t.muted;
      ctx.fillText(heading, px + 32, y + 50);

      items.forEach((item, idx) => {
        const iy = y + 104 + idx * 58;
        ctx.font = `600 28px ${BODY_FONT}`;
        ctx.fillStyle = t.ink;
        ctx.fillText(truncateText(ctx, item.name, cw - 130), px + 32, iy);

        ctx.textAlign = "right";
        ctx.font = `700 30px ${DISPLAY_FONT}`;
        ctx.fillStyle = t.accent;
        ctx.fillText(`${item.value} ${unit}`, px + cw - 32, iy);
        ctx.textAlign = "left";
      });
    };

    if (hasScorers) drawListPanel(pad, "GOLEADORES CONFIRMADOS", data.scorers, "G");
    if (hasAssisters) drawListPanel(cols === 2 ? pad + cw + gap : pad, "ASISTENCIAS CONFIRMADAS", data.assisters, "A");
  } else {
    roundRect(ctx, pad, y, W - pad * 2, 160, 26);
    ctx.fillStyle = t.surface;
    ctx.fill();
    ctx.strokeStyle = t.borderSoft;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 28px ${BODY_FONT}`;
    ctx.fillStyle = t.muted;
    ctx.fillText(`${data.confirmedCount} jugadores participaron en este partido`, W / 2, y + 80);
    ctx.textAlign = "left";
  }

  drawFooter(ctx, W, H, pad, t);
  return canvasToBlob(canvas);
}
