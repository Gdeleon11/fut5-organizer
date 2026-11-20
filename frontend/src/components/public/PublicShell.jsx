import { CheckCircle2, CircleAlert, Info, Lock, Upload } from "lucide-react";

/*
 * Common premium identity for public / out-of-app pages (reservation proof links,
 * payment proof links, group onboarding). Independent of the two internal
 * experiences: it never reads the user's design or palette, it follows the
 * device light/dark preference and keeps WCAG AA contrast.
 * Pure presentation — pages keep their own authorization and upload logic.
 */
export function PublicShell({ eyebrow, title, lede, children, footer = "Enlace seguro de F5Manager", wide = false, view }) {
  return (
    <div className="pub" data-view={view}>
      <header className="pub-brand">
        <span className="pub-logo" aria-hidden="true">F5</span>
        <span className="pub-brand-name">F5Manager</span>
      </header>
      <main className={`pub-card ${wide ? "is-wide" : ""}`}>
        {(eyebrow || title) && (
          <div className="pub-head">
            {eyebrow && <p className="pub-eyebrow">{eyebrow}</p>}
            {title && <h1>{title}</h1>}
            {lede && <p className="pub-lede">{lede}</p>}
          </div>
        )}
        {children}
      </main>
      <footer className="pub-foot"><Lock size={13} aria-hidden="true" /> {footer}</footer>
    </div>
  );
}

const NOTICE_ICON = { error: CircleAlert, success: CheckCircle2, info: Info, warning: CircleAlert };

export function PubNotice({ tone = "info", children }) {
  const Icon = NOTICE_ICON[tone] || Info;
  return (
    <div className={`pub-notice is-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function PubStatus({ tone = "pending", children }) {
  return <span className={`pub-status is-${tone}`}>{children}</span>;
}

/** Large, keyboard-accessible file picker; the native input stays in the DOM. */
export function PubFilePicker({ label, hint, onChange, disabled, accept = "image/*", busy }) {
  return (
    <label className={`pub-drop ${disabled ? "is-disabled" : ""}`}>
      <Upload size={22} aria-hidden="true" />
      <span className="pub-drop-text">
        <b>{busy || label}</b>
        {hint && <small>{hint}</small>}
      </span>
      <input type="file" accept={accept} onChange={onChange} disabled={disabled} />
    </label>
  );
}

export function PubDetails({ rows }) {
  return (
    <dl className="pub-details">
      {rows.filter(Boolean).map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}
