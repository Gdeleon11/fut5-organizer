import { classNames, displayName } from "../utils.js";

export default function Avatar({ profile, size = "md" }) {
  const name = displayName(profile);
  const initial = (name[0] || "P").toUpperCase();

  return (
    <span className={classNames("avatar", `avatar-${size}`)}>
      {profile?.avatar_url ? (
        <img alt={`${name} avatar`} src={profile.avatar_url} />
      ) : (
        <span>{initial}</span>
      )}
    </span>
  );
}
