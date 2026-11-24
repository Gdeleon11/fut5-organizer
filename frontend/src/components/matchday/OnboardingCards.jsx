import { useState } from "react";
import { Check, Link2, MessageCircle, Sparkles, UserCheck, X } from "lucide-react";
import { copyToClipboard, displayName, waUrl } from "../../utils.js";

/**
 * First-steps cards on Partidos (both designs). Only real data, nothing simulated:
 *  - invite: admins of a group with few active players get the WhatsApp invitation right there;
 *  - pending: admins see who joined by link and activate them with one tap;
 *  - style: optional nudge to create the Mi FIFA style (dismissible, never required).
 */
export default function OnboardingCards({ invite, pending, styleTip }) {
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const show = invite || pending?.members?.length || styleTip;
  if (!show) return null;

  return (
    <div className="ob-cards" data-onboarding>
      {pending?.members?.length > 0 && (
        <section className="ob-card is-pending" aria-labelledby="ob-pending-t" data-onboarding-card="pending">
          <h2 id="ob-pending-t"><UserCheck size={18} aria-hidden="true" /> {pending.members.length === 1 ? "1 jugador espera que lo actives" : `${pending.members.length} jugadores esperan que los actives`}</h2>
          <p>Se unieron con tu enlace. Activalos para que puedan confirmar partidos.</p>
          <ul>
            {pending.members.map((p) => (
              <li key={p.id}>
                <span>{displayName(p)}</span>
                <button type="button" className="md-btn md-btn-accent fx-btn-sm" disabled={busyId === p.id}
                  aria-label={`Activar a ${displayName(p)}`}
                  onClick={async () => { setBusyId(p.id); try { await pending.onActivate(p.id); } finally { setBusyId(null); } }}>
                  <Check size={14} aria-hidden="true" /> {busyId === p.id ? "Activando…" : "Activar"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {invite && (
        <section className="ob-card is-invite" aria-labelledby="ob-invite-t" data-onboarding-card="invite">
          <h2 id="ob-invite-t"><MessageCircle size={18} aria-hidden="true" /> Invitá a tu grupo</h2>
          <p>Mandá el enlace por WhatsApp. Cada uno crea su cuenta en un minuto y vos lo activás desde acá.</p>
          <div className="ob-actions">
            <a className="md-btn md-btn-accent fx-btn-sm" href={waUrl(invite.text)} target="_blank" rel="noreferrer">
              <MessageCircle size={15} aria-hidden="true" /> Enviar por WhatsApp
            </a>
            <button type="button" className="md-btn md-btn-ghost fx-btn-sm"
              onClick={async () => { await copyToClipboard(invite.link); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }}>
              <Link2 size={15} aria-hidden="true" /> {copied ? "Enlace copiado" : "Copiar enlace"}
            </button>
          </div>
        </section>
      )}

      {styleTip && (
        <section className="ob-card is-style" aria-labelledby="ob-style-t" data-onboarding-card="style">
          <button type="button" className="md-icon-btn ob-close" aria-label="Ocultar sugerencia" onClick={styleTip.onDismiss}><X size={16} aria-hidden="true" /></button>
          <h2 id="ob-style-t"><Sparkles size={18} aria-hidden="true" /> Opcional: tu estilo de jugador</h2>
          <p>Contá tu posición y en qué sos fuerte (1 minuto). Ayuda a armar equipos parejos. No hace falta para jugar.</p>
          <div className="ob-actions"><button type="button" className="md-btn md-btn-ghost fx-btn-sm" onClick={styleTip.onOpen}>Crear mi estilo</button></div>
        </section>
      )}
    </div>
  );
}
