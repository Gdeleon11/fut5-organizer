import React from "react";
import Avatar from "./Avatar.jsx";
import { displayName } from "../utils.js";
import { SKILL_OPTIONS } from "../constants.js";

// Helper to calculate FIFA FUT attributes based on player skills, rating and position
export function calculateFifaStats(profile, ratingObj = null, playerSkills = [], isGuest = false, guestRating = 3) {
  // If guest, use guestRating (1-5) as base. If registered, use ratingObj.rating or fallback to 3.
  const overallRating = isGuest ? guestRating : (ratingObj?.rating || 3);
  
  const rAtt = isGuest ? guestRating : (ratingObj?.attack_rating || overallRating);
  const rMid = isGuest ? guestRating : (ratingObj?.midfield_rating || overallRating);
  const rDef = isGuest ? guestRating : (ratingObj?.defense_rating || overallRating);
  const rGk = isGuest ? guestRating : (ratingObj?.goalkeeper_rating || overallRating);
  
  const overall = Math.round(overallRating * 20); // Scale 1-5 to 20-100
  
  // Base attributes calculations
  let pac = Math.round(rAtt * 16 + rMid * 4); // Pace
  let sho = Math.round(rAtt * 20);           // Shooting
  let pas = Math.round(rMid * 15 + rAtt * 5); // Passing
  let dri = Math.round(rMid * 12 + rAtt * 8); // Dribbling
  let def = Math.round(rDef * 20);           // Defending
  let phy = Math.round(rDef * 12 + rMid * 8); // Physicality
  
  // Position adjustments
  const pos = profile?.preferred_position || "Flexible";
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
  const skillIds = playerSkills.map(s => typeof s === "string" ? s : s.skill);
  if (skillIds.includes("wings") || skillIds.includes("speedy")) pac += 12;
  if (skillIds.includes("cannon") || skillIds.includes("strong_leg")) sho += 12;
  if (skillIds.includes("tactician") || skillIds.includes("wizard")) pas += 10;
  if (skillIds.includes("wizard")) dri += 12;
  if (skillIds.includes("shield")) { def += 12; phy += 10; }
  if (skillIds.includes("goalkeeper")) def += 15;
  if (skillIds.includes("veteran")) { pas += 5; phy -= 5; }
  if (skillIds.includes("captain")) { phy += 8; pas += 5; }
  
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

export default function FifaCard({ profile, ratingObj, playerSkills = [], isGuest = false, guestRating = 3 }) {
  const stats = calculateFifaStats(profile, ratingObj, playerSkills, isGuest, guestRating);
  
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
  const skillIds = playerSkills.map(s => typeof s === "string" ? s : s.skill);
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
  const activeSkillEmojis = playerSkills
    .map(s => {
      const sId = typeof s === "string" ? s : s.skill;
      return SKILL_MAP[sId]?.emoji;
    })
    .filter(Boolean)
    .slice(0, 3);
    
  return (
    <div className={`fifa-card-container ${cardClass}`}>
      <div className="fifa-card-inner">
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
  );
}
