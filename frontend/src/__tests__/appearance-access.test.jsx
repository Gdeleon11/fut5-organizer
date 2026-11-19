import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AppearanceSettings from "../components/AppearanceSettings.jsx";
import { AppearanceProvider } from "../appearance/AppearanceProvider.jsx";
import { MobileBottomNav } from "../components/shell/MobileBottomNav.jsx";

if (typeof window.localStorage?.clear !== "function") {
  const mem = new Map();
  const store = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear() };
  Object.defineProperty(window, "localStorage", { value: store, configurable: true });
}

describe("Apariencia screen", () => {
  it("renders real previews of both designs, marks the active options and switches instantly", () => {
    localStorage.clear();
    const { container } = render(
      <AppearanceProvider client={null}>
        <AppearanceSettings asPage />
      </AppearanceProvider>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Apariencia" })).toBeTruthy();
    // real hero components inside the previews (not wireframes)
    expect(container.querySelector('[data-preview="editorial"] .mde-hero')).not.toBeNull();
    expect(container.querySelector('[data-preview="command"] .mdc-arena .mdc-lineup')).not.toBeNull();
    expect(container.querySelector(".md-appearance-current").textContent).toMatch(/Matchday Editorial · F5 Neon/);
    expect(container.querySelector(".md-design-opt.is-selected").textContent).toMatch(/Matchday Editorial.*Activo/);

    fireEvent.click(screen.getByLabelText(/Sports Command Center/));
    fireEvent.click(screen.getByLabelText(/Elite Gold/));
    expect(container.querySelector(".md-design-opt.is-selected").textContent).toMatch(/Sports Command Center/);
    expect(container.querySelector(".md-palette-opt.is-selected").textContent).toMatch(/Elite Gold.*Activa/);
    expect(container.querySelector(".md-appearance-current").textContent).toMatch(/Sports Command Center · Elite Gold/);
  });
});

describe("Mobile Más menu", () => {
  const items = ["matches", "reservations", "cashier", "players", "profile", "tournaments"].map((id) => ({ id, label: id, icon: null }));
  it("lists Apariencia when the Más menu exists", () => {
    const go = vi.fn();
    render(<MobileBottomNav navItems={items} activePage="matches" goToPage={go} moreExtras={[{ id: "appearance", label: "Apariencia", icon: null }]} />);
    fireEvent.click(screen.getByTitle("Más opciones"));
    fireEvent.click(screen.getByText("Apariencia"));
    expect(go).toHaveBeenCalledWith("appearance");
  });
});
