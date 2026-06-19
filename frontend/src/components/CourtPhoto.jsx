export default function CourtPhoto({ match }) {
  if (!match?.court_photo_url) return null;

  return (
    <div className="court-photo">
      <img
        alt={match.venue || match.title || "Cancha"}
        src={match.court_photo_url}
      />
    </div>
  );
}
