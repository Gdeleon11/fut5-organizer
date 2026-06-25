import { useState } from "react";

export default function VoteButtons({ score, userVote, onVote, disabled }) {
  const [voting, setVoting] = useState(false);

  async function handleVote(value) {
    if (voting || disabled) return;
    setVoting(true);
    try {
      await onVote(value);
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="vote-buttons">
      <button
        className={`vote-btn vote-up ${userVote === 1 ? "is-active" : ""}`}
        type="button"
        disabled={voting || disabled}
        onClick={() => handleVote(1)}
        title="Votar positivo"
      >
        ▲
      </button>
      <span className={`vote-score ${score > 0 ? "positive" : score < 0 ? "negative" : ""}`}>
        {score > 0 ? `+${score}` : score}
      </span>
      <button
        className={`vote-btn vote-down ${userVote === -1 ? "is-active" : ""}`}
        type="button"
        disabled={voting || disabled}
        onClick={() => handleVote(-1)}
        title="Votar negativo"
      >
        ▼
      </button>
    </div>
  );
}
