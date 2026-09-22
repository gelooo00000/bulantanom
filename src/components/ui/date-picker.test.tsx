import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DatePicker } from "@/components/ui/date-picker";

/**
 * The calendar never goes back before the current month. "Today" is fixed
 * so the limit is deterministic, then moved to show it follows the month.
 */

afterEach(() => vi.useRealTimers());

async function openOn(today: Date, props: { value?: string; max?: string } = {}) {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(today);
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<DatePicker value={props.value ?? ""} onChange={() => {}} max={props.max} />);
  await user.click(screen.getByRole("button", { name: /Select a date|20[0-9][0-9]/ }));
  return user;
}

const monthSelect = () => screen.getByRole("combobox", { name: "Month" }) as HTMLSelectElement;
const yearSelect = () => screen.getByRole("combobox", { name: "Year" }) as HTMLSelectElement;

describe("DatePicker lower limit", () => {
  const SEP_22 = new Date(2026, 8, 22, 9);

  it("opens on the current month and cannot go back from it", async () => {
    await openOn(SEP_22);
    expect(monthSelect().value).toBe("8"); // September
    expect(yearSelect().value).toBe("2026");
    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();
  });

  it("does not list the months before this one, or earlier years", async () => {
    await openOn(SEP_22);
    // September to December of 2026 only — July and the rest are not shown.
    expect([...monthSelect().options].map((o) => o.text)).toEqual([
      "September",
      "October",
      "November",
      "December",
    ]);
    expect([...yearSelect().options].map((o) => o.value)).toEqual(["2026", "2027"]);
  });

  it("opens on the current month even when the chosen date is older", async () => {
    await openOn(SEP_22, { value: "2025-07-10" });
    expect(monthSelect().value).toBe("8");
    expect(yearSelect().value).toBe("2026");
  });

  it("browses forward past max, but days after max cannot be picked", async () => {
    const user = await openOn(SEP_22, { max: "2026-09-22" });
    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "22" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "23" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(monthSelect().value).toBe("9"); // October
    expect(screen.getByRole("button", { name: "1" })).toBeDisabled();
  });

  it("goes forward from September into January", async () => {
    const user = await openOn(SEP_22);
    for (let i = 0; i < 4; i += 1) {
      await user.click(screen.getByRole("button", { name: "Next month" }));
    }
    expect(monthSelect().value).toBe("0"); // January
    expect(yearSelect().value).toBe("2027");
    // In 2027 the list runs to September: a year ahead of this month.
    expect(monthSelect().options).toHaveLength(9);
  });

  it("can go forward when there is no max, and back again — but no further", async () => {
    const user = await openOn(SEP_22);
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(monthSelect().value).toBe("9"); // October
    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(monthSelect().value).toBe("8");
    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();
  });

  it("starts the selectable days at today, and allows future days", async () => {
    await openOn(SEP_22);
    expect(screen.getByRole("button", { name: "21" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "22" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "30" })).toBeEnabled();
  });

  it("moves the first selectable day forward each day", async () => {
    await openOn(new Date(2026, 8, 23, 9)); // the next day
    expect(screen.getByRole("button", { name: "22" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "23" })).toBeEnabled();
  });

  it("moves the limit forward when the month changes", async () => {
    await openOn(new Date(2026, 9, 1, 9)); // October 1
    expect(monthSelect().value).toBe("9");
    expect([...monthSelect().options].map((o) => o.text)).not.toContain("September");
    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();
  });
});
