import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { achievements, adjustPoint, starterStyle, usedPoints, validateStyle, verifiedRecord } from "../players/playerStyle.js";
import { PlayerLayers } from "../components/profile/PlayerBuilder.jsx";

describe("player style rules", () => {
  it("starter splits always use exactly 10 points", () => {
    for (const pos of ["Goalkeeper", "Defender", "Midfielder", "Forward", "Flexible", "?"]) expect(usedPoints(starterStyle(pos))).toBe(10);
  });
  it("cannot go above 10 or below 0", () => {
    let s = starterStyle("Forward");
    expect(adjustPoint(s, "attack", 1)).toBe(s);
    s = adjustPoint(s, "attack", -1);
    expect(usedPoints(s)).toBe(9);
    expect(adjustPoint({ ...s, goalkeeping: 0 }, "goalkeeping", -1).goalkeeping).toBe(0);
  });
  it("validation explains what is wrong", () => {
    expect(validateStyle({ attack: 3, defense: 3, passing: 0, pace: 0, goalkeeping: 0 }, "Forward")).toMatch(/faltan repartir 4/);
    expect(validateStyle({ attack: 6, defense: 6, passing: 0, pace: 0, goalkeeping: 0 }, "Forward")).toMatch(/pasaste por 2/);
    expect(validateStyle({ ...starterStyle("Forward"), secondary_position: "Forward" }, "Forward")).toMatch(/distinta/);
    expect(validateStyle({ ...starterStyle("Forward"), secondary_position: "Midfielder" }, "Forward")).toBeNull();
  });
});

describe("verified record and achievements come only from official data", () => {
  const matches = [
    { id: "m1", status: "closed", match_date: "2026-11-01", start_time: "19:00" },
    { id: "m2", status: "upcoming", match_date: "2099-01-01", start_time: "19:00" },
    { id: "m3", status: "canceled", match_date: "2026-10-01", start_time: "19:00" },
  ];
  const attendances = ["m1", "m2", "m3"].map((match_id) => ({ match_id, profile_id: "me", status: "confirmed" }));
  it("future and canceled matches do not count; MVP from closures counts once", () => {
    const r = verifiedRecord({ profileId: "me", matches, attendances, stats: [{ match_id: "m1", player_id: "me", goals: 2, assists: 1, mvp: true }], closures: [{ match_id: "m1", mvp_profile_id: "me" }] });
    expect(r).toMatchObject({ played: 1, goals: 2, assists: 1, mvps: 1 });
    expect(achievements(r).map((a) => a.id)).toEqual(["debut", "first-goal", "mvp"]);
  });
  it("a new player has no invented numbers or awards", () => {
    const r = verifiedRecord({ profileId: "new", matches, attendances: [], stats: [] });
    expect(r).toMatchObject({ played: 0, goals: 0, assists: 0, mvps: 0, officialRating: null });
    expect(achievements(r)).toEqual([]);
  });
});

describe("PlayerLayers", () => {
  const profile = { id: "me", full_name: "Yo", nickname: "Yo", preferred_position: "Forward" };
  const fakeApi = (style = null) => ({
    listPlayerStyles: vi.fn().mockResolvedValue(style ? [style] : []),
    listPostmatchClosures: vi.fn().mockResolvedValue([]),
    savePlayerStyle: vi.fn().mockImplementation(async (_id, s) => ({ profile_id: "me", ...s })),
  });

  it("creating a style saves 10 points and never touches the official rating", async () => {
    const styleApi = fakeApi();
    const onSavePosition = vi.fn();
    render(<PlayerLayers profile={profile} activeGroupId="g" matches={[]} attendances={[]} matchStats={[]} onSavePosition={onSavePosition} styleApi={styleApi} />);
    fireEvent.click(await screen.findByRole("button", { name: "Crear mi estilo" }));
    expect(screen.getByText(/No cambia tu rating oficial/)).toBeTruthy();
    expect(screen.getByText("Listo")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restar a Ataque" }));
    expect(screen.getByRole("button", { name: "Guardar mi estilo" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Sumar a Portería" }));
    fireEvent.change(screen.getByLabelText(/Posición secundaria/), { target: { value: "Midfielder" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar mi estilo" }));
    await waitFor(() => expect(styleApi.savePlayerStyle).toHaveBeenCalledWith("me", expect.objectContaining({ attack: 4, goalkeeping: 1, secondary_position: "Midfielder" })));
    expect(onSavePosition).not.toHaveBeenCalled();
    expect(await screen.findByText("Tu estilo quedó guardado.")).toBeTruthy();
    expect(screen.getByText("Autodeclarado")).toBeTruthy();
    expect(screen.getByText("Datos oficiales")).toBeTruthy();
  });

  it("changing the main position goes through the normal profile save", async () => {
    const styleApi = fakeApi({ profile_id: "me", secondary_position: null, ...starterStyle("Forward") });
    const onSavePosition = vi.fn().mockResolvedValue({});
    render(<PlayerLayers profile={profile} activeGroupId="g" matches={[]} attendances={[]} matchStats={[]} onSavePosition={onSavePosition} styleApi={styleApi} />);
    fireEvent.click(await screen.findByRole("button", { name: /Actualizar estilo/ }));
    fireEvent.change(screen.getByLabelText("Posición principal"), { target: { value: "Defender" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar mi estilo" }));
    await waitFor(() => expect(onSavePosition).toHaveBeenCalledWith("Defender"));
  });

  it("if the style table is not available, the profile still works", async () => {
    const styleApi = { listPlayerStyles: vi.fn().mockRejectedValue(new Error("relation does not exist")), listPostmatchClosures: vi.fn().mockRejectedValue(new Error("x")), savePlayerStyle: vi.fn() };
    render(<PlayerLayers profile={profile} activeGroupId="g" matches={[]} attendances={[]} matchStats={[]} onSavePosition={vi.fn()} styleApi={styleApi} />);
    expect(await screen.findByText(/todavía no está disponible/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Crear mi estilo" })).toBeNull();
  });
});
