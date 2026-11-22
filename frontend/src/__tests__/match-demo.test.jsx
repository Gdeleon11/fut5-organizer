import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { AppearanceProvider } from "../appearance/AppearanceProvider.jsx";
import MatchDemo from "../dev/MatchDemo.jsx";

for (const design of ["editorial", "command"]) {
  it(design + " distribuye el plantel y completa una encuesta en memoria", async () => {
    const preference = JSON.stringify({ design, palette: "gold", updatedAt: 1 });
    Object.defineProperty(window, "localStorage", { configurable: true, value: { getItem: () => preference, setItem() {} } });
    const { container } = render(<AppearanceProvider><MatchDemo /></AppearanceProvider>);
    expect(container.querySelector("[data-view=pizarra]").dataset.design).toBe(design);
    fireEvent.click(screen.getByText("Todos"));
    fireEvent.click(screen.getByRole("button", { name: "Simular", exact: true }));
    const teams = container.querySelectorAll(".mdd-team");
    const players = Array.from(container.querySelectorAll(".mdd-team-name"), el => el.textContent);
    expect(players).toHaveLength(18);
    expect(new Set(players).size).toBe(18);
    expect(teams.length).toBe(3);
    if (design === "command") expect(container.querySelectorAll(".mdd-pitch-tok")).toHaveLength(18);
    fireEvent.click(within(teams[0]).getByLabelText("Color Morado"));
    expect(teams[0].style.getPropertyValue("--team")).toBe("#a855f7");
    fireEvent.click(teams[0].querySelector("li button"));
    expect(container.querySelector(".fifa-modal-overlay")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByText("Abrir encuesta de práctica"));
    fireEvent.click(await screen.findByRole("button", { name: "Sumar Goles" }));
    fireEvent.click(screen.getByText("Siguiente"));
    const mvp = await screen.findByRole("radiogroup", { name: "Elegí al MVP" });
    expect(within(mvp).queryByRole("radio", { name: /Jugador 1$/ })).toBeNull(); // no self vote
    fireEvent.click(within(mvp).getByRole("radio", { name: /Jugador 2$/ }));
    fireEvent.click(screen.getByText("Votar y terminar"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Gracias"));
  });
}
