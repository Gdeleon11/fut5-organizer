import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Ban,
  CalendarDays,
  Check,
  ClipboardList,
  Flag,
  Hourglass,
  Lock,
  Plus,
  Trash2,
  X,
} from "lucide-react";

export const STATE_ICONS = {
  confirmed: Check,
  available: Plus,
  waitlist: Hourglass,
  full: Lock,
  cancelled: Ban,
  finished: Flag,
  empty: CalendarDays,
};

export function StateIcon({ stateKey, size = 16 }) {
  const Icon = STATE_ICONS[stateKey] || CalendarDays;
  return <Icon size={size} aria-hidden="true" className="md-ic" />;
}

export function StateChip({ state, size = 13 }) {
  return (
    <span className={`md-chip tone-${state.tone}`}>
      <StateIcon stateKey={state.key} size={size} />
      {state.chip}
    </span>
  );
}

/**
 * Wires view actions to the existing App handlers (no new business logic).
 * Keeps a per-match busy flag so a double tap cannot fire two mutations.
 */
export function useMatchActions({ onConfirm, onCancel, onJoinWaitlist, onOpenMatch }) {
  const [busyId, setBusyId] = useState(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const run = useCallback(
    async (action, match) => {
      if (!action || !match || action.disabled) return;
      if (action.kind === "open" || action.kind === "summary") {
        onOpenMatch?.(match.id);
        return;
      }
      const handler =
        action.kind === "confirm" ? onConfirm : action.kind === "waitlist" ? onJoinWaitlist : action.kind === "cancel" ? onCancel : null;
      if (!handler) return;
      setBusyId(match.id);
      try {
        await handler(match);
      } finally {
        if (alive.current) setBusyId(null);
      }
    },
    [onConfirm, onCancel, onJoinWaitlist, onOpenMatch],
  );

  return { run, busyId };
}

export function AdminActions({ isAdmin, showCreate, onToggleCreate, onOpenPizarra, className = "" }) {
  if (!isAdmin) return null;
  return (
    <div className={`md-admin ${className}`.trim()}>
      {onOpenPizarra && (
        <button type="button" className="md-btn md-btn-ghost" onClick={onOpenPizarra}>
          <ClipboardList size={17} aria-hidden="true" /> Pizarra táctica
        </button>
      )}
      <button
        type="button"
        className={`md-btn ${showCreate ? "md-btn-ghost" : "md-btn-accent"}`}
        onClick={onToggleCreate}
        aria-expanded={showCreate}
      >
        {showCreate ? <X size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
        {showCreate ? "Cancelar" : "Nuevo partido"}
      </button>
    </div>
  );
}

/** Admin-only delete affordance for a history row, with inline confirmation. */
export function DeleteControl({ entry, deletion }) {
  if (!deletion?.isAdmin) return null;
  const isDeleting = deletion.deletingId === entry.id;
  if (isDeleting) {
    return (
      <span className="md-del-confirm" role="group" aria-label={`Eliminar ${entry.title}`}>
        <span>¿Eliminar?</span>
        <button type="button" className="md-btn md-btn-danger md-btn-sm" onClick={() => deletion.confirm(entry.id)}>
          Eliminar
        </button>
        <button type="button" className="md-btn md-btn-ghost md-btn-sm" onClick={deletion.cancel}>
          No
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      className="md-icon-btn md-del"
      title={`Eliminar ${entry.title}`}
      aria-label={`Eliminar ${entry.title}`}
      onClick={() => deletion.start(entry.id)}
    >
      <Trash2 size={16} aria-hidden="true" />
    </button>
  );
}

export function HistoryFilter({ from, to, onFrom, onTo, onClear }) {
  const has = Boolean(from || to);
  return (
    <div className="md-filter" role="group" aria-label="Filtrar historial por fecha">
      <label>
        <span>Desde</span>
        <input type="date" value={from} max={to || undefined} onChange={(e) => onFrom(e.target.value)} />
      </label>
      <label>
        <span>Hasta</span>
        <input type="date" value={to} min={from || undefined} onChange={(e) => onTo(e.target.value)} />
      </label>
      {has && (
        <button type="button" className="md-linkbtn" onClick={onClear}>
          Limpiar
        </button>
      )}
    </div>
  );
}

export function HistoryMore({ history }) {
  if (!history.canShowMore && !history.canShowLess) return null;
  return (
    <div className="md-more">
      {history.canShowMore && (
        <button type="button" className="md-btn md-btn-ghost" onClick={history.showMore}>
          Ver más ({history.remaining} restantes)
        </button>
      )}
      {history.canShowLess && (
        <button type="button" className="md-btn md-btn-ghost" onClick={history.showLess}>
          Ver menos
        </button>
      )}
    </div>
  );
}

export function ActionButton({ action, match, run, busy, className }) {
  if (!action) return null;
  return (
    <button
      type="button"
      className={className}
      disabled={Boolean(action.disabled) || busy}
      aria-busy={busy || undefined}
      onClick={() => run(action, match)}
    >
      {busy && action.kind !== "open" && action.kind !== "summary" ? "Procesando…" : action.label}
    </button>
  );
}
