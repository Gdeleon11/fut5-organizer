import { Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../api.js";

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
    <div className="app onboarding-shell">
      <section className="onboarding-hero" aria-labelledby="onboarding-title">
        <div className="onboarding-copy">
          <img className="auth-brand-mark" src="/brand/f5manager-logo.jpg" alt="F5Manager" />
          <p className="eyebrow">f5manager</p>
          <h1 id="onboarding-title">Organizá tu chamusca sin perseguir a nadie</h1>
          <p>
            Armá partidos, confirmaciones, equipos, cobros, multas y estadísticas en un solo lugar.
            Entrás a un grupo por invitación, o empezás uno nuevo para tu equipo.
          </p>
        </div>
      </section>

      {formError && <div className="alert error">{formError}</div>}

      <main className="onboarding-actions" aria-label="Elegir grupo">
        <section className="panel onboarding-panel">
          <div className="onboarding-panel-title">
            <UsersRound aria-hidden="true" size={22} />
            <div>
              <p className="eyebrow">Nuevo grupo</p>
              <h2>Crear mi chamusca</h2>
            </div>
          </div>
          <p className="muted">
            Ideal si vos vas a administrar jugadores, partidos y cobros.
          </p>
          <form className="form-grid" onSubmit={submitCreate}>
            <label>
              Nombre del grupo
              <input
                placeholder="Ej. Chamusca de los miércoles"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
              />
            </label>
            <button type="submit">Crear grupo</button>
          </form>
        </section>

        <section className="panel onboarding-panel">
          <div className="onboarding-panel-title">
            <Search aria-hidden="true" size={22} />
            <div>
              <p className="eyebrow">Ya existe</p>
              <h2>Buscar mi grupo</h2>
            </div>
          </div>
          <p className="muted">
            Pegá el enlace de invitación o buscá por nombre. Tu solicitud queda pendiente hasta que un admin te active.
          </p>
          <form className="form-grid" onSubmit={submitSearch}>
            <label>
              Enlace, ID o nombre
              <input
                placeholder="https://.../grupos?group=..."
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </label>
            <button className="secondary-button" disabled={searching} type="submit">
              {searching ? "Buscando..." : "Buscar grupo"}
            </button>
          </form>

          {results.length > 0 && (
            <div className="group-list onboarding-results">
              {results.map((group) => (
                <article className="group-card" key={group.id}>
                  <div>
                    <strong>{group.name || "Chamusca"}</strong>
                    <small>{group.description || "Grupo existente"}</small>
                  </div>
                  <button
                    type="button"
                    disabled={joiningId === group.id}
                    onClick={() => join(group.id)}
                  >
                    {joiningId === group.id ? "Uniendo..." : "Unirme"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
