import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FarmerDirectory,
  lastActiveLabel,
  matchesSearch,
} from "@/components/lgu/farmer-directory";
import type { LguFarmer } from "@/lib/api/lgu-api";

function farmer(overrides: Partial<LguFarmer>): LguFarmer {
  return {
    id: 1,
    first_name: "Juan",
    last_name: "Cruz",
    full_name: "Juan Cruz",
    email: "juan@example.com",
    role: "FARMER",
    account_status: "APPROVED",
    date_joined: "2026-08-01T00:00:00Z",
    plant_count: 2,
    high_risk_plants: 0,
    last_assessment_date: "2026-09-19",
    is_online: false,
    last_seen_at: null,
    ...overrides,
  };
}

const FARMERS: LguFarmer[] = [
  farmer({ id: 1 }),
  farmer({
    id: 2,
    first_name: "Maria",
    last_name: "Santos",
    full_name: "Maria Santos",
    email: "maria@example.com",
    high_risk_plants: 2,
    date_joined: "2026-09-10T00:00:00Z",
    is_online: true,
    last_seen_at: "2026-09-21T08:59:00",
  }),
  farmer({
    id: 3,
    first_name: "Pedro",
    last_name: "Reyes",
    full_name: "Pedro Reyes",
    email: "pedro@example.com",
    last_assessment_date: "2026-08-20",
    date_joined: "2026-07-15T00:00:00Z",
    last_seen_at: "2026-09-07T09:00:00",
  }),
  farmer({
    id: 4,
    first_name: "Ana",
    last_name: "Lim",
    full_name: "Ana Lim",
    email: "ana@example.com",
    account_status: "PENDING",
    date_joined: "2026-09-18T00:00:00Z",
    plant_count: 0,
    last_assessment_date: null,
  }),
];

function names() {
  return screen
    .getAllByRole("listitem")
    .map((row) => within(row).getByText(/Cruz|Santos|Reyes|Lim/).textContent);
}

afterEach(() => vi.useRealTimers());

function renderOn(list = FARMERS) {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 8, 21, 9));
  return render(<FarmerDirectory farmers={list} />);
}

describe("FarmerDirectory", () => {
  it("finds a farmer by part of their name as you type", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderOn();
    await user.type(screen.getByRole("searchbox"), "mar");
    expect(names()).toEqual(["Maria Santos"]);
  });

  it("finds a farmer by email", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderOn();
    await user.type(screen.getByRole("searchbox"), "pedro@");
    expect(names()).toEqual(["Pedro Reyes"]);
  });

  it("says so when nobody matches, and clears back to the list", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderOn();
    await user.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText(/No farmers match "zzz"/)).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Clear search" })[0]);
    expect(names()).toHaveLength(3);
  });

  it("lists the newest registered farmers first", () => {
    renderOn();
    // Pending (Ana) is outside the default Approved view.
    expect(names()).toEqual(["Maria Santos", "Juan Cruz", "Pedro Reyes"]);
  });

  it("shows a green online indicator only for farmers using BulanTanom now", () => {
    renderOn();
    const [maria, juan, pedro] = screen.getAllByRole("listitem");
    expect(within(maria).getByText("Online now")).toBeInTheDocument();
    expect(within(juan).queryByText("Online now")).not.toBeInTheDocument();
    expect(within(juan).getByText("Not signed in yet")).toBeInTheDocument();
    expect(within(pedro).getByText("Last active 14 days ago")).toBeInTheDocument();
  });

  it("shows no plant count, sort menu, attention tiles or high-risk badge", () => {
    // Maria has two high-risk plants and Pedro has not checked in weeks,
    // yet neither is called out: the list is kept to who they are and
    // whether they are online.
    renderOn();
    expect(screen.queryByText(/\d+ plants?$/)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/high risk/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/high-risk plants/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tap to show them/)).not.toBeInTheDocument();
  });

  it("counts each status on its filter", () => {
    renderOn();
    expect(screen.getByRole("button", { name: /Approved\s*3/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pending\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /All\s*4/ })).toBeInTheDocument();
  });

  it("jumps to search when the officer presses /", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderOn();
    await user.keyboard("/");
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });
});

describe("farmer helpers", () => {
  it("says when a farmer last had BulanTanom open, in plain words", () => {
    const now = new Date(2026, 8, 21, 12, 0);
    const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
    expect(lastActiveLabel(null, now)).toBe("Not signed in yet");
    expect(lastActiveLabel(ago(20_000), now)).toBe("Last active just now");
    expect(lastActiveLabel(ago(5 * 60_000), now)).toBe("Last active 5 minutes ago");
    expect(lastActiveLabel(ago(3 * 3_600_000), now)).toBe("Last active 3 hours ago");
    expect(lastActiveLabel(ago(26 * 3_600_000), now)).toBe("Last active 1 day ago");
    expect(lastActiveLabel(ago(14 * 86_400_000), now)).toBe("Last active 14 days ago");
  });

  it("ignores case and accents when searching", () => {
    expect(matchesSearch(farmer({ full_name: "José Peña" }), "jose pena")).toBe(true);
  });
});
