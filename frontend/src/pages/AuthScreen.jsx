import { useEffect, useState } from "react";
import { hasSupabaseConfig, supabase } from "../supabaseClient.js";
import { api } from "../api.js";
import { authErrorMessage, invitedGroupId } from "../authMessages.js";
import { classNames } from "../utils.js";
import { track } from "../analytics.js";

function initialMode() {
  if (typeof window === "undefined") return "login";
  const params = new URLSearchParams(window.location.search);
  if (params.get("modo") === "registro" || invitedGroupId()) return "signup";
  return "login";
}

export default function AuthScreen({ onMockLogin }) {
  const [mode, setMode] = useState(initialMode); // "login" | "signup" | "reset"
  const [invite, setInvite] = useState(null); // { name } | { invalid: true }
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const isSignup = mode === "signup";
  const isReset = mode === "reset";

  // Invitation links (?group=…): say which group invited you before you create the account.
  useEffect(() => {
    const groupId = invitedGroupId();
    if (!groupId || !hasSupabaseConfig) return;
    api.searchGroups(groupId)
      .then((rows) => {
        const g = (rows || []).find((r) => r.id === groupId);
        setInvite(g ? { name: g.name || "una chamusca" } : { invalid: true });
      })
      // Signed-out visitors cannot look the group up (the search requires a session): show the
      // invitation without the name; an invalid link is explained right after signing in.
      .catch(() => setInvite({ generic: true }));
  }, []);

  async function requestReset(event) {
    event.preventDefault();
    setNotice(""); setError("");
    if (!email.trim()) { setError("Escribí el email de tu cuenta."); return; }
    setSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (resetError) throw resetError;
      // Same message whether or not the email has an account (no account discovery).
      setNotice("Si ese email tiene una cuenta, te enviamos un enlace para crear una contraseña nueva. Revisá tu correo (y la carpeta de spam).");
    } catch (authError) {
      setError(authErrorMessage(authError));
    } finally {
      setSubmitting(false);
    }
  }

  function currentRedirectUrl() {
    if (typeof window === "undefined") return undefined;
    const redirectUrl = new URL(window.location.href);
    redirectUrl.hash = "";
    return redirectUrl.toString();
  }

  async function signInWithGoogle() {
    setNotice("");
    setError("");
    setSubmitting(true);

    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: currentRedirectUrl(), // preserve /proof, ?group= and ?match= params
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (googleError) throw googleError;
    } catch (authError) {
      setError(authErrorMessage(authError));
      setSubmitting(false);
    }
  }

  async function resendConfirmationEmail() {
    if (!email.trim()) {
      setError("Ingresá tu email para reenviar la confirmación.");
      return;
    }

    setResendingEmail(true);
    setError("");
    setNotice("");

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
      });

      if (resendError) throw resendError;

      setNotice("Email de confirmación reenviado. Revisá tu correo.");
    } catch (authError) {
      setError(authErrorMessage(authError));
    } finally {
      setResendingEmail(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setNotice("");
    setError("");

    if (!email.trim()) {
      setError("El email es obligatorio.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setSubmitting(true);

    try {
      if (isSignup) {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: currentRedirectUrl(),
          },
        });

        if (signupError) throw signupError;

        // Check if email confirmation is required
        if (data?.user?.identities?.length === 0) {
          setError("Ya existe una cuenta con este email. Probá iniciar sesión.");
        } else if (data?.user?.confirmed_at) {
          track("signup_complete", { has_invite: Boolean(invite), mode: "auto_confirmed" }, { dedupe: "milestone" });
          setNotice("Cuenta creada. Podés empezar a usar la app.");
        } else {
          track("signup_complete", { has_invite: Boolean(invite), mode: "email_confirm" }, { dedupe: "milestone" });
          setNotice(
            "Cuenta creada. Revisá tu correo para confirmar tu email. Si no lo encontrás, hacé clic en reenviar.",
          );
        }
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (loginError) {
          if (loginError.message.includes("Email not confirmed")) {
            setError(
              "Tu email no está confirmado. Revisá tu correo o hacé clic en reenviar confirmación.",
            );
          } else {
            throw loginError;
          }
        }
      }
    } catch (authError) {
      setError(authErrorMessage(authError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app auth-shell">
      <section className="panel auth-panel">
        <img className="auth-brand-mark" src="/brand/f5-club.svg" alt="F5Manager" />
        <div>
          <p className="eyebrow">f5manager</p>
          <h1>{import.meta.env.DEV && !hasSupabaseConfig ? "Modo Demo Sandbox" : isReset ? "Recuperar acceso" : isSignup ? "Crear cuenta" : "Entrar"}</h1>
          {isSignup && !invite && <p className="muted auth-lede">Gratis. Organizá partidos, confirmaciones y equipos con tu grupo, desde el teléfono.</p>}
        </div>
        {invite?.name && (
          <div className="alert success auth-invite" role="status">
            Te invitaron a <b>«{invite.name}»</b>. Creá tu cuenta (o entrá si ya tenés una) y quedás dentro del grupo; el organizador te activa para jugar.
          </div>
        )}
        {invite?.generic && (
          <div className="alert success auth-invite" role="status">
            Te invitaron a un grupo de F5 Manager. Creá tu cuenta (o entrá si ya tenés una) y quedás dentro del grupo; el organizador te activa para jugar.
          </div>
        )}
        {invite?.invalid && (
          <div className="alert error auth-invite" role="alert">
            Este enlace de invitación no es válido o el grupo ya no existe. Pedile al organizador un enlace nuevo. Igual podés crear tu cuenta.
          </div>
        )}

        {!hasSupabaseConfig ? (
          <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div className="alert info" style={{ borderLeft: "4px solid var(--primary)", background: "rgba(16, 185, 129, 0.05)", padding: "1rem", borderRadius: "8px", fontSize: "0.9rem", textAlign: "left" }}>
              <strong style={{ color: "var(--primary)", display: "block", marginBottom: "0.25rem" }}>Base de datos desconectada</strong>
              <span style={{ color: "var(--text-muted)", lineHeight: "1.4" }}>
                {import.meta.env.DEV ? "Puedes explorar la aplicación con datos locales." : "El inicio de sesión no está disponible en este momento."}
              </span>
            </div>
            {import.meta.env.DEV && onMockLogin && (
              <button
                type="button"
                className="primary-button"
                style={{ width: "100%", background: "#10b981", color: "#ffffff", border: "none", padding: "0.75rem", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}
                onClick={onMockLogin}
              >
                🛠️ Iniciar Demostración Local
              </button>
            )}
          </div>
        ) : (
          <>
            {!isReset && <div className="segmented-control">
              <button
                className={classNames(!isSignup && "is-active")}
                type="button"
                onClick={() => setMode("login")}
              >
                Entrar
              </button>
              <button
                className={classNames(isSignup && "is-active")}
                type="button"
                onClick={() => setMode("signup")}
              >
                Registrarme
              </button>
            </div>}

            {error && <div className="alert error" role="alert">{error}</div>}
            {notice && <div className="alert success" role="status">{notice}</div>}

            {!isReset && <button
              className="google-button"
              disabled={submitting}
              type="button"
              onClick={signInWithGoogle}
            >
              Continuar con Google
            </button>}

            {mode === "login" && (
              <button
                className="secondary-button resend-button"
                disabled={resendingEmail}
                type="button"
                onClick={resendConfirmationEmail}
              >
                {resendingEmail ? "Reenviando..." : "Reenviar email de confirmación"}
              </button>
            )}

            {!isReset && <div className="auth-divider">
              <span>o usá email</span>
            </div>}

            {isReset ? (
              <form className="form-grid auth-form" onSubmit={requestReset}>
                <p className="muted">Te mandamos un enlace a tu correo para crear una contraseña nueva.</p>
                <label>
                  Email
                  <input autoComplete="email" inputMode="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </label>
                <button disabled={submitting} type="submit">{submitting ? "Enviando..." : "Enviarme el enlace"}</button>
                <button type="button" className="secondary-button" onClick={() => { setMode("login"); setNotice(""); setError(""); }}>Volver a entrar</button>
              </form>
            ) : (
            <form className="form-grid auth-form" onSubmit={submit}>
              <label>
                Email
                <input
                  autoComplete="email"
                  inputMode="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label>
                Contraseña
                <input
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <button disabled={submitting} type="submit">
                {submitting ? "Procesando..." : isSignup ? "Crear mi cuenta" : "Entrar"}
              </button>
              {!isSignup && (
                <button type="button" className="auth-link" onClick={() => { setMode("reset"); setNotice(""); setError(""); }}>
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </form>
            )}

            {import.meta.env.DEV && onMockLogin && (
              <div style={{ marginTop: "2rem", textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
                <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
                  Entorno Local Detectado:
                </p>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ width: "100%", background: "#10b981", color: "#ffffff", border: "none" }}
                  onClick={onMockLogin}
                >
                  🛠️ Entrar en Modo Demo / Desarrollo
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
