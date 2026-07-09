import { useState } from "react";
import ExportCard from "../components/ExportCard.jsx";
import { classNames, groupInvitationText } from "../utils.js";

function GroupDescriptionEditor({ group, isAdmin, onSave }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(group?.description || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(text);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="form-grid">
        <label>
          Descripción, reglas e info del grupo
          <textarea
            rows={6}
            placeholder={`Ej:\n🏐 Chamusca de los miércoles\n📍 Cancha Los Pinos\n⏰ 7:00 PM\n💰 Q50 por jugador\n\nOrganizadores:\n- Guillermo\n- Carlos\n\nReglas:\n- Confirmar antes de las 5 PM\n- Cancelar con 4 horas de anticipación`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="button-row">
          <button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
          <button className="secondary-button" type="button" onClick={() => { setEditing(false); setText(group?.description || ""); }}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group-description">
      {group?.description ? (
        <div className="group-description-text">
          {group.description.split("\n").map((line, i) => (
            <p key={i}>{line || "\u00A0"}</p>
          ))}
        </div>
      ) : (
        <p className="muted">Sin descripción. Agregá info, reglas y organizadores.</p>
      )}
      {isAdmin && (
        <button className="secondary-button" type="button" onClick={() => setEditing(true)}>
          {group?.description ? "Editar" : "Agregar descripción"}
        </button>
      )}
    </div>
  );
}

export default function GroupsPage({
  activeGroupId,
  memberships,
  isAdmin,
  onCreateGroup,
  onSwitchGroup,
  onUpdateDescription,
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

      {activeMembership?.groups && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{activeMembership.groups.name || "Chamusca"}</p>
              <h2>Descripción del grupo</h2>
            </div>
          </div>
          <GroupDescriptionEditor
            group={activeMembership.groups}
            isAdmin={isAdmin}
            onSave={(desc) => onUpdateDescription(desc)}
          />
        </section>
      )}

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

      {["admin", "super_admin"].includes(activeMembership?.role) && activeMembership.groups && (
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
