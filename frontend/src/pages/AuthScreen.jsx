import { useState } from "react";
import { hasSupabaseConfig, supabase } from "../supabaseClient.js";
import { classNames } from "../utils.js";

export default function AuthScreen({ onMockLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const isSignup = mode === "signup";

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
      setError(authError.message);
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
      setError(authError.message);
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
          setNotice("Cuenta creada. Podés empezar a usar la app.");
        } else {
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
      setError(authError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app auth-shell">
      <section className="panel auth-panel">
        <img className="auth-brand-mark" src="/brand/f5manager-logo.jpg" alt="F5Manager" />
        <div>
          <p className="eyebrow">f5manager</p>
          <h1>{!hasSupabaseConfig ? "Modo Demo Sandbox" : isSignup ? "Crear cuenta" : "Entrar"}</h1>
        </div>

        {!hasSupabaseConfig ? (
          <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div className="alert info" style={{ borderLeft: "4px solid var(--primary)", background: "rgba(16, 185, 129, 0.05)", padding: "1rem", borderRadius: "8px", fontSize: "0.9rem", textAlign: "left" }}>
              <strong style={{ color: "var(--primary)", display: "block", marginBottom: "0.25rem" }}>Base de datos desconectada</strong>
              <span style={{ color: "var(--text-muted)", lineHeight: "1.4" }}>
                No se detectó configuración de Supabase. Puedes explorar la aplicación completa utilizando datos y simulación local en memoria.
              </span>
            </div>
            {onMockLogin && (
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
            <div className="segmented-control">
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
            </div>

            {error && <div className="alert error">{error}</div>}
            {notice && <div className="alert success">{notice}</div>}

            <button
              className="google-button"
              disabled={submitting}
              type="button"
              onClick={signInWithGoogle}
            >
              Continuar con Google
            </button>

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

            <div className="auth-divider">
              <span>o usá email</span>
            </div>

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
                {submitting ? "Procesando..." : isSignup ? "Registrarme" : "Entrar"}
              </button>
            </form>

            {onMockLogin && (
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
