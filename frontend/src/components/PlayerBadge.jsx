function totalStars(rating) {
  if (!rating) return 0;
  const fallback = rating.rating || 0;
  const vals = [
    rating.attack_rating,
    rating.defense_rating,
    rating.midfield_rating,
    rating.goalkeeper_rating,
  ].map((r) => (r != null && r > 0 ? r : fallback));
  return vals.reduce((a, b) => a + b, 0);
}

function getTier(rating) {
  const total = totalStars(rating);

  if (total >= 13) return { label: "Platino", className: "badge-platinum" };
  if (total >= 10) return { label: "Oro", className: "badge-gold" };
  if (total >= 7) return { label: "Plata", className: "badge-silver" };
  return { label: "Cobre", className: "badge-bronze" };
}

export default function PlayerBadge({ rating }) {
  const tier = getTier(rating);

  return (
    <span className={`player-badge ${tier.className}`}>
      {tier.label}
    </span>
  );
}
