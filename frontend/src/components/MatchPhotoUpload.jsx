import { useState } from "react";

export default function MatchPhotoUpload({ match, onUploadMatchPhoto }) {
  const [file, setFile] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (!file) return;
    await onUploadMatchPhoto(match.id, file);
    setFile(null);
    event.currentTarget.reset();
  }

  return (
    <form className="inline-upload" onSubmit={submit}>
      <small>Foto de cancha</small>
      {match.court_photo_url && (
        <span className="status-pill is-paid">con foto</span>
      )}
      <input
        accept="image/*"
        aria-label={`Foto de cancha para ${match.title || "partido"}`}
        type="file"
        onChange={(event) => setFile(event.target.files?.[0] || null)}
      />
      <button className="secondary-button" disabled={!file} type="submit">
        Guardar foto
      </button>
    </form>
  );
}
