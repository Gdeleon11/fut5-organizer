import { useState } from "react";
import { Check, FileText, KeyRound, MessageCircle, PlusCircle, Settings2, ShieldCheck, Users } from "lucide-react";
import ExportCard from "../components/ExportCard.jsx";
import { Empty, Kpis, Section, StatusChip } from "../components/finance/FinanceBlocks.jsx";
import { useAppearance } from "../appearance/AppearanceProvider.jsx";
import { CAPABILITIES, ROLE_INFO, ROLE_ORDER, canRole } from "../admin/permissions.js";
import { formatMoney, groupInvitationText, roleLabel } from "../utils.js";

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
      <div className="form-grid md-form fx-form" role="group" aria-label="Editar descripción del grupo">
        <label className="md-form-wide">
          Descripción, reglas e info del grupo
          <textarea
            rows={8}
            placeholder={`Ej:\n🏐 Chamusca de los miércoles\n📍 Cancha Los Pinos\n⏰ 7:00 PM\n💰 Q50 por jugador\n\nOrganizadores:\n- Guillermo\n- Carlos\n\nReglas:\n- Confirmar antes de las 5 PM\n- Cancelar con 4 horas de anticipación`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="md-form-actions">
          <button className="md-btn md-btn-ghost" type="button" onClick={() => { setEditing(false); setText(group?.description || ""); }}>Cancelar</button>
          <button className="md-btn md-btn-accent" type="button" onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="gr-desc">
      {group?.description ? (
        <div className="gr-desc-text">
          {group.description.split("\n").map((line, i) => <p key={i}>{line || " "}</p>)}
        </div>
      ) : (
        <Empty>Sin descripción. Agregá info, reglas y organizadores.</Empty>
      )}
      {isAdmin && (
        <button className="md-btn md-btn-ghost" type="button" onClick={() => setEditing(true)}>
          {group?.description ? "Editar descripción" : "Agregar descripción"}
        </button>
      )}
    </div>
  );
}

/* Fine amounts — the same SettingsPanel the former SuperAdminPage offered (super_admin only),
 * same defaults and the same onUpdateSettings handler / payload. */
function FineSettings({ settings, onUpdateSettings }) {
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
    <form className="form-grid md-form fx-form" onSubmit={submit} aria-label="Configuración de multas">
      <label>
        Multa por no llegar (Q)
        <input min="0" step="1" type="number" inputMode="numeric" value={form.fine_amount} onChange={(e) => update({ fine_amount: e.target.value })} />
      </label>
      <label>
        Multa por cancelar tarde (Q)
        <input min="0" step="1" type="number" inputMode="numeric" value={form.late_cancel_fine_amount} onChange={(e) => update({ late_cancel_fine_amount: e.target.value })} />
      </label>
      <p className="fx-hint md-form-wide">Valores actuales: no llegar {formatMoney(settings?.fine_amount ?? 50)} · cancelar tarde {formatMoney(settings?.late_cancel_fine_amount ?? 25)}. Solo afectan multas nuevas.</p>
      <div className="md-form-actions">
        {saved && <span className="fx-chip is-paid" role="status">Guardado</span>}
        <button className="md-btn md-btn-accent" type="submit">Guardar configuración</button>
      </div>
    </form>
  );
}

function RolesMatrix({ variant, myRole }) {
  const areas = [...new Set(CAPABILITIES.map(([a]) => a))];
  return (
    <>
      <ul className={`gr-roles is-${variant}`}>
        {ROLE_ORDER.map((r) => (
          <li key={r} className={myRole === r ? "is-mine" : ""}>
            <b>{ROLE_INFO[r].label}</b>
            <small>{ROLE_INFO[r].summary}</small>
            {myRole === r && <StatusChip tone="accent">Tu rol</StatusChip>}
          </li>
        ))}
      </ul>
      <table className="fx-table gr-matrix">
        <caption className="sr-only">Qué puede hacer cada rol</caption>
        <thead>
          <tr>
            <th scope="col">Permiso</th>
            {ROLE_ORDER.map((r) => <th key={r} scope="col" className="gr-col">{ROLE_INFO[r].label}</th>)}
          </tr>
        </thead>
        <tbody>
          {areas.map((area) => [
            <tr key={`${area}-h`} className="fx-month"><th colSpan={ROLE_ORDER.length + 1} scope="rowgroup">{area}</th></tr>,
            ...CAPABILITIES.filter(([a]) => a === area).map(([, text, min]) => (
              <tr key={text}>
                <td>{text}</td>
                {ROLE_ORDER.map((r) => (
                  <td key={r} className="gr-col" data-role={ROLE_INFO[r].label}>
                    {canRole(r, min)
                      ? <span className="gr-yes"><Check size={16} aria-hidden="true" /><span className="sr-only">Sí</span></span>
                      : <span className="gr-no" aria-label="No">—</span>}
                  </td>
                ))}
              </tr>
            )),
          ])}
        </tbody>
      </table>
      <p className="fx-hint gr-note">Resumen informativo de la app actual. Los permisos reales los aplica el servidor; para nombrar admins usá <b>Mi FIFA → Roles</b>.</p>
    </>
  );
}

export default function GroupsPage({
  activeGroupId,
  memberships,
  isAdmin,
  isSuperAdmin = false,
  settings = null,
  onUpdateSettings,
  onCreateGroup,
  onSwitchGroup,
  onUpdateDescription,
  radarSettings = null,
  initialTab = "groups",
}) {
  const { design } = useAppearance();
  const variant = design === "command" ? "command" : "editorial";
  const [name, setName] = useState("");
  const [formError, setFormError] = useState("");
  const [tab, setTab] = useState(initialTab === "settings" && !isSuperAdmin ? "groups" : initialTab);
  const activeMembership =
    memberships.find((m) => m.group_id === activeGroupId) ||
    memberships[0] ||
    null;
  const myRole = activeMembership?.role || "player";
  const adminCount = memberships.filter((m) => ["admin", "super_admin"].includes(m.role)).length;

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

  const tabs = [
    ["groups", "Mis grupos", Users],
    ["roles", "Roles y permisos", ShieldCheck],
    ...(isSuperAdmin ? [["settings", "Configuración", Settings2]] : []),
  ];

  return (
    <div className={`md-matches md-design-${variant} fx-page gr-page`} data-design={variant} data-view="groups">
      <div className={variant === "command" ? "mdc fx-shell" : "mde fx-shell"}>
        {variant === "command" ? (
          <div className="mdc-bar">
            <h1>Grupos</h1>
            <span className="mdc-pill"><Users size={14} aria-hidden="true" /> <b>{memberships.length}</b> chamuscas</span>
            <span className="mdc-pill"><KeyRound size={14} aria-hidden="true" /> {roleLabel(myRole)}</span>
          </div>
        ) : (
          <header className="fx-ed-hero">
            <span className="mde-crumb">Administración</span>
            <h1>Grupos</h1>
            <p className="fx-ed-lede">
              Estás en <b className="fx-lede-num">{activeMembership?.groups?.name || "tu chamusca"}</b> como <b className="fx-lede-num">{roleLabel(myRole)}</b>
            </p>
          </header>
        )}
        <nav className="pl-tabs fx-tabs" aria-label="Secciones de Grupos">
          {tabs.map(([id, label, Icon]) => (
            <button key={id} type="button" className={tab === id ? "is-on" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
              <Icon size={16} aria-hidden="true" /> {label}
            </button>
          ))}
        </nav>

        {tab === "roles" && (
          <Section title="Roles y permisos" icon={ShieldCheck}>
            <RolesMatrix variant={variant} myRole={myRole} />
          </Section>
        )}

        {tab === "settings" && isSuperAdmin && (
          <Section title="Configuración de multas" icon={Settings2}>
            {settings
              ? <FineSettings settings={settings} onUpdateSettings={onUpdateSettings} />
              : <Empty>Este grupo todavía no tiene configuración guardada.</Empty>}
          </Section>
        )}
        {tab === "settings" && isSuperAdmin && radarSettings}

        {tab === "groups" && (
          <>
            {variant === "command" && (
              <Kpis variant="command" items={[
                { label: "Mis chamuscas", value: memberships.length },
                { label: "Donde soy admin", value: adminCount },
                { label: "Pendientes de activación", value: memberships.filter((m) => !m.is_active).length },
              ]} />
            )}
            <div className="gr-cols">
              <Section title="Mis chamuscas" icon={Users} aside={<span className="fx-count">{memberships.length} grupos</span>}>
                {memberships.length === 0 ? (
                  <Empty>Creá tu primera chamusca. Vas a ser admin de ese grupo y sus datos no se mezclarán con otros.</Empty>
                ) : (
                  <ul className={`gr-list is-${variant}`}>
                    {memberships.map((membership) => {
                      const group = membership.groups;
                      const isActive = membership.group_id === activeGroupId;
                      return (
                        <li key={membership.group_id} className={isActive ? "is-current" : ""}>
                          <span className="gr-avatar" aria-hidden="true">{(group?.name || "C").slice(0, 1).toUpperCase()}</span>
                          <span className="gr-main">
                            <b>{group?.name || "Chamusca"}</b>
                            <small>{roleLabel(membership.role)} · {membership.is_active ? "activo" : "pendiente de activación"}</small>
                          </span>
                          {isActive ? (
                            <StatusChip tone="paid">En uso</StatusChip>
                          ) : (
                            <button className="md-btn md-btn-ghost fx-btn-sm" type="button" onClick={() => onSwitchGroup(membership.group_id)}>Usar</button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Section>

              <div className="gr-side">
                {activeMembership?.groups && (
                  <Section title={`Descripción · ${activeMembership.groups.name || "Chamusca"}`} icon={FileText}>
                    <GroupDescriptionEditor group={activeMembership.groups} isAdmin={isAdmin} onSave={(desc) => onUpdateDescription(desc)} />
                  </Section>
                )}

                {["admin", "super_admin"].includes(activeMembership?.role) && activeMembership.groups && (
                  <Section title="Invitación del grupo" icon={MessageCircle}>
                    <p className="fx-hint">Compartí este texto para que nuevos jugadores soliciten unirse. Un admin los activa desde Jugadores.</p>
                    <ExportCard label="Invitación del grupo" text={groupInvitationText(activeMembership.groups)} />
                  </Section>
                )}

                <Section title="Crear otra chamusca" icon={PlusCircle}>
                  <form className="form-grid md-form fx-form" onSubmit={submit} aria-label="Crear grupo">
                    {formError && <p className="form-message" role="alert">{formError}</p>}
                    <label className="md-form-wide">
                      Nombre del grupo
                      <input placeholder="Ej. Chamusca de los miércoles" value={name} onChange={(event) => setName(event.target.value)} />
                    </label>
                    <div className="md-form-actions"><button className="md-btn md-btn-accent" type="submit">Crear grupo</button></div>
                  </form>
                </Section>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
