import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddPlantButton } from "@/components/farmer/add-plant-button";
import { RiskBadge } from "@/components/risk/risk-badge";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { setLanguage, translate } from "@/lib/i18n";
import { MESSAGES } from "@/lib/i18n/messages";
import * as namespaces from "@/lib/i18n/messages";
import { SOIL_STRINGS } from "@/lib/soil-options";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

afterEach(() => {
  act(() => setLanguage("en"));
  window.history.replaceState(null, "", "/");
});

describe("the messages", () => {
  it("have English, Filipino and Bikol for every entry", () => {
    for (const [key, entry] of Object.entries(MESSAGES)) {
      for (const language of ["en", "fil", "bik"] as const) {
        expect(entry[language].trim(), `${key} (${language})`).not.toBe("");
      }
    }
  });

  it("use the same placeholders in every language", () => {
    for (const [key, entry] of Object.entries(MESSAGES)) {
      expect(placeholders(entry.fil), `${key} (fil)`).toEqual(placeholders(entry.en));
      expect(placeholders(entry.bik), `${key} (bik)`).toEqual(placeholders(entry.en));
    }
  });

  it("never reuse a key in two files, which would silently overwrite one", () => {
    const files: object[] = Object.values(namespaces).filter((value) => value !== MESSAGES);
    const total = files.reduce((sum, file) => sum + Object.keys(file).length, 0);
    expect(total).toBe(Object.keys(MESSAGES).length);
  });

  it("cover every Crop Recommendation string", () => {
    for (const key of Object.keys(SOIL_STRINGS)) {
      expect(MESSAGES, key).toHaveProperty([`soil.${key}`]);
    }
  });

  it("fill in placeholders", () => {
    expect(translate("bik", "dash.welcome", { name: "Angelo" })).toBe("Dagos, Angelo.");
    expect(translate("fil", "myPlants.selected", { n: 3 })).toBe("3 ang napili");
  });
});

describe("switching language", () => {
  it("changes the Farmer screens straight away", async () => {
    window.history.replaceState(null, "", "/farmer/plants");
    render(
      <>
        <LanguageSwitcher />
        <AddPlantButton />
      </>,
    );
    expect(screen.getByRole("button", { name: "Add Plant" })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Change language/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Bikol (Bulan)" }));

    expect(screen.getByRole("button", { name: "Magdugang san Tanom" })).toBeInTheDocument();
  });

  it("leaves the LGU screens in English", () => {
    act(() => setLanguage("bik"));
    window.history.replaceState(null, "", "/lgu/risks");
    render(<RiskBadge level="high" />);
    expect(screen.getByText("High Risk")).toBeInTheDocument();
  });

  it("translates shared risk badges on Farmer pages", () => {
    act(() => setLanguage("fil"));
    window.history.replaceState(null, "", "/farmer/risk-indicator");
    render(<RiskBadge level="high" />);
    expect(screen.getByText("Mataas na Panganib")).toBeInTheDocument();
  });
});
