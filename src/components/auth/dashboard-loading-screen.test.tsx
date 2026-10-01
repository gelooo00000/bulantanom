import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CROP_STEP_MS,
  DashboardLoadingScreen,
  LOADING_CROPS,
} from "@/components/auth/dashboard-loading-screen";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

beforeEach(() => {
  vi.useFakeTimers();
  replace.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DashboardLoadingScreen", () => {
  it("cycles through the farm's crops instead of showing the logo", () => {
    render(<DashboardLoadingScreen destination="/farmer/dashboard" firstName="Juan" />);

    expect(screen.queryByAltText("Layuan Nature Integrated Farm")).toBeNull();
    const [firstEmoji, firstName] = LOADING_CROPS[0];
    const [nextEmoji, nextName] = LOADING_CROPS[1];
    expect(screen.getByText(firstEmoji)).toBeInTheDocument();
    expect(screen.getByText(firstName)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(CROP_STEP_MS));
    expect(screen.getByText(nextEmoji)).toBeInTheDocument();
    expect(screen.getByText(nextName)).toBeInTheDocument();
    expect(screen.queryByText(firstName)).toBeNull();
  });

  it("starts over after the last crop", () => {
    render(<DashboardLoadingScreen destination="/farmer/dashboard" />);
    act(() => vi.advanceTimersByTime(CROP_STEP_MS * LOADING_CROPS.length));
    expect(screen.getByText(LOADING_CROPS[0][1])).toBeInTheDocument();
  });
});
