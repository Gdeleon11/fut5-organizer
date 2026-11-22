import React, { useEffect, useState } from "react";

/**
 * Photo for a player token on the pitch. Uses the Mi FIFA photo (profiles.avatar_url) the group
 * already loads for its members; nothing new is fetched or made public. Radar players (outside
 * the group) and guests keep initials, as do broken or non-HTTPS URLs.
 */
export function playerPhotoUrl(profile) {
  if (!profile || profile.is_radar) return null;
  const url = String(profile.avatar_url || "").trim();
  return /^https:\/\//i.test(url) ? url : null;
}

export default function PlayerFace({ profile, initial, size = 48 }) {
  const src = playerPhotoUrl(profile);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <span className="pf-initial">{initial}</span>;
  return (
    <img
      className="pf-img"
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
