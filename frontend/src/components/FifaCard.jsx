import React from "react";
import Avatar from "./Avatar.jsx";
import { displayName } from "../utils.js";
import { SKILL_OPTIONS } from "../constants.js";

// Helper to calculate FIFA FUT attributes based on player skills, rating, position and historical match stats
export function calculateFifaStats(profile, ratingObj = null, playerSkills = [], isGuest = false, guestRating = 3, matchStats = []) {
  const pos = profile?.preferred_position || "Flexible";
  
  let overallRating = 3;
  if (isGuest) {
    overallRating = guestRating;
  } else if (ratingObj) {
    const att = ratingObj.attack_rating || 3;
    const mid = ratingObj.midfield_rating || 3;
    const def = ratingObj.defense_rating || 3;
    const gk = ratingObj.goalkeeper_rating || 3;
    
    if (pos === "Goalkeeper") {
      overallRating = gk;
    } else if (pos === "Forward") {
      overallRating = (att * 2 + mid) / 3;
    } else if (pos === "Defender") {
      overallRating = (def * 2 + mid) / 3;
    } else if (pos === "Midfielder") {
      overallRating = (mid * 2 + att + def) / 4;
    } else {
      overallRating = (att + mid + def) / 3;
    }
  }
  
  const rAtt = isGuest ? guestRating : (ratingObj?.attack_rating || overallRating);
  const rMid = isGuest ? guestRating : (ratingObj?.midfield_rating || overallRating);
  const rDef = isGuest ? guestRating : (ratingObj?.defense_rating || overallRating);
  const rGk = isGuest ? guestRating : (ratingObj?.goalkeeper_rating || overallRating);
  
  // Base attributes calculations
  let pac = Math.round(rAtt * 16 + rMid * 4); // Pace
  let sho = Math.round(rAtt * 20);           // Shooting
  let pas = Math.round(rMid * 15 + rAtt * 5); // Passing
  let dri = Math.round(rMid * 12 + rAtt * 8); // Dribbling
  let def = Math.round(rDef * 20);           // Defending
  let phy = Math.round(rDef * 12 + rMid * 8); // Physicality
  
  // Position adjustments
  if (pos === "Forward") {
    pac += 8;
    sho += 10;
    def -= 15;
  } else if (pos === "Defender") {
    def += 15;
    phy += 8;
    sho -= 10;
  } else if (pos === "Goalkeeper") {
    pac -= 12;
    sho -= 25;
    pas -= 8;
    def += 18; // GK reflexes/handling
  }
  
  // Skill adjustments
  const skillIds = (playerSkills || []).map(s => typeof s === "string" ? s : s?.skill).filter(Boolean);
  if (skillIds.includes("wings") || skillIds.includes("speedy")) pac += 12;
  if (skillIds.includes("cannon") || skillIds.includes("strong_leg")) sho += 12;
  if (skillIds.includes("tactician") || skillIds.includes("wizard")) pas += 10;
  if (skillIds.includes("wizard")) dri += 12;
  if (skillIds.includes("shield")) { def += 12; phy += 10; }
  if (skillIds.includes("goalkeeper")) def += 15;
  if (skillIds.includes("veteran")) { pas += 5; phy -= 5; }
  if (skillIds.includes("captain")) { phy += 8; pas += 5; }
  
  // --- Dynamic Stats Boosts ---
  const playerId = profile?.id;
  const playerStatsList = (matchStats || []).filter(s =>
    s && (isGuest
      ? s.guest_player_id === playerId
      : s.player_id === playerId)
  );

  const totalGoals = playerStatsList.reduce((sum, s) => sum + (s.goals || 0), 0);
  const totalAssists = playerStatsList.reduce((sum, s) => sum + (s.assists || 0), 0);
  const totalMvps = playerStatsList.filter(s => s.mvp).length;
  const totalCleanSheets = playerStatsList.filter(s => s.clean_sheet).length;

  // Boost ratios (max boost is +10)
  const paceBoost = Math.min(10, Math.floor(totalAssists / 4) + Math.floor(totalMvps / 3));
  const shootBoost = Math.min(10, Math.floor(totalGoals / 3));
  const passBoost = Math.min(10, Math.floor(totalAssists / 3) + Math.floor(totalMvps / 2));
  const dribbleBoost = Math.min(10, Math.floor(totalGoals / 4) + Math.floor(totalAssists / 4));
  const defBoost = Math.min(10, Math.floor(totalCleanSheets / 4) + Math.floor(totalMvps / 4));
  const phyBoost = Math.min(10, Math.floor(playerStatsList.length / 5) + Math.floor(totalMvps / 3));

  pac += paceBoost;
  sho += shootBoost;
  pas += passBoost;
  dri += dribbleBoost;
  def += defBoost;
  phy += phyBoost;

  // Boost Overall: +1 Overall per 2 MVPs or 10 goals + assists combined (max +5 overall)
  const overallBoost = Math.min(5, Math.floor(totalMvps / 2) + Math.floor((totalGoals + totalAssists) / 10));
  const overall = Math.round(overallRating * 20) + overallBoost;

  // Constraints: stats between 30 and 99
  const cap = (val) => Math.max(30, Math.min(99, val));
  
  return {
    overall: cap(overall),
    pac: cap(pac),
    sho: cap(sho),
    pas: cap(pas),
    dri: cap(dri),
    def: cap(def),
    phy: cap(phy)
  };
}

export default function FifaCard({
  profile,
  ratingObj,
  playerSkills = [],
  isGuest = false,
  guestRating = 3,
  matchStats = [],
  showStats = false,
}) {
  const stats = calculateFifaStats(profile, ratingObj, playerSkills, isGuest, guestRating, matchStats);
  
  // Position abbreviations
  const posMap = {
    Forward: "DEL",
    Midfielder: "MED",
    Defender: "DFC",
    Goalkeeper: "POR",
    Flexible: "FLX"
  };
  const position = isGuest ? "FLX" : (posMap[profile?.preferred_position] || "FLX");
  const name = isGuest ? (profile?.full_name || "Invitado") : (profile?.nickname || profile?.full_name?.split(" ")[0] || "Jugador");
  
  // Determine card tier/style based on overall rating and special skills
  const skillIds = (playerSkills || []).map(s => typeof s === "string" ? s : s?.skill).filter(Boolean);
  const isSpecial = skillIds.includes("wizard") || skillIds.includes("captain");
  
  let cardClass = "bronze";
  if (isSpecial) {
    cardClass = "special";
  } else if (stats.overall >= 80) {
    cardClass = "gold";
  } else if (stats.overall >= 60) {
    cardClass = "silver";
  }
  
  // Find skill emojis
  const SKILL_MAP = Object.fromEntries(SKILL_OPTIONS.map((o) => [o.id, o]));
  const activeSkillEmojis = (playerSkills || [])
    .map(s => {
      const sId = typeof s === "string" ? s : s?.skill;
      return SKILL_MAP[sId]?.emoji;
    })
    .filter(Boolean)
    .slice(0, 3);
    
  // Position watermarks
  const watermarkMap = {
    Forward: "🔥",
    Defender: "🛡️",
    Midfielder: "⚡",
    Goalkeeper: "🧤",
    Flexible: "⚽"
  };
  const watermark = isGuest ? "⚽" : (watermarkMap[profile?.preferred_position] || "⚽");
  
  // Compute bio stats
  const playerId = profile?.id;
  const playerStatsList = (matchStats || []).filter(s =>
    s && (isGuest
      ? s.guest_player_id === playerId
      : s.player_id === playerId)
  );
  const totalGoals = playerStatsList.reduce((sum, s) => sum + (s.goals || 0), 0);
  const totalAssists = playerStatsList.reduce((sum, s) => sum + (s.assists || 0), 0);
  const totalMvps = playerStatsList.filter(s => s.mvp).length;
  const totalCleanSheets = playerStatsList.filter(s => s.clean_sheet).length;
  const totalMatches = playerStatsList.length;
    
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
      <div className={`fifa-card-container ${cardClass}`}>
        <div className="fifa-card-inner">
          {/* Position Watermark Background */}
          <div className="fifa-watermark">{watermark}</div>
          
          {/* Top Header - Rating & Position */}
          <div className="fifa-card-badge">
            <span className="fifa-overall">{stats.overall}</span>
            <span className="fifa-pos">{position}</span>
            <span className="fifa-logo">⚽</span>
          </div>
          
          {/* Player Avatar */}
          <div className="fifa-avatar-wrap">
            {isGuest ? (
              <div className="fifa-placeholder-avatar">G</div>
            ) : (
              <Avatar profile={profile} size="lg" />
            )}
          </div>
          
          {/* Player Name */}
          <div className="fifa-name-wrap">
            <span className="fifa-player-name">{name}</span>
          </div>
          
          {/* Stats Divider Line */}
          <div className="fifa-divider" />
          
          {/* Numerical Attributes Grid */}
          <div className="fifa-stats-grid">
            <div className="fifa-stat-col">
              <span className="fifa-stat-val">{stats.pac}</span>
              <span className="fifa-stat-lbl">RIT</span>
            </div>
            <div className="fifa-stat-col">
              <span className="fifa-stat-val">{stats.sho}</span>
              <span className="fifa-stat-lbl">TIR</span>
            </div>
            <div className="fifa-stat-col">
              <span className="fifa-stat-val">{stats.pas}</span>
              <span className="fifa-stat-lbl">PAS</span>
            </div>
            <div className="fifa-stat-col">
              <span className="fifa-stat-val">{stats.dri}</span>
              <span className="fifa-stat-lbl">REG</span>
            </div>
            <div className="fifa-stat-col">
              <span className="fifa-stat-val">{stats.def}</span>
              <span className="fifa-stat-lbl">DEF</span>
            </div>
            <div className="fifa-stat-col">
              <span className="fifa-stat-val">{stats.phy}</span>
              <span className="fifa-stat-lbl">FIS</span>
            </div>
          </div>
          
          {/* Chemistry Badges (Skills) */}
          {activeSkillEmojis.length > 0 && (
            <div className="fifa-chem-badges">
              {activeSkillEmojis.map((emoji, index) => (
                <span key={index} className="fifa-chem-badge" title="Habilidad especial">
                  {emoji}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {showStats && (totalMatches > 0 || isGuest) && (
        <div
          className="fifa-card-stats-bio"
          style={{
            width: "100%",
            maxWidth: "280px",
            background: "var(--surface-3)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "0.75rem 1rem",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.5rem 1rem",
            fontSize: "0.82rem",
            color: "var(--text-primary)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            textAlign: "left"
          }}
        >
          <span
            style={{
              gridColumn: "span 2",
              textAlign: "center",
              fontWeight: "bold",
              borderBottom: "1px solid var(--border-light)",
              paddingBottom: "0.25rem",
              marginBottom: "0.25rem"
            }}
          >
            Historial en el Grupo
          </span>
          <span>Partidos: <strong>{totalMatches}</strong></span>
          <span>Goles: <strong>{totalGoals} ⚽</strong></span>
          <span>Asistencias: <strong>{totalAssists} 👟</strong></span>
          <span>MVPs: <strong>{totalMvps} 👑</strong></span>
          {totalCleanSheets > 0 && (
            <span style={{ gridColumn: "span 2" }}>
              Vallas Invictas: <strong>{totalCleanSheets} 🧤</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
