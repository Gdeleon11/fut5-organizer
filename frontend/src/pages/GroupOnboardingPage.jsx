import { Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../api.js";
import { PubNotice, PublicShell } from "../components/public/PublicShell.jsx";

function extractGroupQuery(value) {
  const raw = value.trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    return url.searchParams.get("group") || raw;
  } catch {
    return raw;
  }
}

export default function GroupOnboardingPage({ onCreateGroup, onJoinGroup }) {
  const [groupName, setGroupName] = useState("");
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [joiningId, setJoiningId] = useState("");
  const [formError, setFormError] = useState("");

  const normalizedSearch = useMemo(() => extractGroupQuery(searchText), [searchText]);

  async function submitCreate(event) {
    event.preventDefault();
    setFormError("");

    if (!groupName.trim()) {
      setFormError("Poné el nombre de tu chamusca.");
      return;
    }

    await onCreateGroup(groupName.trim());
  }

  async function submitSearch(event) {
    event.preventDefault();
    setFormError("");

    if (!normalizedSearch) {
      setFormError("Pegá el enlace de invitación, el ID o el nombre del grupo.");
      return;
    }

    setSearching(true);
    try {
      const rows = await api.searchGroups(normalizedSearch);
      setResults(rows);
      if (rows.length === 0) {
        setFormError("No encontré grupos con esa búsqueda. Revisá el enlace o pedile al admin que te invite.");
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSearching(false);
    }
  }

  async function join(groupId) {
    setJoiningId(groupId);
    setFormError("");
    try {
      await onJoinGroup(groupId);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setJoiningId("");
    }
  }

  return (
    <PublicShell
      view="onboarding"
      wide
      eyebrow="Bienvenido a F5Manager"
      title="Organizá tu chamusca sin perseguir a nadie"
      lede="Partidos, confirmaciones, equipos, cobros, multas y estadísticas en un solo lugar. Entrás a un grupo por invitación o empezás uno nuevo."
      footer="Tus datos solo se comparten dentro de tu grupo"
    >
      {formError && <PubNotice tone="error">{formError}</PubNotice>}
      <div className="pub-split" aria-label="Elegir grupo">
        <section aria-labelledby="ob-create">
          <UsersRound aria-hidden="true" size={24} />
          <h2 id="ob-create">Crear mi chamusca</h2>
          <p>Ideal si vas a administrar jugadores, partidos y cobros.</p>
          <form className="pub-form" onSubmit={submitCreate}>
            <label className="pub-field">
              Nombre del grupo
              <input placeholder="Ej. Chamusca de los miércoles" value={groupName} onChange={(event) => setGroupName(event.target.value)} />
            </label>
            <button className="pub-btn" type="submit">Crear grupo</button>
          </form>
        </section>

        <section aria-labelledby="ob-search">
          <Search aria-hidden="true" size={24} />
          <h2 id="ob-search">Buscar mi grupo</h2>
          <p>Pegá el enlace de invitación o buscá por nombre. Tu solicitud queda pendiente hasta que un admin te active.</p>
          <form className="pub-form" onSubmit={submitSearch}>
            <label className="pub-field">
              Enlace, ID o nombre
              <input placeholder="https://.../grupos?group=..." value={searchText} onChange={(event) => setSearchText(event.target.value)} />
            </label>
            <button className="pub-btn is-ghost" disabled={searching} type="submit">{searching ? "Buscando…" : "Buscar grupo"}</button>
          </form>
          {results.length > 0 && (
            <div>
              {results.map((group) => (
                <div className="pub-result" key={group.id}>
                  <span><b>{group.name || "Chamusca"}</b><small>{group.description || "Grupo existente"}</small></span>
                  <button className="pub-btn is-ghost" type="button" disabled={joiningId === group.id} onClick={() => join(group.id)}>
                    {joiningId === group.id ? "Uniendo…" : "Unirme"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PublicShell>
  );
}
