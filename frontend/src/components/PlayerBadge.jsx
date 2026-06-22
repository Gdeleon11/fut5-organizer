function countFourStars(rating) {
  if (!rating) return 0;
  const vals = [
    rating.attack_rating,
    rating.defense_rating,
    rating.midfield_rating,
    rating.goalkeeper_rating,
  ].filter((r) => r != null && r > 0);
  return vals.filter((r) => r >= 4).length;
}

function avgRating(rating) {
  if (!rating) return 0;
  const vals = [
    rating.attack_rating,
    rating.defense_rating,
    rating.midfield_rating,
    rating.goalkeeper_rating,
  ].filter((r) => r != null && r > 0);
  if (vals.length === 0) return rating.rating || 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function getTier(rating) {
  const overall = rating?.rating || 0;
  const fourStars = countFourStars(rating);
  const avg = avgRating(rating);

  if (overall >= 4) return { label: "Oro", className: "badge-gold" };
  if (fourStars >= 2) return { label: "Oro", className: "badge-gold" };
  if (avg >= 3.5) return { label: "Plata", className: "badge-silver" };
  if (avg >= 2.5) return { label: "Cobre", className: "badge-bronze" };
  return { label: "Hierro", className: "badge-iron" };
}

export default function PlayerBadge({ rating }) {
  const tier = getTier(rating);

  return (
    <span className={`player-badge ${tier.className}`}>
      {tier.label}
    </span>
  );
}
