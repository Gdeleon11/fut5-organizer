const BADGE_TIERS = [
  { min: 4, label: "Oro", className: "badge-gold" },
  { min: 3, label: "Plata", className: "badge-silver" },
  { min: 2, label: "Cobre", className: "badge-bronze" },
  { min: 0, label: "Hierro", className: "badge-iron" },
];

export default function PlayerBadge({ rating }) {
  const overall = rating?.rating || 0;
  const tier = BADGE_TIERS.find((t) => overall >= t.min) || BADGE_TIERS[BADGE_TIERS.length - 1];

  return (
    <span className={`player-badge ${tier.className}`}>
      {tier.label}
    </span>
  );
}
