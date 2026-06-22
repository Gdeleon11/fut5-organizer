import { useState } from "react";
import ExportCard from "../components/ExportCard.jsx";
import SectionBanner from "../components/SectionBanner.jsx";
import { classNames, groupInvitationText } from "../utils.js";

export default function GroupsPage({
  activeGroupId,
  memberships,
  onCreateGroup,
  onSwitchGroup,
}) {
  const [name, setName] = useState("");
  const [formError, setFormError] = useState("");
  const activeMembership =
    memberships.find((m) => m.group_id === activeGroupId) ||
    memberships[0] ||
    null;

  async function submit(event) {
    event.preventDefault();
    setFormError("");

    if (!name.trim()) {
      setFormError("Poné el nombre de la chamusca.");
      return;
    }

    await onCreateGroup(name.trim());
    setName("");
  }

  return (
    <div className="page-grid">
      <SectionBanner section="grupos" />
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Grupos</p>
            <h2>Mis chamuscas</h2>
          </div>
          <span className="count-pill">{memberships.length}</span>
        </div>

        {memberships.length === 0 ? (
          <div className="empty-state compact">
            Creá tu primera chamusca. Vas a ser admin de ese grupo y sus datos no
            se mezclarán con otros.
          </div>
        ) : (
          <div className="group-list">
            {memberships.map((membership) => {
              const group = membership.groups;
              const isActive = membership.group_id === activeGroupId;

              return (
                <article
                  className={classNames("group-card", isActive && "is-selected")}
                  key={membership.group_id}
                >
                  <div>
                    <strong>{group?.name || "Chamusca"}</strong>
                    <small>
                      {membership.role === "admin" ? "Admin" : "Jugador"} ·{" "}
                      {membership.is_active ? "activo" : "pendiente"}
                    </small>
                  </div>
                  <button
                    className={isActive ? "confirmed-button" : "secondary-button"}
                    type="button"
                    onClick={() => onSwitchGroup(membership.group_id)}
                  >
                    {isActive ? "Activo" : "Usar"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Crear otra chamusca</h2>
        </div>
        <form className="form-grid" onSubmit={submit}>
          {formError && <p className="form-message">{formError}</p>}
          <label>
            Nombre del grupo
            <input
              placeholder="Ej. Chamusca de los miércoles"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button type="submit">Crear grupo</button>
        </form>
      </section>

      {activeMembership?.role === "admin" && activeMembership.groups && (
        <section className="panel">
          <ExportCard
            label="Invitación del grupo"
            text={groupInvitationText(activeMembership.groups)}
          />
        </section>
      )}
    </div>
  );
}
