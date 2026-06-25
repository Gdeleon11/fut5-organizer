import { useState } from "react";

export default function VoteButtons({ average, totalVotes, userVote, onVote, disabled }) {
  const [open, setOpen] = useState(false);

  function handleSelect(value) {
    onVote(value);
    setOpen(false);
  }

  return (
    <div className="vote-system">
      <button
        className="vote-average-btn"
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title={totalVotes > 0 ? `${totalVotes} voto(s)` : "Sin votos"}
      >
        <span className="vote-avg-number">{average > 0 ? average.toFixed(1) : "—"}</span>
        <small>{totalVotes > 0 ? `${totalVotes} voto${totalVotes > 1 ? "s" : ""}` : "Votar"}</small>
      </button>
      {userVote > 0 && (
        <span className="vote-your-score">Tu voto: {userVote}</span>
      )}
      {open && (
        <div className="vote-picker">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              className={`vote-picker-btn ${userVote === n ? "is-active" : ""}`}
              type="button"
              onClick={() => handleSelect(n)}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
