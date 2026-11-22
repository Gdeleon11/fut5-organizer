import { describe, expect, it } from "vitest";
import { playerPhotoUrl } from "../components/PlayerFace.jsx";

describe("playerPhotoUrl", () => {
  it("uses the member's HTTPS Mi FIFA photo", () => {
    expect(playerPhotoUrl({ avatar_url: " https://x.supabase.co/storage/v1/object/public/avatars/a.png " }))
      .toBe("https://x.supabase.co/storage/v1/object/public/avatars/a.png");
  });
  it("never shows a Radar player's photo", () => {
    expect(playerPhotoUrl({ avatar_url: "https://cdn.test/a.png", is_radar: true })).toBeNull();
  });
  it("ignores missing, non-HTTPS and script URLs", () => {
    expect(playerPhotoUrl(null)).toBeNull();
    expect(playerPhotoUrl({ avatar_url: "" })).toBeNull();
    expect(playerPhotoUrl({ avatar_url: "http://cdn.test/a.png" })).toBeNull();
    expect(playerPhotoUrl({ avatar_url: "javascript:alert(1)" })).toBeNull();
  });
});
