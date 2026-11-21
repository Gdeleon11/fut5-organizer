// Pages only reachable with a given role; their redirect must wait until roles are resolved.
export const ROLE_GATED_PAGES = new Set(["tournaments"]);

/**
 * Decide what to do with the current page.
 *  - "stay": allowed, or a role-gated page while the session/groups/role are still loading
 *  - "wait": role-gated page, roles unresolved → show a loading state, do not redirect
 *  - "redirect": not allowed once roles are known
 */
export function rolePageDecision({ page, allowedPages, rolesResolved, isDemoMode }) {
  if (allowedPages.has(page)) return "stay";
  if (ROLE_GATED_PAGES.has(page) && !isDemoMode && !rolesResolved) return "wait";
  return "redirect";
}
