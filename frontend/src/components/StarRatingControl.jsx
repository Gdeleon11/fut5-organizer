import { POSITION_LABELS, STAR_LABELS, STAR_LEVELS } from "../constants.js";
import { normalizedRating } from "../utils.js";
import Stars from "./Stars.jsx";

export default function StarRatingControl({ currentRating, onSelect }) {
  return (
    <div className="star-level-grid" aria-label="Asignar estrellas al jugador">
      {STAR_LEVELS.map((level) => (
        <button
          className={normalizedRating(currentRating) === level ? "" : "secondary-button"}
          key={level}
          type="button"
          onClick={() => onSelect(level)}
        >
          <Stars rating={level} interactive />
          <small>{STAR_LABELS[level]}</small>
        </button>
      ))}
    </div>
  );
}

const POSITION_RATING_KEYS = [
  { key: "attack_rating", position: "Forward", label: "Ataque" },
  { key: "defense_rating", position: "Defender", label: "Defensa" },
  { key: "midfield_rating", position: "Midfielder", label: "Medio" },
  { key: "goalkeeper_rating", position: "Goalkeeper", label: "Portero" },
];

export function PositionRatingControl({ ratings, onSelect }) {
  return (
    <div className="position-rating-control">
      {POSITION_RATING_KEYS.map(({ key, label }) => (
        <div className="position-rating-row" key={key}>
          <span className="position-rating-label">{label}</span>
          <div className="star-level-grid compact">
            {STAR_LEVELS.map((level) => (
              <button
                className={ratings[key] === level ? "" : "secondary-button"}
                key={level}
                type="button"
                onClick={() => onSelect(key, level)}
              >
                <Stars rating={level} interactive />
                <small>{STAR_LABELS[level]}</small>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PositionRatingDisplay({ ratings }) {
  if (!ratings) return <span className="muted">Sin estrellas</span>;

  return (
    <div className="position-rating-display">
      {POSITION_RATING_KEYS.map(({ key, label }) => (
        <span className="position-rating-item" key={key}>
          <small>{label}</small>
          <Stars rating={ratings[key] || 0} />
        </span>
      ))}
    </div>
  );
}
