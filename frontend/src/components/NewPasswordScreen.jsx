import { useState } from "react";
import { supabase } from "../supabaseClient.js";
import { authErrorMessage } from "../authMessages.js";

/** Shown after opening the "recover password" email link (Supabase PASSWORD_RECOVERY session). */
export default function NewPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      onDone?.();
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="app auth-shell" data-view="new-password">
      <section className="panel auth-panel">
        <img className="auth-brand-mark" src="/brand/f5-club.svg" alt="F5Manager" />
        <div>
          <p className="eyebrow">f5manager</p>
          <h1>Nueva contraseña</h1>
        </div>
        {error && <div className="alert error" role="alert">{error}</div>}
        <form className="form-grid auth-form" onSubmit={submit}>
          <label>
            Contraseña nueva
            <input autoComplete="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label>
            Repetila
            <input autoComplete="new-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
          <button type="submit" disabled={busy}>{busy ? "Guardando..." : "Guardar y entrar"}</button>
        </form>
      </section>
    </div>
  );
}
