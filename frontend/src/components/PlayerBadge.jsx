function countFourStars(rating) {
  if (!rating) return 0;
  return [
    rating.attack_rating,
    rating.defense_rating,
    rating.midfield_rating,
    rating.goalkeeper_rating,
  ].filter((r) => r >= 4).length;
}

function avgRating(rating) {
  if (!rating) return 0;
  const values = [
    rating.attack_rating,
    rating.defense_rating,
    rating.midfield_rating,
    rating.goalkeeper_rating,
  ].filter(Boolean);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function getTier(rating) {
  const fourStars = countFourStars(rating);
  const avg = avgRating(rating);

  if (fourStars >= 3) return { label: "Oro", className: "badge-gold" };
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
