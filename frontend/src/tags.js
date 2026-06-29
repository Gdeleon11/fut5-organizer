export function parseTags(value) {
  if (Array.isArray(value)) return normalizeTags(value);
  return normalizeTags(String(value || "").split(","));
}

export function normalizeTags(tags = []) {
  return [...new Set(
    tags
      .map((tag) => String(tag || "").trim().toLowerCase())
      .filter(Boolean)
      .map((tag) => tag.replace(/\s+/g, "-")),
  )];
}

export function formatTag(tag) {
  return `#${String(tag || "").replace(/^#/, "")}`;
}

export function collectGroupTags(profiles = []) {
  return normalizeTags((profiles || []).flatMap((profile) => profile?.group_tags || []));
}

export function canAccessMatch(match, profile, isAdmin = false) {
  if (isAdmin) return true;
  const allowedTags = normalizeTags(match?.allowed_tags || []);
  if (allowedTags.length === 0) return true;
  const profileTags = new Set(normalizeTags(profile?.group_tags || []));
  return allowedTags.some((tag) => profileTags.has(tag));
}
