import React from "react";
import { Users, ChevronDown } from "lucide-react";

/**
 * F5Manager GroupSwitcher Component
 */
export function GroupSwitcher({
  memberships = [],
  activeGroupId,
  switchGroup,
}) {
  if (!memberships || memberships.length === 0) return null;

  return (
    <div className="f5-group-select-wrapper">
      <Users size={14} className="f5-group-select-icon" />
      <select
        aria-label="Grupo activo"
        value={activeGroupId || ""}
        onChange={(e) => switchGroup(e.target.value)}
      >
        {memberships.map((m) => (
          <option key={m.group_id} value={m.group_id}>
            {m.groups?.name || "Chamusca"}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="f5-group-select-arrow" />
    </div>
  );
}

export default GroupSwitcher;
