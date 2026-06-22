import { useEffect, useState } from "react";
import Avatar from "../components/Avatar.jsx";
import PlayerBadge from "../components/PlayerBadge.jsx";
import SectionBanner from "../components/SectionBanner.jsx";
import { POSITION_OPTIONS, emptyProfileForm } from "../constants.js";
import { positionLabel } from "../utils.js";

export default function ProfileForm({ initialProfile, mode, onSave, onSignOut, onDeleteAccount, ratingMap }) {
  const [form, setForm] = useState({
    ...emptyProfileForm,
    full_name: initialProfile?.full_name || "",
    nickname: initialProfile?.nickname || "",
    phone: initialProfile?.phone || "",
    preferred_position: initialProfile?.preferred_position || "Flexible",
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(
    initialProfile?.avatar_url || "",
  );
  const [formError, setFormError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isComplete = mode === "complete";

  useEffect(() => {
    setAvatarPreview(initialProfile?.avatar_url || "");
  }, [initialProfile?.avatar_url]);

  useEffect(() => {
    return () => {
      if (avatarPreview.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  function updateForm(patch) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function updateAvatar(event) {
    const file = event.target.files?.[0] || null;

    setAvatarFile(file);
    setAvatarPreview((current) => {
      if (current.startsWith("blob:")) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : initialProfile?.avatar_url || "";
    });
  }

  async function submit(event) {
    event.preventDefault();
    setFormError("");

    if (!form.full_name.trim()) {
      setFormError("El nombre completo es obligatorio.");
      return;
    }

    if (!form.phone.trim()) {
      setFormError("El teléfono es necesario para coordinar partidos.");
      return;
    }

    await onSave(
      {
        full_name: form.full_name.trim(),
        nickname: form.nickname.trim() || null,
        phone: form.phone.trim(),
        preferred_position: form.preferred_position,
      },
      avatarFile,
    );
  }

  return (
    <div className="page-grid">
      <SectionBanner section="perfil" />
      <section className="panel auth-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{isComplete ? "Primer ingreso" : "Mi perfil"}</p>
          <h1>{isComplete ? "Completá tu perfil" : "Editar perfil"}</h1>
        </div>
      </div>
      <form className="form-grid auth-form" onSubmit={submit}>
        {formError && <p className="form-message">{formError}</p>}
        <label className="avatar-upload">
          <Avatar
            profile={{ ...initialProfile, avatar_url: avatarPreview }}
            size="lg"
          />
          <span>
            {isComplete ? "Foto de perfil" : "Avatar"}
            <small>
              {isComplete
                ? "Podés subirla ahora o cambiarla después."
                : "Solo vos podés cambiar tu foto."}
            </small>
            <input accept="image/*" type="file" onChange={updateAvatar} />
          </span>
        </label>
        {ratingMap && (
          <div className="profile-badge-row">
            <PlayerBadge rating={ratingMap.get(initialProfile?.id)} />
          </div>
        )}
        <label>
          Nombre completo
          <input
            value={form.full_name}
            onChange={(event) => updateForm({ full_name: event.target.value })}
          />
        </label>
        <label>
          Apodo
          <input
            placeholder="Opcional"
            value={form.nickname}
            onChange={(event) => updateForm({ nickname: event.target.value })}
          />
        </label>
        <label>
          Teléfono
          <input
            autoComplete="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(event) => updateForm({ phone: event.target.value })}
          />
        </label>
        <label>
          Posición preferida
          <select
            value={form.preferred_position}
            onChange={(event) =>
              updateForm({ preferred_position: event.target.value })
            }
          >
            {POSITION_OPTIONS.map((position) => (
              <option key={position} value={position}>
                {positionLabel(position)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">{isComplete ? "Entrar" : "Guardar perfil"}</button>
        {onSignOut && (
          <button className="secondary-button" type="button" onClick={onSignOut}>
            Salir
          </button>
        )}
      </form>

      {/* Delete account — only shown in edit mode, not during onboarding */}
      {!isComplete && onDeleteAccount && (
        <div className="danger-zone">
          <p className="eyebrow" style={{ color: "var(--red)" }}>Zona de peligro</p>
          {!confirmDelete ? (
            <button
              className="secondary-button remove-btn"
              type="button"
              onClick={() => setConfirmDelete(true)}
            >
              Eliminar mi cuenta
            </button>
          ) : (
            <div className="confirm-remove">
              <small>
                Esto borra tu perfil, historial y membresías permanentemente. No se puede deshacer.
              </small>
              <div className="button-row">
                <button
                  className="danger-button"
                  type="button"
                  onClick={onDeleteAccount}
                >
                  Sí, eliminar todo
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
    </div>
  );
}
