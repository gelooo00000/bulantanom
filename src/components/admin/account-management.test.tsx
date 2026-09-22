import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AccountManagement,
  ActionConfirm,
  recordsText,
  type PendingAction,
} from "@/components/admin/account-management";
import type { AdminUser } from "@/lib/api/admin-api";

vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({ accessToken: "token", currentUser: { id: "1" } }),
}));

const api = vi.hoisted(() => ({
  listUsers: vi.fn(),
  approveFarmer: vi.fn(),
  deleteAccount: vi.fn(),
  rejectFarmer: vi.fn(),
  suspendFarmer: vi.fn(),
  suspendOfficer: vi.fn(),
  reactivateOfficer: vi.fn(),
}));
vi.mock("@/lib/api/admin-api", () => api);

function account(id: number, name: string, overrides: Partial<AdminUser> = {}): AdminUser {
  const [first, last] = name.split(" ");
  return {
    id,
    first_name: first,
    last_name: last,
    full_name: name,
    email: `${first.toLowerCase()}@example.com`,
    role: "FARMER",
    account_status: "APPROVED",
    date_joined: `2026-09-${String(id).padStart(2, "0")}T08:00:00Z`,
    plant_count: 0,
    assessment_count: 0,
    soil_record_count: 0,
    is_online: false,
    last_seen_at: null,
    ...overrides,
  };
}

const MARIA = account(10, "Maria Santos", {
  plant_count: 6,
  assessment_count: 12,
  soil_record_count: 3,
  is_online: true,
});
const JUAN = account(11, "Juan Cruz", { account_status: "PENDING" });
const ANA = account(12, "Ana Lim", { account_status: "PENDING" });

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.listUsers.mockResolvedValue([MARIA, JUAN, ANA]);
  api.approveFarmer.mockResolvedValue({});
  api.deleteAccount.mockResolvedValue({ detail: "deleted" });
});

describe("recordsText", () => {
  it("lists only the records a farmer has", () => {
    expect(recordsText(MARIA)).toBe("6 plants · 12 assessments · 3 soil checks");
    expect(recordsText(JUAN)).toBe("No farm records");
  });
});

describe("AccountManagement", () => {
  it("shows each farmer's records and who is online", async () => {
    render(<AccountManagement />);
    const row = (await screen.findByText("Maria Santos")).closest("li")!;
    expect(row).toHaveTextContent("6 plants · 12 assessments · 3 soil checks");
    expect(row).toHaveTextContent("Online now");
  });

  it("counts who is online in the overview", async () => {
    render(<AccountManagement />);
    await screen.findByText("Maria Santos");
    // "Online now" is also on Maria's row; the overview's is the label
    // whose sibling holds the count.
    const label = screen
      .getAllByText("Online now")
      .find((el) => el.previousElementSibling?.textContent === "1");
    expect(label).toBeDefined();
  });

  it("approves every pending registration at once, after asking", async () => {
    const user = userEvent.setup();
    render(<AccountManagement />);
    await user.click(await screen.findByRole("tab", { name: /Pending/ }));
    await user.click(screen.getByRole("button", { name: "Approve all (2)" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Approve 2 registrations?");
    expect(dialog).toHaveTextContent("Juan Cruz");
    expect(dialog).toHaveTextContent("Ana Lim");
    await user.click(within(dialog).getByRole("button", { name: "Yes, approve 2" }));

    await waitFor(() => expect(api.approveFarmer).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("2 registrations approved.")).toBeInTheDocument();
  });
});

describe("the delete confirmation", () => {
  function renderConfirm(action: PendingAction) {
    const onConfirm = vi.fn();
    const onSuspendInstead = vi.fn();
    render(
      <ActionConfirm
        action={action}
        busy={false}
        error={null}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        onSuspendInstead={onSuspendInstead}
      />,
    );
    return { onConfirm, onSuspendInstead };
  }

  it("spells out everything a farmer's deletion takes with it", () => {
    renderConfirm({ kind: "delete", user: MARIA });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Delete Maria Santos's account?");
    expect(dialog).toHaveTextContent("cannot be undone");
    expect(dialog).toHaveTextContent("maria@example.com will be emailed that the account was deleted.");
    expect(dialog).toHaveTextContent("6 plants");
    expect(dialog).toHaveTextContent("12 weekly assessments, with their AI risk readings and evidence photos");
    expect(dialog).toHaveTextContent("3 soil checks");
  });

  it("stays locked until the farmer's email is typed", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderConfirm({ kind: "delete", user: MARIA });
    const confirm = screen.getByRole("button", { name: "Yes, delete permanently" });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText(/to confirm/), "DELETE");
    expect(confirm).toBeDisabled(); // the word is not enough when records go too

    await user.clear(screen.getByLabelText(/to confirm/));
    await user.type(screen.getByLabelText(/to confirm/), "maria@example.com");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalled();
  });

  it("asks only for DELETE when the account has no records", () => {
    renderConfirm({ kind: "delete", user: JUAN });
    expect(screen.getByText("DELETE")).toBeInTheDocument();
    expect(screen.queryByText(/Also deleted/)).toBeNull();
  });

  it("offers to suspend instead, keeping the records", async () => {
    const user = userEvent.setup();
    const { onSuspendInstead } = renderConfirm({ kind: "delete", user: MARIA });
    await user.click(screen.getByRole("button", { name: /Suspend instead/ }));
    expect(onSuspendInstead).toHaveBeenCalledWith(MARIA);
  });
});
