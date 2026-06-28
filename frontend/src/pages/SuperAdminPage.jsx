import { useState } from "react";
import Avatar from "../components/Avatar.jsx";
import StarRatingControl, {
  PositionRatingControl,
  PositionRatingDisplay,
} from "../components/StarRatingControl.jsx";
import Stars from "../components/Stars.jsx";
import { ROLE_OPTIONS } from "../constants.js";
import {
  classNames,
  displayName,
  formatMoney,
  positionLabel,
  roleLabel,
} from "../utils.js";

// ---------------------------------------------------------------------------
// Settings panel — fine amounts (super_admin only)
// ---------------------------------------------------------------------------

function SettingsPanel({ settings, onUpdateSettings }) {
  const [form, setForm] = useState({
    fine_amount: settings?.fine_amount ?? 50,
    late_cancel_fine_amount: settings?.late_cancel_fine_amount ?? 25,
  });
  const [saved, setSaved] = useState(false);

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
  }

  async function submit(e) {
    e.preventDefault();
    await onUpdateSettings({
      fine_amount: Number(form.fine_amount),
      late_cancel_fine_amount: Number(form.late_cancel_fine_amount),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Configuración del grupo</h2>
        {saved && <span className="count-pill">Guardado</span>}
      </div>
      <form className="form-grid" onSubmit={submit}>
        <label>
          Multa por no llegar (Q)
          <input
            min="0"
            step="1"
            type="number"
            value={form.fine_amount}
            onChange={(e) => update({ fine_amount: e.target.value })}
          />
        </label>
        <label>
          Multa por cancelar tarde (Q)
          <input
            min="0"
            step="1"
            type="number"
            value={form.late_cancel_fine_amount}
            onChange={(e) => update({ late_cancel_fine_amount: e.target.value })}
          />
        </label>
        <button type="submit">Guardar configuración</button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Player card with role selector + star rating (super_admin actions)
// ---------------------------------------------------------------------------

function PlayerRoleCard({
  fines,
  player,
  ratingMap,
  onAssignRating,
  onUpdateMember,
  onUpdateRole,
  onRemoveMember,
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const openFines = fines.filter(
    (f) => f.profile_id === player.id && f.status === "open",
  );
  const debt = openFines.reduce((s, f) => s + Number(f.amount || 0), 0);

  return (
    <article className="player-admin-card">
      <div className="player-card-head">
        <div className="player-title">
          <Avatar profile={player} size="sm" />
          <span>
            <strong>{displayName(player)}</strong>
            <small>{positionLabel(player.preferred_position)}</small>
          </span>
        </div>
        <div className="role-status-group">
          <span
            className={classNames(
              "status-pill",
              player.membership_is_active && "is-paid",
            )}
          >
            {player.membership_is_active ? "activo" : "inactivo"}
          </span>
          {debt > 0 && (
            <span className="status-pill">{formatMoney(debt)} deuda</span>
          )}
        </div>
      </div>

      <div className="role-controls">
        <label className="role-label-inline">
          <small>Rol</small>
          <select
            value={player.membership_role || "player"}
            onChange={(e) => onUpdateRole(player.id, e.target.value)}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </label>

        <button
          className={player.membership_is_active ? "confirmed-button" : "secondary-button"}
          type="button"
          onClick={() =>
            onUpdateMember(player.id, { is_active: !player.membership_is_active })
          }
        >
          {player.membership_is_active ? "Activo" : "Inactivo"}
        </button>
      </div>

      <div className="detail-section">
        <div className="section-heading">
          <small>Estrellas</small>
          <span className="count-pill">
            {ratingMap.has(player.id) ? (
              <PositionRatingDisplay ratings={ratingMap.get(player.id)} />
            ) : (
              "sin estrellas"
            )}
          </span>
        </div>
        <PositionRatingControl
          ratings={ratingMap.get(player.id) || {
            attack_rating: 2,
            defense_rating: 2,
            midfield_rating: 2,
            goalkeeper_rating: 2,
          }}
          onSelect={(key, level) => onAssignRating(player.id, key, level)}
        />
      </div>

      {/* Remove from group */}
      {!confirmRemove ? (
        <button
          className="secondary-button remove-btn"
          type="button"
          onClick={() => setConfirmRemove(true)}
        >
          Remover del grupo
        </button>
      ) : (
        <div className="confirm-remove">
          <small>¿Seguro? Se elimina su membresía. Sus multas e historial quedan.</small>
          <div className="button-row">
            <button
              className="danger-button"
              type="button"
              onClick={() => { setConfirmRemove(false); onRemoveMember(player.id); }}
            >
              Sí, remover
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setConfirmRemove(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SuperAdminPage({
  fines,
  profiles,
  ratingMap,
  settings,
  onAssignRating,
  onUpdateMember,
  onUpdateRole,
  onUpdateSettings,
  onRemoveMember,
}) {
  return (
    <div className="page-grid super-admin-page">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Super Admin</p>
            <h2>Roles y ratings</h2>
          </div>
          <span className="count-pill">{profiles.length}</span>
        </div>
        <div className="super-admin-list">
          {profiles.length === 0 ? (
            <div className="empty-state compact">No hay jugadores registrados.</div>
          ) : (
            profiles.map((player) => (
              <PlayerRoleCard
                key={player.id}
                fines={fines}
                player={player}
                ratingMap={ratingMap}
                onAssignRating={onAssignRating}
                onUpdateMember={onUpdateMember}
                onUpdateRole={onUpdateRole}
                onRemoveMember={onRemoveMember}
              />
            ))
          )}
        </div>
      </section>

      {settings && (
        <SettingsPanel settings={settings} onUpdateSettings={onUpdateSettings} />
      )}
    </div>
  );
}
