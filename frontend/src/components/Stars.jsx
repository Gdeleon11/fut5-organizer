import { STAR_LEVELS } from "../constants.js";
import { classNames, normalizedRating, ratingLabel } from "../utils.js";

export default function Stars({ rating, interactive = false }) {
  const value = normalizedRating(rating);

  return (
    <span
      aria-label={ratingLabel(rating)}
      className={classNames("stars", interactive && "is-interactive")}
    >
      {STAR_LEVELS.map((level) => (
        <span className={level <= value ? "is-filled" : ""} key={level}>
          ★
        </span>
      ))}
    </span>
  );
}
