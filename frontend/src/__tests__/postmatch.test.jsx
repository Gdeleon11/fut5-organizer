import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import PostmatchPanel from "../components/postmatch/PostmatchPanel.jsx";
import { historyLine, mvpView } from "../postmatch/postmatchModel.js";

const people = [["me", "Yo"], ["p2", "Dos"], ["p3", "Tres"], ["p4", "Cuatro"]];
const profileById = new Map(people.map(([id, nickname]) => [id, { id, nickname }]));
const match = { id: "m1", title: "Jueves" };

function fake(summary) {
  return {
    postmatchSummary: vi.fn().mockResolvedValue(summary),
    postmatchReport: vi.fn().mockResolvedValue({}),
    postmatchDecide: vi.fn().mockResolvedValue({}),
    postmatchVoteMvp: vi.fn().mockResolvedValue({}),
    postmatchClose: vi.fn().mockResolvedValue({}),
    postmatchRequestCorrection: vi.fn().mockResolvedValue({}),
    postmatchResolveCorrection: vi.fn().mockResolvedValue({}),
    postmatchSetValidator: vi.fn().mockResolvedValue({}),
    postmatchRevokeValidator: vi.fn().mockResolvedValue({}),
  };
}
const base = (over = {}) => ({
  participants: people.map(([id]) => id), events: [], corrections: [], history: [],
  mvp: { participants: 4, voters: 1, quorum: 3, leaders: ["p2"] }, my_vote: null, closed: null, legacy_stats: false, ...over,
});

describe("PostmatchPanel", () => {
  it("admin who also played: can validate others, never their own data", async () => {
    const api = fake(base({ events: [
      { id: "e1", subject_id: "me", kind: "goal", quantity: 2, status: "provisional" },
      { id: "e2", subject_id: "p2", kind: "goal", quantity: 1, status: "provisional" },
    ] }));
    render(<PostmatchPanel match={match} me={{ id: "me" }} isAdmin profileById={profileById} postmatchApi={api} />);
    const box = await screen.findByLabelText("Datos para validar");
    expect(within(box).queryByText(/Yo/)).toBeNull();
    fireEvent.click(within(box).getByRole("button", { name: /Confirmar gol de Dos/ }));
    await waitFor(() => expect(api.postmatchDecide).toHaveBeenCalledWith("e2", true));
    expect(screen.getByText(/Tus propios datos los tiene que validar otro admin/)).toBeTruthy();
  });

  it("my own report is sent as data to validate (provisional on the server)", async () => {
    const api = fake(base());
    render(<PostmatchPanel match={match} me={{ id: "me" }} isAdmin={false} profileById={profileById} postmatchApi={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "Cargar mis datos" }));
    expect(screen.getByText(/Queda/).textContent).toMatch(/pendiente/);
    fireEvent.click(screen.getByRole("button", { name: "Sumar Goles" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(api.postmatchReport).toHaveBeenCalledWith("m1", "me", "goal", 1));
    expect(api.postmatchReport).toHaveBeenCalledTimes(1);
  });

  it("MVP vote lists the lineup without me; players do not see results before closing", async () => {
    const api = fake(base());
    render(<PostmatchPanel match={match} me={{ id: "me" }} isAdmin={false} profileById={profileById} postmatchApi={api} />);
    const vote = await screen.findByRole("group", { name: "Votar MVP" });
    expect(within(vote).queryByRole("button", { name: "Yo" })).toBeNull();
    expect(within(vote).getAllByRole("button")).toHaveLength(3);
    expect(screen.getByText(/Votaron 1 de 4\. Hace falta que voten al menos 3/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cerrar postpartido" })).toBeNull();
    fireEvent.click(within(vote).getByRole("button", { name: "Tres" }));
    await waitFor(() => expect(api.postmatchVoteMvp).toHaveBeenCalledWith("m1", "p3"));
  });

  it("a correction that changes an admin's own data cannot be accepted by that admin", async () => {
    const api = fake(base({
      events: [{ id: "e1", subject_id: "me", kind: "goal", quantity: 3, status: "confirmed" }],
      corrections: [{ id: "c1", event_id: "e1", requested_by: "p2", message: "Fueron 2", proposed_quantity: 2, status: "open" }],
    }));
    render(<PostmatchPanel match={match} me={{ id: "me" }} isAdmin profileById={profileById} postmatchApi={api} />);
    const box = await screen.findByLabelText("Correcciones");
    expect(within(box).getByRole("button", { name: "Aceptar" }).disabled).toBe(true);
  });

  it("not a participant and not admin: read-only", async () => {
    const api = fake(base({ participants: ["p2", "p3", "p4"] }));
    render(<PostmatchPanel match={match} me={{ id: "me" }} isAdmin={false} profileById={profileById} postmatchApi={api} />);
    await screen.findByText(/Postpartido/);
    expect(screen.queryByRole("button", { name: "Cargar mis datos" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Votar MVP" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Pedir corrección/ })).toBeNull();
  });

  it("panel hides itself where Postmatch is not installed", async () => {
    const api = { postmatchSummary: vi.fn().mockRejectedValue(new Error("Could not find the function public.postmatch_summary in the schema cache")) };
    const { container } = render(<PostmatchPanel match={match} me={{ id: "me" }} isAdmin profileById={profileById} postmatchApi={api} />);
    await waitFor(() => expect(api.postmatchSummary).toHaveBeenCalled());
    expect(container.querySelector("[data-postmatch]")).toBeNull();
  });
});

describe("match validator (single-admin groups)", () => {
  it("the sole admin with pending own data is asked to designate a teammate", async () => {
    const api = fake(base({ can_designate: true, events: [{ id: "e1", subject_id: "me", kind: "goal", quantity: 2, status: "provisional" }] }));
    render(<PostmatchPanel match={match} me={{ id: "me" }} isAdmin profileById={profileById} postmatchApi={api} />);
    const box = await screen.findByLabelText("Validador del partido");
    expect(within(box).getByText(/Sos el único admin y jugaste/)).toBeTruthy();
    const select = within(box).getByLabelText("Elegí al validador");
    expect(within(select).queryByRole("option", { name: "Yo" })).toBeNull();
    fireEvent.change(select, { target: { value: "p3" } });
    fireEvent.click(within(box).getByRole("button", { name: "Designar" }));
    await waitFor(() => expect(api.postmatchSetValidator).toHaveBeenCalledWith("m1", "p3"));
    expect(screen.queryByText(/Tus propios datos los tiene que validar otro admin/)).toBeNull();
  });

  it("the validator sees only the admin's data to validate, and corrections about it", async () => {
    const api = fake(base({
      i_am_validator: true, validator: { validator_id: "me", designated_by: "p2", used: false },
      events: [
        { id: "a", subject_id: "p2", kind: "goal", quantity: 2, status: "provisional" },
        { id: "b", subject_id: "p3", kind: "goal", quantity: 1, status: "provisional" },
      ],
      corrections: [
        { id: "c1", event_id: "a", requested_by: "p4", message: "Fue 1", proposed_quantity: 1, status: "open" },
        { id: "c2", event_id: "b", requested_by: "p4", message: "Fueron 2", proposed_quantity: 2, status: "open" },
      ],
    }));
    render(<PostmatchPanel match={match} me={{ id: "me" }} isAdmin={false} profileById={profileById} postmatchApi={api} />);
    const box = await screen.findByLabelText("Datos para validar");
    expect(within(box).getByRole("heading").textContent).toMatch(/Datos de Dos para validar/);
    expect(within(box).getAllByRole("listitem")).toHaveLength(1);
    fireEvent.click(within(box).getByRole("button", { name: /Confirmar goles de Dos/ }));
    await waitFor(() => expect(api.postmatchDecide).toHaveBeenCalledWith("a", true));
    const corr = screen.getByLabelText("Correcciones");
    expect(within(corr).getAllByRole("button", { name: "Aceptar" })).toHaveLength(1);
    expect(screen.getByLabelText("Validador del partido").dataset.validator).toBe("Yo");
  });

  it("a used validator cannot be revoked; everyone sees who validates", async () => {
    const api = fake(base({ can_designate: true, validator: { validator_id: "p3", designated_by: "me", used: true } }));
    render(<PostmatchPanel match={match} me={{ id: "me" }} isAdmin profileById={profileById} postmatchApi={api} />);
    const box = await screen.findByLabelText("Validador del partido");
    expect(box.textContent).toMatch(/Tres valida los datos de Yo .*ya revisó datos/);
    expect(within(box).queryByRole("button", { name: "Revocar" })).toBeNull();
  });
});

describe("postmatch model", () => {
  it("closed without enough participation or with a tie is explained, never declared", () => {
    expect(mvpView({ closed: { mvp_profile_id: null, voters: 1, participants: 6 } })).toMatchObject({ state: "none", reason: "participation" });
    expect(mvpView({ closed: { mvp_profile_id: null, voters: 4, participants: 6 } })).toMatchObject({ state: "none", reason: "tie" });
    expect(mvpView({ closed: { mvp_profile_id: "p2", mvp_votes: 3, voters: 4 } })).toMatchObject({ state: "official", profileId: "p2" });
  });
  it("history lines read like a log", () => {
    const name = (id) => profileById.get(id)?.nickname;
    expect(historyLine({ action: "reported", actor_id: "me", detail: { kind: "goal", quantity: 2, subject_id: "me" } }, name)).toBe("Yo registró 2 goles · Yo");
    expect(historyLine({ action: "correction_accepted", actor_id: "p2", detail: { before: { quantity: 3 }, after: { quantity: 2 } } }, name)).toBe("Dos aceptó una corrección (3 → 2)");
    expect(historyLine({ action: "validator_designated", actor_id: "me", detail: { subject_id: "p3" } }, name)).toBe("Yo designó como validador del partido a Tres");
    expect(historyLine({ action: "confirmed", actor_id: "p3", detail: { kind: "goal", quantity: 2, subject_id: "me", as_validator: true } }, name)).toBe("Tres confirmó 2 goles · Yo (como validador)");
  });
});
