import { STAR_LABELS, STAR_LEVELS } from "../constants.js";
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
